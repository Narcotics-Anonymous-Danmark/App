#!/usr/bin/env node
/**
 * Patches cordova-plugin-music-controls2@3.0.7, which is the latest published
 * version and cannot be shipped unmodified by this app. 3.0.7 predates Android 14
 * hardening, and its iOS Now Playing integration stops at title/artist — so the
 * lock screen shows the track but no working timeline or transport buttons.
 *
 * ANDROID (target SDK 35)
 *
 *   1. registerReceiver() is called without the RECEIVER_EXPORTED /
 *      RECEIVER_NOT_EXPORTED flag Android 14 makes mandatory -> SecurityException
 *      on initialize, so the media notification / foreground service never start.
 *      Fix: route the calls through androidx ContextCompat.registerReceiver with
 *      RECEIVER_EXPORTED (handles the API-level branching, compiles to minSdk 26).
 *
 *   2. The notification actions and the media-button receiver build PendingIntents
 *      from *implicit* intents (new Intent("music-controls-...")) with FLAG_MUTABLE.
 *      Android 14 disallows mutable + implicit PendingIntents -> IllegalArgumentException
 *      that crashes the activity in a restart loop. Fix: make the intents explicit
 *      by setting the package; explicit + mutable is allowed, so the media button
 *      keeps the mutability it needs, and the broadcasts are delivered to our own
 *      dynamically-registered receiver.
 *
 * IOS (MPNowPlayingInfoCenter / MPRemoteCommandCenter)
 *
 *   3. updateIsPlaying: rebuilt every now-playing value from MusicControlsInfo,
 *      but the JS wrapper only sends { isPlaying } — so every pause/resume wrote
 *      elapsed = 0 and reset the lock-screen playhead to 0:00. Fix: only write the
 *      keys the call actually supplied, and accept an optional duration.
 *
 *   4. create: wrote the timeline keys as ints/BOOL and nothing else. iOS needs
 *      duration + elapsed + playbackRate as doubles to draw the timeline, and it
 *      needs MediaType/IsLiveStream/DefaultPlaybackRate to render as a normal
 *      audio player rather than a live stream. Fix: write the full set. This is
 *      what lets iOS advance the playhead on its own while the webview is frozen
 *      in the background.
 *
 *   5. registerMusicControlsEventListener only ever *added* command targets and
 *      never disabled a command. MediaPlayerService calls create() again on every
 *      track change and metadata refresh, so one lock-screen tap fired the JS
 *      handler once per create() ever made, and hasPrev/hasNext from an earlier
 *      track left dead buttons enabled (a book starting at chapter 1 could never
 *      enable "previous" at all, because the flag was false on the first create).
 *      Fix: remove before adding, and explicitly enable *or* disable every command.
 *      Also registers skip-forward/backward, change-playback-position (scrubbing)
 *      and toggle-play-pause, and enforces the plugin's documented precedence —
 *      iOS has three transport slots and shows either prev/next track or
 *      skip back/forward, so skipping wins and track commands are switched off.
 *
 *   6. deregisterMusicControlsEventListener removed the wrong notification
 *      observer name ("receivedEvent"), left play/pause targets attached, and left
 *      a stale entry on the lock screen after the player was closed.
 *
 *   7. createCoverArtwork could not resolve a cover bundled with the web assets.
 *      Android already resolves those out of www/ (getBitmapFromLocal), iOS only
 *      looked in Documents, so a bundled cover never reached the lock screen. Fix:
 *      look in <bundle>/www first, use the non-deprecated MPMediaItemArtwork
 *      initialiser so iOS can request the size it needs, and cache the last cover
 *      so a metadata refresh does not re-download it.
 *
 * Runs as a cordova before_compile hook: `cordova prepare` re-copies the plugin
 * into platforms/ on every build, so this re-applies (idempotently) after each
 * copy. It also patches the plugin source at rest so a fresh checkout is correct
 * before the first build. See docs/media-player.md.
 */
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Android — MusicControls.java / MusicControlsNotification.java
// ---------------------------------------------------------------------------

