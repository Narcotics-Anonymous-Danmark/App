#!/usr/bin/env node
/**
 * Patches cordova-plugin-media@7.0.0's iOS implementation (CDVSound.m/.h) to
 * behave like its Android counterpart. Verified end-to-end by
 * scripts/ios-media-selftest.sh — run that after touching this file.
 *
 * THE BUG THIS FIXES (iOS only, 100% reproducible):
 * Tapping "continue playing" after stopping made the mini player appear and
 * immediately close again. Captured native event sequence:
 *
 *     p2: play()
 *     p2: native status -> RUNNING          (52ms after play)
 *     p2: seekTo(45s)                       (app restores the resume point)
 *     p2: onError {"message":"AVPlayerItem cannot service a seek request with a
 *          completion handler until its status is AVPlayerItemStatusReadyToPlay.",
 *          "code":1}
 *
 * iOS's startPlayingAudio: emits MEDIA_RUNNING immediately after [avPlayer play],
 * long before a *remote* AVPlayerItem is ready. MediaPlayerService defers the
 * resume seek to MEDIA_RUNNING (onTrackRunning), so on iOS the seek always lands
 * too early — and iOS's seekToAudio: answers an early seek with a hard
 * MEDIA_ERROR. MediaPlayerService.onTrackError() treats any error as fatal and
 * calls stop(), which hides the player. Two failures, one cause: the player
 * closes AND the resume point is silently dropped.
 *
 * Android never had this: AudioPlayer.seekToPlaying() stores the position in
 * `seekOnPrepared` when the player isn't ready and replays it from onPrepared,
 * emitting no error (see plugins/cordova-plugin-media/src/android/AudioPlayer.java).
 *
 * WHAT THIS PATCH CHANGES:
 *   1. seekToAudio: defers an early seek instead of erroring, and applies it
 *      once the item reports AVPlayerItemStatusReadyToPlay — the direct
 *      equivalent of Android's seekOnPrepared. Playback rate is preserved
 *      across the seek. A deferred seek is never fatal.
 *   2. itemStalledPlaying: no longer reports a fatal MEDIA_ERROR. A buffer
 *      stall is transient and AVPlayer resumes on its own; Android reports
 *      nothing here. Because create: sets automaticallyWaitsToMinimizeStalling
 *      = NO, stalls are common on a slow connection, and mapping them to an
 *      error tore playback down mid-track.
 *   3. itemDidFinishPlaying: ignores notifications from an AVPlayerItem that is
 *      no longer current. The plugin keeps ONE shared avPlayer/currMediaId pair
 *      for all tracks, so a late notification from a just-stopped track was
 *      reported against whichever track started next.
 *   4. stopPlayingAudio: snapshots the player/item its async seek completion
 *      handler acts on, so it cannot pause a *different* track that started in
 *      the meantime; release: only tears down the shared avPlayer when it still
 *      belongs to the track being released, and drops that track's observers.
 *   5. Adds a DEBUG-only NSLog of every status event, so the native event
 *      sequence is visible in the simulator/device log while debugging.
 *
 * Runs as a cordova before_compile hook: `cordova prepare` re-fetches the
 * plugin from the npm registry and re-copies it into platforms/ios on every
 * build, so this re-applies (idempotently) after each copy. It also patches the
 * plugin source at rest so a fresh checkout is correct before the first build.
 * See docs/media-player.md.
 */
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CDVSound.h — per-track state for the deferred seek.
// ---------------------------------------------------------------------------
function patchHeader(src) {
    if (src.indexOf('AVPlayerItem* playerItem;') !== -1) {
        return src;
    }
    src = src.replace(
        '    NSNumber* volume;\n    NSNumber* rate;\n}',
        '    NSNumber* volume;\n    NSNumber* rate;\n    AVPlayerItem* playerItem;\n    NSNumber* pendingSeek;\n}'
    );
    src = src.replace(
        '@property (nonatomic, strong) NSNumber* rate;\n',
        '@property (nonatomic, strong) NSNumber* rate;\n' +
        '// The streamed item for this track, and a seek (in ms) received before it\n' +
        '// was ready to service one. Mirrors Android AudioPlayer.seekOnPrepared.\n' +
        '@property (nonatomic, strong) AVPlayerItem* playerItem;\n' +
        '@property (nonatomic, strong) NSNumber* pendingSeek;\n'
    );
    return src;
}

// ---------------------------------------------------------------------------
// CDVSound.m
// ---------------------------------------------------------------------------
function patchSynthesize(src) {
    if (src.indexOf('@synthesize playerItem, pendingSeek;') !== -1) {
        return src;
    }
    return src.replace(
        '@synthesize player, volume, rate;\n@synthesize recorder;',
        '@synthesize player, volume, rate;\n@synthesize recorder;\n@synthesize playerItem, pendingSeek;'
    );
}

function patchCreate(src) {
    if (src.indexOf('Recreating this mediaId: drop observers') === -1) {
        src = src.replace(
            '        if (![resourceUrl isFileURL] && ![resourcePath hasPrefix:CDVFILE_PREFIX]) {\n            // First create an AVPlayerItem',
            '        if (![resourceUrl isFileURL] && ![resourcePath hasPrefix:CDVFILE_PREFIX]) {\n' +
            '            // Recreating this mediaId: drop observers tied to any previous\n' +
            '            // AVPlayerItem so a late notification for the old item cannot be\n' +
            '            // misattributed to this one, and drop its stale deferred seek.\n' +
            '            if (audioFile.playerItem != nil) {\n' +
            '                [[NSNotificationCenter defaultCenter] removeObserver:self name:AVPlayerItemDidPlayToEndTimeNotification object:audioFile.playerItem];\n' +
            '                [[NSNotificationCenter defaultCenter] removeObserver:self name:AVPlayerItemPlaybackStalledNotification object:audioFile.playerItem];\n' +
            '            }\n' +
            '            audioFile.pendingSeek = nil;\n' +
            '            // First create an AVPlayerItem'
        );
    }
    if (src.indexOf('audioFile.playerItem = playerItem;') === -1) {
        src = src.replace(
            'avPlayer = [[AVPlayer alloc] initWithPlayerItem:playerItem];',
            'avPlayer = [[AVPlayer alloc] initWithPlayerItem:playerItem];\n            audioFile.playerItem = playerItem;'
        );
    }
    return src;
}