const CONTEXTCOMPAT_IMPORT = 'import androidx.core.content.ContextCompat;';
const REGISTER_RE =
    /context\.registerReceiver\(\(BroadcastReceiver\)mMessageReceiver, new IntentFilter\(([^;]*?)\)\);/g;
// Implicit "music-controls-*" intents that must become explicit. Matches both
// new Intent("music-controls-play") and new Intent(SomeVar) is NOT matched — only
// the string-action form the plugin uses.
const IMPLICIT_INTENT_RE = /new Intent\((\"music-controls-[a-z-]+\")\)(?!\.setPackage)/g;

function patchRegisterReceiver(src) {
    if (src.indexOf('ContextCompat.registerReceiver') !== -1 || !REGISTER_RE.test(src)) {
        return src;
    }
    REGISTER_RE.lastIndex = 0;
    src = src.replace(
        REGISTER_RE,
        'ContextCompat.registerReceiver(context, (BroadcastReceiver)mMessageReceiver, new IntentFilter($1), ContextCompat.RECEIVER_EXPORTED);'
    );
    if (src.indexOf(CONTEXTCOMPAT_IMPORT) === -1) {
        src = src.replace(
            'package com.homerours.musiccontrols;',
            'package com.homerours.musiccontrols;\n\n' + CONTEXTCOMPAT_IMPORT
        );
    }
    return src;
}

function patchImplicitIntents(src) {
    // context is in scope everywhere these intents are built.
    return src.replace(IMPLICIT_INTENT_RE, 'new Intent($1).setPackage(context.getPackageName())');
}

function patchJava(src) {
    return patchImplicitIntents(patchRegisterReceiver(src));
}

// ---------------------------------------------------------------------------
// Objective-C helpers
//
// The iOS patches replace whole method bodies. Matching them verbatim would tie
// the patch to the plugin's exact whitespace (it has trailing spaces on blank
// lines), so instead we find the signature and scan for the brace that closes
// it, skipping string literals and comments.
// ---------------------------------------------------------------------------

function endOfBlock(src, open) {
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        const c = src[i];
        if (c === '/' && src[i + 1] === '/') {
            i = src.indexOf('\n', i);
            if (i === -1) {
                return -1;
            }
            continue;
        }
        if (c === '/' && src[i + 1] === '*') {
            const end = src.indexOf('*/', i + 2);
            if (end === -1) {
                return -1;
            }
            i = end + 1;
            continue;
        }
        if (c === '"' || c === '\'') {
            i++;
            while (i < src.length && src[i] !== c) {
                if (src[i] === '\\') {
                    i++;
                }
                i++;
            }
            continue;
        }
        if (c === '{') {
            depth++;
        } else if (c === '}') {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}

/**
 * Replaces the body of the method whose declaration is `signature` (which must
 * end with its opening brace). `body` is the replacement including the braces.
 * Returns the source unchanged when the signature is gone, so verify() reports it.
 */
function replaceMethod(src, signature, body) {
    const start = src.indexOf(signature);
    if (start === -1) {
        return src;
    }
    const open = start + signature.length - 1;
    const close = endOfBlock(src, open);
    if (close === -1) {
        return src;
    }
    return src.slice(0, open) + body + src.slice(close + 1);
}

// ---------------------------------------------------------------------------
// iOS — MusicControls.m
// ---------------------------------------------------------------------------

const COVER_CACHE_STATICS =
    '\n' +
    '// The last cover handed to iOS, keyed by the URI it came from. A chapter change\n' +
    '// or a duration refresh re-sends the same cover, and resolving one can mean a\n' +
    '// synchronous download, so it is resolved at most once. create: runs on a\n' +
    '// background queue, so access is serialised on the class object.\n' +
    'static NSString * cachedCoverUri = nil;\n' +
    'static MPMediaItemArtwork * cachedCoverArtwork = nil;\n';

const CREATE_BODY = `{
    NSDictionary * musicControlsInfoDict = [command.arguments objectAtIndex:0];
    MusicControlsInfo * musicControlsInfo = [[MusicControlsInfo alloc] initWithDictionary:musicControlsInfoDict];
    musicControlsSettings = musicControlsInfo;

    if (!NSClassFromString(@"MPNowPlayingInfoCenter")) {
        return;
    }

    [self.commandDelegate runInBackground:^{
        MPNowPlayingInfoCenter * nowPlayingInfoCenter = [MPNowPlayingInfoCenter defaultCenter];
        NSMutableDictionary * updatedNowPlayingInfo = [NSMutableDictionary dictionaryWithDictionary:nowPlayingInfoCenter.nowPlayingInfo];

        MPMediaItemArtwork * mediaItemArtwork = [self createCoverArtwork:[musicControlsInfo cover]];
        if (mediaItemArtwork != nil) {
            [updatedNowPlayingInfo setObject:mediaItemArtwork forKey:MPMediaItemPropertyArtwork];
        } else {
            // Drop the previous item's cover rather than showing it beside a track
            // it does not belong to.
            [updatedNowPlayingInfo removeObjectForKey:MPMediaItemPropertyArtwork];
        }

        [updatedNowPlayingInfo setObject:[musicControlsInfo artist] forKey:MPMediaItemPropertyArtist];
        [updatedNowPlayingInfo setObject:[musicControlsInfo track] forKey:MPMediaItemPropertyTitle];
        [updatedNowPlayingInfo setObject:[musicControlsInfo album] forKey:MPMediaItemPropertyAlbumTitle];

        // iOS draws the lock-screen timeline from duration + elapsed, and advances
        // the playhead itself from the playback rate — which is the only thing that
        // can move it while the webview is suspended in the background. Written as
        // doubles: MPNowPlayingInfoCenter documents these as floating point, and the
        // scrubber position is derived from their ratio.
        [updatedNowPlayingInfo setObject:@((double)[musicControlsInfo duration]) forKey:MPMediaItemPropertyPlaybackDuration];
        [updatedNowPlayingInfo setObject:@((double)[musicControlsInfo elapsed]) forKey:MPNowPlayingInfoPropertyElapsedPlaybackTime];
        [updatedNowPlayingInfo setObject:@([musicControlsInfo isPlaying] ? 1.0 : 0.0) forKey:MPNowPlayingInfoPropertyPlaybackRate];
        [updatedNowPlayingInfo setObject:@(1.0) forKey:MPNowPlayingInfoPropertyDefaultPlaybackRate];
        // Without these two iOS can fall back to its live-stream presentation, which
        // has no timeline at all.
        [updatedNowPlayingInfo setObject:@(MPNowPlayingInfoMediaTypeAudio) forKey:MPNowPlayingInfoPropertyMediaType];
        [updatedNowPlayingInfo setObject:@(NO) forKey:MPNowPlayingInfoPropertyIsLiveStream];

        nowPlayingInfoCenter.nowPlayingInfo = updatedNowPlayingInfo;
    }];

    [self registerMusicControlsEventListener];
}`;

const UPDATE_IS_PLAYING_BODY = `{
    NSDictionary * musicControlsInfoDict = [command.arguments objectAtIndex:0];

    if (!NSClassFromString(@"MPNowPlayingInfoCenter")) {
        return;
    }

    MPNowPlayingInfoCenter * nowPlayingCenter = [MPNowPlayingInfoCenter defaultCenter];
    NSMutableDictionary * updatedNowPlayingInfo = [NSMutableDictionary dictionaryWithDictionary:nowPlayingCenter.nowPlayingInfo];

    // Only touch the keys this call actually carries. Reading them all through
    // MusicControlsInfo meant updateIsPlaying(isPlaying) — which sends no elapsed —
    // wrote elapsed = 0, so the lock-screen playhead jumped back to 0:00 on every
    // pause and resume.
    id isPlaying = [musicControlsInfoDict objectForKey:@"isPlaying"];
    if ([isPlaying isKindOfClass:[NSNumber class]]) {
        [updatedNowPlayingInfo setObject:@([isPlaying boolValue] ? 1.0 : 0.0) forKey:MPNowPlayingInfoPropertyPlaybackRate];
    }
    id elapsed = [musicControlsInfoDict objectForKey:@"elapsed"];
    if ([elapsed isKindOfClass:[NSNumber class]]) {
        [updatedNowPlayingInfo setObject:@([elapsed doubleValue]) forKey:MPNowPlayingInfoPropertyElapsedPlaybackTime];
    }
    id duration = [musicControlsInfoDict objectForKey:@"duration"];
    if ([duration isKindOfClass:[NSNumber class]]) {
        [updatedNowPlayingInfo setObject:@([duration doubleValue]) forKey:MPMediaItemPropertyPlaybackDuration];
    }

    nowPlayingCenter.nowPlayingInfo = updatedNowPlayingInfo;
}`;

const COVER_ARTWORK_BODY = `{
    if (coverUri == nil || [coverUri isEqualToString:@""]) {
        return nil;
    }

    @synchronized ([MusicControls class]) {
        if (cachedCoverArtwork != nil && [cachedCoverUri isEqualToString:coverUri]) {
            return cachedCoverArtwork;
        }
    }

    UIImage * coverImage = nil;

    if ([coverUri hasPrefix:@"http://"] || [coverUri hasPrefix:@"https://"]) {
        NSURL * coverImageUrl = [NSURL URLWithString:coverUri];
        NSData * coverImageData = [NSData dataWithContentsOfURL:coverImageUrl];

        coverImage = [UIImage imageWithData:coverImageData];
    }
    else if ([coverUri hasPrefix:@"file://"]) {
        NSString * fullCoverImagePath = [coverUri stringByReplacingOccurrencesOfString:@"file://" withString:@""];

        if ([[NSFileManager defaultManager] fileExistsAtPath:fullCoverImagePath]) {
            coverImage = [[UIImage alloc] initWithContentsOfFile:fullCoverImagePath];
        }
    }
    else {
        // A path relative to the web root, e.g. "assets/img/cover.png". Android
        // resolves these out of the bundled www/ (getBitmapFromLocal); iOS only
        // looked in Documents, so a cover shipped with the app never appeared.
        NSString * relativeCoverPath = coverUri;
        while ([relativeCoverPath hasPrefix:@"./"] || [relativeCoverPath hasPrefix:@"/"]) {
            relativeCoverPath = [relativeCoverPath substringFromIndex:([relativeCoverPath hasPrefix:@"./"] ? 2 : 1)];
        }
        NSString * bundleCoverPath = [NSString stringWithFormat:@"%@/www/%@", [[NSBundle mainBundle] resourcePath], relativeCoverPath];
        if ([[NSFileManager defaultManager] fileExistsAtPath:bundleCoverPath]) {
            coverImage = [[UIImage alloc] initWithContentsOfFile:bundleCoverPath];
        }

        if (coverImage == nil) {
            NSString * baseCoverImagePath = [NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES) objectAtIndex:0];
            NSString * fullCoverImagePath = [NSString stringWithFormat:@"%@%@", baseCoverImagePath, coverUri];

            if ([[NSFileManager defaultManager] fileExistsAtPath:fullCoverImagePath]) {
                coverImage = [[UIImage alloc] initWithContentsOfFile:fullCoverImagePath];
            }
        }
    }

    if (![self isCoverImageValid:coverImage]) {
        return nil;
    }

    // initWithImage: is deprecated and hands iOS one fixed-size bitmap. The
    // request-handler form lets iOS ask for the size it needs, which is what makes
    // the artwork render sharply on the lock screen and in CarPlay.
    UIImage * artworkImage = coverImage;
    MPMediaItemArtwork * artwork = [[MPMediaItemArtwork alloc] initWithBoundsSize:artworkImage.size requestHandler:^UIImage * _Nonnull (CGSize size) {
        return artworkImage;
    }];

    @synchronized ([MusicControls class]) {
        cachedCoverUri = [coverUri copy];
        cachedCoverArtwork = artwork;
    }

    return artwork;
}`;

const TOGGLE_PLAY_PAUSE_EVENT =
    `- (MPRemoteCommandHandlerStatus) togglePlayPauseEvent:(MPRemoteCommandEvent *)event {
    NSString * action = @"music-controls-toggle-play-pause";
    NSString * jsonAction = [NSString stringWithFormat:@"{\\"message\\":\\"%@\\"}", action];
    CDVPluginResult * pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsString:jsonAction];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:[self latestEventCallbackId]];
    return MPRemoteCommandHandlerStatusSuccess;
}

`;

const REGISTER_BODY = `{
    [[UIApplication sharedApplication] beginReceivingRemoteControlEvents];
    [[NSNotificationCenter defaultCenter] removeObserver:self name:@"musicControlsEventNotification" object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(handleMusicControlsNotification:) name:@"musicControlsEventNotification" object:nil];

    // create() is called again on every track change and metadata refresh, so every
    // command is removed before it is re-added and every command is explicitly
    // enabled *or* disabled. Only adding targets meant one lock-screen tap fired
    // the JS handler once per create() ever made; never disabling meant hasNext
    // from a previous track left a dead button on screen.
    MPRemoteCommandCenter * commandCenter = [MPRemoteCommandCenter sharedCommandCenter];

    [commandCenter.playCommand removeTarget:self];
    [commandCenter.playCommand setEnabled:YES];
    [commandCenter.playCommand addTarget:self action:@selector(playEvent:)];

    [commandCenter.pauseCommand removeTarget:self];
    [commandCenter.pauseCommand setEnabled:YES];
    [commandCenter.pauseCommand addTarget:self action:@selector(pauseEvent:)];

    // Headphone and steering-wheel play/pause button.
    [commandCenter.togglePlayPauseCommand removeTarget:self];
    [commandCenter.togglePlayPauseCommand setEnabled:YES];
    [commandCenter.togglePlayPauseCommand addTarget:self action:@selector(togglePlayPauseEvent:)];

    // iOS renders three transport slots and shows *either* prev/next track or skip
    // back/forward. Enabling both leaves the choice to iOS, so skipping wins and the
    // track commands are switched off — the plugin's documented behaviour, now
    // actually enforced.
    BOOL skipping = musicControlsSettings.hasSkipForward || musicControlsSettings.hasSkipBackward;

    [commandCenter.nextTrackCommand removeTarget:self];
    if (musicControlsSettings.hasNext && !skipping) {
        [commandCenter.nextTrackCommand setEnabled:YES];
        [commandCenter.nextTrackCommand addTarget:self action:@selector(nextTrackEvent:)];
    } else {
        [commandCenter.nextTrackCommand setEnabled:NO];
    }

    [commandCenter.previousTrackCommand removeTarget:self];
    if (musicControlsSettings.hasPrev && !skipping) {
        [commandCenter.previousTrackCommand setEnabled:YES];
        [commandCenter.previousTrackCommand addTarget:self action:@selector(prevTrackEvent:)];
    } else {
        [commandCenter.previousTrackCommand setEnabled:NO];
    }

    [commandCenter.skipForwardCommand removeTarget:self];
    if (musicControlsSettings.hasSkipForward) {
        commandCenter.skipForwardCommand.preferredIntervals = @[@(musicControlsSettings.skipForwardInterval)];
        [commandCenter.skipForwardCommand setEnabled:YES];
        [commandCenter.skipForwardCommand addTarget:self action:@selector(skipForwardEvent:)];
    } else {
        [commandCenter.skipForwardCommand setEnabled:NO];
    }

    [commandCenter.skipBackwardCommand removeTarget:self];
    if (musicControlsSettings.hasSkipBackward) {
        commandCenter.skipBackwardCommand.preferredIntervals = @[@(musicControlsSettings.skipBackwardInterval)];
        [commandCenter.skipBackwardCommand setEnabled:YES];
        [commandCenter.skipBackwardCommand addTarget:self action:@selector(skipBackwardEvent:)];
    } else {
        [commandCenter.skipBackwardCommand setEnabled:NO];
    }

    // Dragging the lock-screen timeline.
    [commandCenter.changePlaybackPositionCommand removeTarget:self];
    if (musicControlsSettings.hasScrubbing) {
        [commandCenter.changePlaybackPositionCommand setEnabled:YES];
        [commandCenter.changePlaybackPositionCommand addTarget:self action:@selector(changedThumbSliderOnLockScreen:)];
    } else {
        [commandCenter.changePlaybackPositionCommand setEnabled:NO];
    }
}`;

const DEREGISTER_BODY = `{
    [[UIApplication sharedApplication] endReceivingRemoteControlEvents];
    // The stock code removed an observer named "receivedEvent", which was never
    // registered, so the real observer stayed attached for the life of the app.
    [[NSNotificationCenter defaultCenter] removeObserver:self name:@"musicControlsEventNotification" object:nil];

    MPRemoteCommandCenter * commandCenter = [MPRemoteCommandCenter sharedCommandCenter];
    NSArray<MPRemoteCommand *> * commands = @[
        commandCenter.playCommand,
        commandCenter.pauseCommand,
        commandCenter.togglePlayPauseCommand,
        commandCenter.nextTrackCommand,
        commandCenter.previousTrackCommand,
        commandCenter.skipForwardCommand,
        commandCenter.skipBackwardCommand,
        commandCenter.changePlaybackPositionCommand
    ];
    for (MPRemoteCommand * command in commands) {
        [command removeTarget:self];
        [command setEnabled:NO];
    }

    // Leave nothing on the lock screen: the player has been closed, so a stale
    // entry there would keep offering transport controls for a released track.
    if (NSClassFromString(@"MPNowPlayingInfoCenter")) {
        [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = nil;
    }

    [self setLatestEventCallbackId:nil];
}`;

function patchIosImplementation(src) {
    if (src.indexOf('static MPMediaItemArtwork * cachedCoverArtwork') === -1) {
        src = src.replace(
            'MusicControlsInfo * musicControlsSettings;\n',
            'MusicControlsInfo * musicControlsSettings;\n' + COVER_CACHE_STATICS
        );
    }
    if (src.indexOf('MPNowPlayingInfoPropertyIsLiveStream') === -1) {
        src = replaceMethod(src, '- (void) create: (CDVInvokedUrlCommand *) command {', CREATE_BODY);
    }
    if (src.indexOf('Only touch the keys this call actually carries') === -1) {
        src = replaceMethod(src, '- (void) updateIsPlaying: (CDVInvokedUrlCommand *) command {', UPDATE_IS_PLAYING_BODY);
    }
    if (src.indexOf('@synchronized ([MusicControls class]) {') === -1) {
        src = replaceMethod(src, '- (MPMediaItemArtwork *) createCoverArtwork: (NSString *) coverUri {', COVER_ARTWORK_BODY);
    }
    if (src.indexOf('togglePlayPauseEvent:(MPRemoteCommandEvent *)event {') === -1) {
        src = src.replace(
            '- (MPRemoteCommandHandlerStatus) nextTrackEvent:(MPRemoteCommandEvent *)event {',
            TOGGLE_PLAY_PAUSE_EVENT + '- (MPRemoteCommandHandlerStatus) nextTrackEvent:(MPRemoteCommandEvent *)event {'
        );
    }
    if (src.indexOf('BOOL skipping = musicControlsSettings.hasSkipForward') === -1) {
        src = replaceMethod(src, '- (void) registerMusicControlsEventListener {', REGISTER_BODY);
    }
    if (src.indexOf('for (MPRemoteCommand * command in commands) {') === -1) {
        src = replaceMethod(src, '- (void) deregisterMusicControlsEventListener {', DEREGISTER_BODY);
    }
    return src;
}

function patchIosHeader(src) {
    // The header declared the skip handlers as returning void while the
    // implementation returns MPRemoteCommandHandlerStatus.
    src = src.replace(
        '- (void) skipForwardEvent: (MPSkipIntervalCommandEvent *) event;',
        '- (MPRemoteCommandHandlerStatus) skipForwardEvent: (MPSkipIntervalCommandEvent *) event;'
    );
    src = src.replace(
        '- (void) skipBackwardEvent: (MPSkipIntervalCommandEvent *) event;',
        '- (MPRemoteCommandHandlerStatus) skipBackwardEvent: (MPSkipIntervalCommandEvent *) event;'
    );
    if (src.indexOf('togglePlayPauseEvent') === -1) {
        src = src.replace(
            '- (MPRemoteCommandHandlerStatus) prevTrackEvent:(MPRemoteCommandEvent *) event;',
            '- (MPRemoteCommandHandlerStatus) prevTrackEvent:(MPRemoteCommandEvent *) event;\n' +
            '- (MPRemoteCommandHandlerStatus) togglePlayPauseEvent:(MPRemoteCommandEvent *) event;\n' +
            '- (MPRemoteCommandHandlerStatus) changedThumbSliderOnLockScreen:(MPChangePlaybackPositionCommandEvent *) event;'
        );
    }
    return src;
}

/**
 * Verifies every intended iOS change is present, so a silently-failed anchor
 * match (e.g. after a plugin upgrade) is loud instead of shipping the bug again.
 */
function verifyIos(src) {
    const required = [
        ['full now-playing info', 'MPNowPlayingInfoPropertyIsLiveStream'],
        ['non-destructive elapsed update', 'Only touch the keys this call actually carries'],
        ['bundled cover art', 'stringWithFormat:@"%@/www/%@"'],
        ['sized cover art', 'initWithBoundsSize:artworkImage.size'],
        ['thread-safe cover cache', '@synchronized ([MusicControls class]) {'],
        ['idempotent command registration', 'BOOL skipping = musicControlsSettings.hasSkipForward'],
        ['scrubbing command', 'changePlaybackPositionCommand addTarget:self'],
        ['toggle play/pause command', 'togglePlayPauseCommand addTarget:self'],
        ['full command teardown', 'for (MPRemoteCommand * command in commands) {']
    ];
    return required.filter((r) => src.indexOf(r[1]) === -1).map((r) => r[0]);
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

const IOS_PLUGIN_DIR = 'platforms/ios/NA Danmark/Plugins/cordova-plugin-music-controls2';

function run(projectRoot) {
    const javaTargets = [
        'plugins/cordova-plugin-music-controls2/src/android/MusicControls.java',
        'plugins/cordova-plugin-music-controls2/src/android/MusicControlsNotification.java',
        'platforms/android/app/src/main/java/com/homerours/musiccontrols/MusicControls.java',
        'platforms/android/app/src/main/java/com/homerours/musiccontrols/MusicControlsNotification.java'
    ];
    const iosHeaders = [
        'plugins/cordova-plugin-music-controls2/src/ios/MusicControls.h',
        IOS_PLUGIN_DIR + '/MusicControls.h'
    ];
    const iosImpls = [
        'plugins/cordova-plugin-music-controls2/src/ios/MusicControls.m',
        IOS_PLUGIN_DIR + '/MusicControls.m'
    ];

    javaTargets.concat(iosHeaders).forEach((rel) => {
        const patchFn = rel.endsWith('.java') ? patchJava : patchIosHeader;
        if (patchFile(path.join(projectRoot, rel), patchFn)) {
            console.log('[patch-music-controls] patched ' + rel);
        }
    });

    let failed = false;
    iosImpls.forEach((rel) => {
        const abs = path.join(projectRoot, rel);
        if (patchFile(abs, patchIosImplementation)) {
            console.log('[patch-music-controls] patched ' + rel);
        }
        if (fs.existsSync(abs)) {
            const missing = verifyIos(fs.readFileSync(abs, 'utf8'));
            if (missing.length > 0) {
                console.error('[patch-music-controls] ERROR: ' + rel +
                    ' is missing: ' + missing.join(', ') +
                    '. cordova-plugin-music-controls2 may have changed upstream — re-check the anchors.');
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