function patchStopPlayingAudio(src) {
    const anchor =
        '    // seek to start and pause\n' +
        '    if (avPlayer.currentItem && avPlayer.currentItem.asset) {\n' +
        '        BOOL isReadyToSeek = (avPlayer.status == AVPlayerStatusReadyToPlay) && (avPlayer.currentItem.status == AVPlayerItemStatusReadyToPlay);\n' +
        '        if (isReadyToSeek) {\n' +
        '            [avPlayer seekToTime: kCMTimeZero\n' +
        '                 toleranceBefore: kCMTimeZero\n' +
        '                  toleranceAfter: kCMTimeZero\n' +
        '               completionHandler: ^(BOOL finished){\n' +
        '                   if (finished) [avPlayer pause];\n' +
        '               }];\n' +
        '            [self onStatus:MEDIA_STATE mediaId:mediaId param:@(MEDIA_STOPPED)];\n' +
        '        } else {\n' +
        '            // cannot seek, wrong state\n' +
        '            CDVMediaError errcode = MEDIA_ERR_NONE_ACTIVE;\n' +
        '            NSString* errMsg = @"Cannot service stop request until the avPlayer is in \'AVPlayerStatusReadyToPlay\' state.";\n' +
        '            [self onStatus:MEDIA_ERROR mediaId:mediaId param:\n' +
        '              [self createMediaErrorWithCode:errcode message:errMsg]];\n' +
        '        }\n' +
        '    }\n' +
        '}';
    if (src.indexOf(anchor) === -1) {
        return src;
    }
    const replacement =
        '    // Seek to start and pause. Snapshot this track\'s player/item so the async\n' +
        '    // completion handler cannot pause a different track\'s shared avPlayer if a\n' +
        '    // new one started before the seek finished.\n' +
        '    AVPlayerItem* itemToStop = audioFile.playerItem;\n' +
        '    AVPlayer* playerToStop = avPlayer;\n' +
        '    if (itemToStop != nil && playerToStop.currentItem == itemToStop) {\n' +
        '        audioFile.pendingSeek = nil;\n' +
        '        BOOL isReadyToSeek = (playerToStop.status == AVPlayerStatusReadyToPlay) && (itemToStop.status == AVPlayerItemStatusReadyToPlay);\n' +
        '        if (isReadyToSeek) {\n' +
        '            [playerToStop seekToTime: kCMTimeZero\n' +
        '                 toleranceBefore: kCMTimeZero\n' +
        '                  toleranceAfter: kCMTimeZero\n' +
        '               completionHandler: ^(BOOL finished){\n' +
        '                   if (finished && playerToStop.currentItem == itemToStop) [playerToStop pause];\n' +
        '               }];\n' +
        '        } else {\n' +
        '            // Not ready to seek: just pause where we are. Reporting an error here\n' +
        '            // would make the JS layer tear the session down on a plain stop.\n' +
        '            [playerToStop pause];\n' +
        '        }\n' +
        '        [self onStatus:MEDIA_STATE mediaId:mediaId param:@(MEDIA_STOPPED)];\n' +
        '    }\n' +
        '}';
    return src.replace(anchor, replacement);
}

/**
 * The core fix: defer an early seek instead of reporting MEDIA_ERROR.
 */
function patchSeekToAudio(src) {
    // The replacement keeps the original error branch as its fallback, so it
    // still contains this function's own anchor — guard explicitly or it
    // re-applies on every run.
    if (src.indexOf('audioFile.pendingSeek = @(position);') !== -1) {
        return src;
    }
    const anchor =
        '        } else {\n' +
        '            NSString* errMsg = @"AVPlayerItem cannot service a seek request with a completion handler until its status is AVPlayerItemStatusReadyToPlay.";\n' +
        '            [self onStatus:MEDIA_ERROR mediaId:mediaId param:\n' +
        '              [self createAbortError:errMsg]];\n' +
        '        }';
    if (src.indexOf(anchor) === -1) {
        return src;
    }
    const replacement =
        '        } else if (audioFile != nil && audioFile.playerItem != nil) {\n' +
        '            // A remote AVPlayerItem is not ready this soon after play(), and the\n' +
        '            // JS layer issues the resume seek as soon as MEDIA_RUNNING arrives.\n' +
        '            // Remember it and apply it once the item is ready, exactly as Android\n' +
        '            // does via seekOnPrepared/onPrepared. Reporting an error instead made\n' +
        '            // the JS layer stop playback and hide the player every single time.\n' +
        '            audioFile.pendingSeek = @(position);\n' +
        '            NSLog(@"Deferring seek to %.3fs until the AVPlayerItem is ready to play", posInSeconds);\n' +
        '            [self tryApplyPendingSeekForMediaId:mediaId attempt:0];\n' +
        '        } else {\n' +
        '            NSString* errMsg = @"AVPlayerItem cannot service a seek request with a completion handler until its status is AVPlayerItemStatusReadyToPlay.";\n' +
        '            [self onStatus:MEDIA_ERROR mediaId:mediaId param:\n' +
        '              [self createAbortError:errMsg]];\n' +
        '        }';
    return src.replace(anchor, replacement);
}

/**
 * Applies the deferred seek once the item is ready. Polls rather than using KVO
 * on purpose: a mis-balanced KVO removal crashes the app, which would be a far
 * worse failure than the bug being fixed. Self-cancels as soon as the track is
 * released, superseded, or the seek lands.
 */
function patchAddPendingSeekMethods(src) {
    if (src.indexOf('tryApplyPendingSeekForMediaId') !== -1 && src.indexOf('- (void)tryApplyPendingSeekForMediaId') !== -1) {
        return src;
    }
    const anchor = '-(void)itemDidFinishPlaying:(NSNotification *) notification {';
    if (src.indexOf(anchor) === -1) {
        return src;
    }
    const methods =
        '// Applies a seek that arrived before the streamed AVPlayerItem could service\n' +
        '// one (see seekToAudio:). Equivalent to Android replaying seekOnPrepared from\n' +
        '// onPrepared. Retries on the main queue until the item is ready, then seeks\n' +
        '// preserving the current playback rate. Never reports an error: a deferred\n' +
        '// resume seek must not be able to tear down playback.\n' +
        '#define CDVSOUND_PENDING_SEEK_MAX_ATTEMPTS 60\n' +
        '#define CDVSOUND_PENDING_SEEK_RETRY_SECONDS 0.25\n' +
        '\n' +
        '- (void)tryApplyPendingSeekForMediaId:(NSString*)mediaId attempt:(int)attempt\n' +
        '{\n' +
        '    CDVAudioFile* audioFile = [[self soundCache] objectForKey:mediaId];\n' +
        '    if (audioFile == nil || audioFile.pendingSeek == nil) {\n' +
        '        return; // released, or the seek was superseded/applied already\n' +
        '    }\n' +
        '    AVPlayerItem* item = audioFile.playerItem;\n' +
        '    if (item == nil || avPlayer == nil || avPlayer.currentItem != item) {\n' +
        '        audioFile.pendingSeek = nil;\n' +
        '        return; // another track owns the shared player now\n' +
        '    }\n' +
        '    if (item.status == AVPlayerItemStatusFailed) {\n' +
        '        audioFile.pendingSeek = nil;\n' +
        '        NSLog(@"Dropping deferred seek: the AVPlayerItem failed to load");\n' +
        '        return;\n' +
        '    }\n' +
        '\n' +
        '    BOOL isReadyToSeek = (avPlayer.status == AVPlayerStatusReadyToPlay) && (item.status == AVPlayerItemStatusReadyToPlay);\n' +
        '    if (isReadyToSeek) {\n' +
        '        double posInSeconds = [audioFile.pendingSeek doubleValue] / 1000;\n' +
        '        audioFile.pendingSeek = nil;\n' +
        '\n' +
        '        int32_t timeScale = item.asset.duration.timescale;\n' +
        '        if (timeScale <= 0) {\n' +
        '            timeScale = 1000;\n' +
        '        }\n' +
        '        CMTime timeToSeek = CMTimeMakeWithSeconds(posInSeconds, timeScale);\n' +
        '        AVPlayer* player = avPlayer;\n' +
        '        float currentPlaybackRate = player.rate;\n' +
        '        BOOL wasPlaying = (currentPlaybackRate > 0 && !player.error);\n' +
        '\n' +
        '        NSLog(@"Applying deferred seek to %.3fs", posInSeconds);\n' +
        '        [player seekToTime: timeToSeek\n' +
        '           toleranceBefore: kCMTimeZero\n' +
        '            toleranceAfter: kCMTimeZero\n' +
        '         completionHandler: ^(BOOL finished) {\n' +
        '             if (finished && wasPlaying && player.currentItem == item) {\n' +
        '                 // [play] resets the rate to 1, so restore it afterwards.\n' +
        '                 [player play];\n' +
        '                 [player setRate:currentPlaybackRate];\n' +
        '             }\n' +
        '         }];\n' +
        '        [self onStatus:MEDIA_POSITION mediaId:mediaId param:@(posInSeconds)];\n' +
        '        return;\n' +
        '    }\n' +
        '\n' +
        '    if (attempt >= CDVSOUND_PENDING_SEEK_MAX_ATTEMPTS) {\n' +
        '        audioFile.pendingSeek = nil;\n' +
        '        NSLog(@"Giving up on deferred seek: item never became ready to play");\n' +
        '        return;\n' +
        '    }\n' +
        '    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(CDVSOUND_PENDING_SEEK_RETRY_SECONDS * NSEC_PER_SEC)),\n' +
        '                   dispatch_get_main_queue(), ^{\n' +
        '        [self tryApplyPendingSeekForMediaId:mediaId attempt:(attempt + 1)];\n' +
        '    });\n' +
        '}\n' +
        '\n';
    return src.replace(anchor, methods + anchor);
}

function patchRelease(src) {
    const anchor =
        '            if (avPlayer != nil) {\n' +
        '                [avPlayer pause];\n' +
        '                avPlayer = nil;\n' +
        '            }';
    if (src.indexOf(anchor) === -1) {
        return src;
    }
    const replacement =
        '            audioFile.pendingSeek = nil;\n' +
        '            if (audioFile.playerItem != nil) {\n' +
        '                [[NSNotificationCenter defaultCenter] removeObserver:self name:AVPlayerItemDidPlayToEndTimeNotification object:audioFile.playerItem];\n' +
        '                [[NSNotificationCenter defaultCenter] removeObserver:self name:AVPlayerItemPlaybackStalledNotification object:audioFile.playerItem];\n' +
        '            }\n' +
        '            // Only tear down the shared player if it still belongs to this track.\n' +
        '            if (avPlayer != nil && (audioFile.playerItem == nil || avPlayer.currentItem == audioFile.playerItem)) {\n' +
        '                [avPlayer pause];\n' +
        '                avPlayer = nil;\n' +
        '            }';
    return src.replace(anchor, replacement);
}

function patchNotificationHandlers(src) {
    src = src.replace(
        '-(void)itemDidFinishPlaying:(NSNotification *) notification {\n    // Will be called when AVPlayer finishes playing playerItem',
        '-(void)itemDidFinishPlaying:(NSNotification *) notification {\n' +
        '    // One avPlayer/currMediaId pair is shared by every track, so a late\n' +
        '    // notification from a just-stopped item would be reported against whichever\n' +
        '    // track started next. Ignore anything that is no longer current.\n' +
        '    if (avPlayer == nil || notification.object != avPlayer.currentItem) {\n' +
        '        return;\n' +
        '    }\n' +
        '    // Will be called when AVPlayer finishes playing playerItem'
    );
    // A buffer stall is transient: AVPlayer resumes by itself and Android reports
    // nothing here, so reporting a fatal error broke playback on slow networks.
    src = src.replace(
        '-(void)itemStalledPlaying:(NSNotification *) notification {\n' +
        '    // Will be called when playback stalls due to buffer empty\n' +
        '    NSLog(@"Stalled playback");\n' +
        '    NSString* errMsg = @"stalled_playback";\n' +
        '    NSString* mediaId = self.currMediaId;\n' +
        '    [self onStatus:MEDIA_ERROR mediaId:mediaId param:\n' +
        '     [self createAbortError:errMsg]];\n' +
        '}',
        '-(void)itemStalledPlaying:(NSNotification *) notification {\n' +
        '    // Called when playback stalls because the buffer ran dry. This is transient:\n' +
        '    // AVPlayer resumes on its own once it refills, and Android reports nothing\n' +
        '    // for the equivalent state. Reporting MEDIA_ERROR here made the JS layer\n' +
        '    // treat a slow connection as a fatal error and tear playback down\n' +
        '    // mid-track, which is especially likely because create: sets\n' +
        '    // automaticallyWaitsToMinimizeStalling = NO. Log only.\n' +
        '    NSLog(@"Stalled playback (buffering); waiting for AVPlayer to resume");\n' +
        '}'
    );
    return src;
}

function patchStatusLogging(src) {
    if (src.indexOf('[CDVSound] status') !== -1) {
        return src;
    }
    return src.replace(
        '- (void)onStatus:(CDVMediaMsg)what mediaId:(NSString*)mediaId param:(NSObject*)param\n{\n',
        '- (void)onStatus:(CDVMediaMsg)what mediaId:(NSString*)mediaId param:(NSObject*)param\n{\n' +
        '#ifdef DEBUG\n' +
        '    // Makes the native event sequence visible in the device/simulator log,\n' +
        '    // which is how the resume-seek bug was pinned down. Debug builds only.\n' +
        '    NSLog(@"[CDVSound] status msgType=%lu mediaId=%@ value=%@", (unsigned long)what, mediaId, param);\n' +
        '#endif\n'
    );
}

function patchM(src) {
    src = patchSynthesize(src);
    src = patchCreate(src);
    src = patchStopPlayingAudio(src);
    src = patchSeekToAudio(src);
    src = patchAddPendingSeekMethods(src);
    src = patchRelease(src);
    src = patchNotificationHandlers(src);
    src = patchStatusLogging(src);
    return src;
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------
function patchFile(file, patchFn) {
    if (!fs.existsSync(file)) {
        return false;
    }
    const before = fs.readFileSync(file, 'utf8');
    const after = patchFn(before);
    if (after === before) {
        return false;
    }
    fs.writeFileSync(file, after, 'utf8');
    return true;
}

/**
 * Verifies every intended change is present, so a silently-failed anchor match
 * (e.g. after a plugin upgrade) is loud instead of shipping the bug again.
 */
function verify(file) {
    const src = fs.readFileSync(file, 'utf8');
    const required = [
        ['deferred seek applier', '- (void)tryApplyPendingSeekForMediaId'],
        ['deferred seek on early seek', 'audioFile.pendingSeek = @(position);'],
        ['non-fatal stall', 'Stalled playback (buffering)'],
        ['stale finish guard', 'notification.object != avPlayer.currentItem'],
        ['per-track item', 'audioFile.playerItem = playerItem;']
    ];
    const missing = required.filter((r) => src.indexOf(r[1]) === -1).map((r) => r[0]);
    // The stock plugin still reports an error for a genuinely un-seekable item
    // with no cached track, so only the *early-seek* branch should be gone.
    if (src.indexOf('} else if (audioFile != nil && audioFile.playerItem != nil) {') === -1) {
        missing.push('early-seek branch');
    }
    return missing;
}

function run(projectRoot) {
    const headers = [
        'plugins/cordova-plugin-media/src/ios/CDVSound.h',
        'platforms/ios/NA Danmark/Plugins/cordova-plugin-media/CDVSound.h'
    ];
    const impls = [
        'plugins/cordova-plugin-media/src/ios/CDVSound.m',
        'platforms/ios/NA Danmark/Plugins/cordova-plugin-media/CDVSound.m'
    ];
    headers.forEach((rel) => {
        if (patchFile(path.join(projectRoot, rel), patchHeader)) {
            console.log('[patch-ios-media] patched ' + rel);
        }
    });
    let failed = false;
    impls.forEach((rel) => {
        const abs = path.join(projectRoot, rel);
        if (patchFile(abs, patchM)) {
            console.log('[patch-ios-media] patched ' + rel);
        }
        if (fs.existsSync(abs)) {
            const missing = verify(abs);
            if (missing.length > 0) {
                console.error('[patch-ios-media] ERROR: ' + rel +
                    ' is missing: ' + missing.join(', ') +
                    '. cordova-plugin-media may have changed upstream — re-check the anchors.');
                failed = true;
            }
        }
    });
    if (failed) {
        process.exitCode = 1;
    }
}

// Works both as a cordova hook (module.exports) and standalone (node scripts/...).
module.exports = (context) => {
    const root = (context && context.opts && context.opts.projectRoot) || process.cwd();
    run(root);
};

if (require.main === module) {
    run(process.cwd());
}
