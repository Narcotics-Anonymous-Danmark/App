#!/usr/bin/env node
/**
 * Patches cordova-plugin-music-controls2@3.0.7, which is the latest published
 * version and cannot be shipped unmodified by this app. 3.0.7 predates both
 * Android 13's media-control rework and Android 14's hardening, and on neither
 * platform does it publish more than title/artist/art — so the lock screen shows
 * the track but no working timeline and only a partial set of transport buttons.
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
 *   3. No timeline. The notification, the lock screen and the Quick Settings media
 *      player draw the seek bar and the elapsed/total labels from the *media
 *      session*: the track length from METADATA_KEY_DURATION, the playhead from the
 *      playback state's position + speed. The plugin published neither — the
 *      metadata carried only title/artist/album/art, and every playback state was
 *      built with PLAYBACK_POSITION_UNKNOWN and no ACTION_SEEK_TO — so Android
 *      showed a blank, greyed-out timeline no matter what the app sent. Worse,
 *      updateIsPlaying rebuilt the state from scratch, so a pause wiped the little
 *      that was there. Fix: MusicControlsInfos learns to read duration/elapsed
 *      (which the JS wrapper has always sent), the values are kept in fields so
 *      *every* state publish carries them, and the position is published with a
 *      playback speed — Android then extrapolates the playhead from its own clock,
 *      which is what keeps the bar moving while the webview is frozen in the
 *      background.
 *
 *   4. updateElapsed was implemented on iOS only; on Android execute() fell through
 *      and did nothing (not even a callback). Fix: implement it — position, an
 *      optional corrected duration and the play state, publishing a new playback
 *      state and refreshing the notification only when the play state actually
 *      flipped. This is the one call the app makes while playing, so it must be
 *      cheap.
 *
 *   5. The transport advertised in the playback state was hard-coded to
 *      play/pause + next/previous. From Android 13 the system media controls build
 *      their buttons from those actions and *ignore* the notification's own, so a
 *      single-track speak got dead previous/next buttons while the skip
 *      backward/forward the app asks for (and iOS shows) had nowhere to appear.
 *      Fix: derive the actions from what create() was given, add ACTION_SEEK_TO for
 *      scrubbing, ACTION_REWIND/FAST_FORWARD for car and Bluetooth remotes, and
 *      declare the ±interval skips as custom actions so Android 13+ renders them.
 *      MediaSessionCallback gains the matching onSeekTo/onRewind/onFastForward/
 *      onCustomAction/onStop handlers.
 *
 *   6. destroy() only cancelled the notification and left the session active with
 *      a stale state and metadata, which leaves a ghost entry in the Quick
 *      Settings media player. Fix: publish STATE_STOPPED, clear the metadata and
 *      deactivate the session; create() reactivates it.
 *
 * IOS (MPNowPlayingInfoCenter / MPRemoteCommandCenter)
 *
 *   7. updateIsPlaying: rebuilt every now-playing value from MusicControlsInfo,
 *      but the JS wrapper only sends { isPlaying } — so every pause/resume wrote
 *      elapsed = 0 and reset the lock-screen playhead to 0:00. Fix: only write the
 *      keys the call actually supplied, and accept an optional duration.
 *
 *   8. create: wrote the timeline keys as ints/BOOL and nothing else. iOS needs
 *      duration + elapsed + playbackRate as doubles to draw the timeline, and it
 *      needs MediaType/IsLiveStream/DefaultPlaybackRate to render as a normal
 *      audio player rather than a live stream. Fix: write the full set. This is
 *      what lets iOS advance the playhead on its own while the webview is frozen
 *      in the background.
 *
 *   9. registerMusicControlsEventListener only ever *added* command targets and
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
 *  10. deregisterMusicControlsEventListener removed the wrong notification
 *      observer name ("receivedEvent"), left play/pause targets attached, and left
 *      a stale entry on the lock screen after the player was closed.
 *
 *  11. createCoverArtwork could not resolve a cover bundled with the web assets.
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
// Method-body helpers (Java and Objective-C)
//
// Several patches replace a whole method body. Matching one verbatim would tie
// the patch to the plugin's exact whitespace (it mixes tabs and spaces, and has
// trailing spaces on blank lines), so instead we find the signature and scan for
// the brace that closes it, skipping string literals and comments.
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
// Android — the media-session timeline
//
// Everything Android renders for a media app comes out of the MediaSession, not
// out of the notification: the notification only points at the session token.
// So the seek bar, the elapsed/total labels and (from Android 13) the transport
// buttons are all driven from the metadata + playback state published below.
// ---------------------------------------------------------------------------

/** Fields and helpers, inserted into MusicControls.java after the last field. */
const ANDROID_SESSION_MEMBERS = `

	// ------------------------------------------------------------------
	// The timeline published to the Android media controls
	//
	// Kept in fields rather than read off each call, because every playback-state
	// publish has to carry the whole picture: PlaybackStateCompat has no partial
	// update, so a play/pause toggle that rebuilt the state from nothing (as the
	// stock plugin did) erased the position and blanked the seek bar.
	//
	// volatile because create() runs on the Cordova thread pool while
	// updateElapsed/updateIsPlaying/destroy arrive on the WebView thread.
	// ------------------------------------------------------------------

	public static final String CUSTOM_ACTION_SKIP_FORWARD = "music-controls-skip-forward";
	public static final String CUSTOM_ACTION_SKIP_BACKWARD = "music-controls-skip-backward";

	/** False until create() runs, and again after destroy(). */
	private volatile boolean hasTrack = false;
	private volatile boolean trackIsPlaying = false;
	/** Track length in ms; 0 while unknown. */
	private volatile long trackDurationMs = 0;
	/** Playhead in ms as of the last publish; Android extrapolates from there. */
	private volatile long trackPositionMs = 0;
	private volatile boolean trackHasPrev = false;
	private volatile boolean trackHasNext = false;
	private volatile boolean trackHasClose = false;
	private volatile boolean trackHasScrubbing = false;
	private volatile boolean trackHasSkipForward = false;
	private volatile boolean trackHasSkipBackward = false;
	private volatile long trackSkipForwardSeconds = 0;
	private volatile long trackSkipBackwardSeconds = 0;

	/** Adopts what create() said about the track that is now current. */
	private void rememberTrack(MusicControlsInfos infos) {
		this.hasTrack = true;
		this.trackDurationMs = infos.duration > 0 ? infos.duration * 1000L : 0L;
		this.trackPositionMs = infos.elapsed > 0 ? infos.elapsed * 1000L : 0L;
		this.trackHasPrev = infos.hasPrev;
		this.trackHasNext = infos.hasNext;
		this.trackHasClose = infos.hasClose;
		this.trackHasScrubbing = infos.hasScrubbing;
		this.trackHasSkipForward = infos.hasSkipForward;
		this.trackHasSkipBackward = infos.hasSkipBackward;
		this.trackSkipForwardSeconds = infos.skipForwardInterval;
		this.trackSkipBackwardSeconds = infos.skipBackwardInterval;
	}

	/**
	 * Takes the session out of the system media controls once the player is
	 * closed. Without this an active session keeps its last state and metadata,
	 * which the Quick Settings media player happily goes on showing after the
	 * notification is gone. create() sets it active again.
	 */
	private void teardownMediaSession() {
		this.hasTrack = false;
		this.trackDurationMs = 0;
		this.trackPositionMs = 0;
		this.trackHasPrev = false;
		this.trackHasNext = false;
		this.trackHasClose = false;
		this.trackHasScrubbing = false;
		this.trackHasSkipForward = false;
		this.trackHasSkipBackward = false;
		setMediaPlaybackState(PlaybackStateCompat.STATE_STOPPED);
		this.mediaSessionCompat.setMetadata(new MediaMetadataCompat.Builder().build());
		this.mediaSessionCompat.setActive(false);
	}

	private static String skipActionLabel(String prefix, long seconds) {
		return prefix + Math.max(1L, seconds) + "s";
	}
`;

const ANDROID_PLAYBACK_STATE_BODY = `{
		final boolean playing = state == PlaybackStateCompat.STATE_PLAYING;
		this.trackIsPlaying = playing;

		long actions = PlaybackStateCompat.ACTION_PLAY_PAUSE
			| PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID
			| PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH
			| (playing ? PlaybackStateCompat.ACTION_PAUSE : PlaybackStateCompat.ACTION_PLAY);

		// From Android 13 the system media controls take their buttons from these
		// actions and ignore the notification's own, so advertising a transport we
		// cannot honour leaves a dead button on screen — which is how a one-track
		// speak used to get previous/next.
		if (this.trackHasPrev) {
			actions |= PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS;
		}
		if (this.trackHasNext) {
			actions |= PlaybackStateCompat.ACTION_SKIP_TO_NEXT;
		}
		if (this.trackHasClose) {
			actions |= PlaybackStateCompat.ACTION_STOP;
		}
		// What makes the seek bar draggable. Meaningless without a known length.
		if (this.trackHasScrubbing && this.trackDurationMs > 0) {
			actions |= PlaybackStateCompat.ACTION_SEEK_TO;
		}
		// How a car head unit, a Bluetooth remote or a watch reaches the same
		// +30s/-15s skip the app and the lock screen offer.
		if (this.trackHasSkipForward) {
			actions |= PlaybackStateCompat.ACTION_FAST_FORWARD;
		}
		if (this.trackHasSkipBackward) {
			actions |= PlaybackStateCompat.ACTION_REWIND;
		}

		PlaybackStateCompat.Builder playbackstateBuilder = new PlaybackStateCompat.Builder();
		playbackstateBuilder.setActions(actions);

		// Android 13+ fills the media-control slots left over after play/pause,
		// previous and next from the session's custom actions — the only way the
		// skip buttons can appear there at all.
		if (this.trackHasSkipBackward) {
			playbackstateBuilder.addCustomAction(new PlaybackStateCompat.CustomAction.Builder(
				CUSTOM_ACTION_SKIP_BACKWARD,
				skipActionLabel("-", this.trackSkipBackwardSeconds),
				android.R.drawable.ic_media_rew).build());
		}
		if (this.trackHasSkipForward) {
			playbackstateBuilder.addCustomAction(new PlaybackStateCompat.CustomAction.Builder(
				CUSTOM_ACTION_SKIP_FORWARD,
				skipActionLabel("+", this.trackSkipForwardSeconds),
				android.R.drawable.ic_media_ff).build());
		}

		// The position is a snapshot taken now (the builder stamps it with
		// SystemClock.elapsedRealtime()), and the speed tells Android how to move it
		// on from there. That extrapolation is the only thing advancing the seek bar
		// while the webview is throttled in the background, and it is why the app
		// only has to re-publish every few seconds.
		playbackstateBuilder.setState(state, this.trackPositionMs, playing ? 1.0f : 0.0f);

		this.mediaSessionCompat.setPlaybackState(playbackstateBuilder.build());
	}`;

// The metadata + state publish at the end of create()'s background runnable.
const ANDROID_CREATE_PUBLISH_RE =
    /mediaSessionCompat\.setMetadata\(metadataBuilder\.build\(\)\);\s*if\s*\(\s*infos\.isPlaying\s*\)\s*setMediaPlaybackState\(PlaybackStateCompat\.STATE_PLAYING\);\s*else\s*setMediaPlaybackState\(PlaybackStateCompat\.STATE_PAUSED\);/;

const ANDROID_CREATE_PUBLISH = `// The track length. Android needs it here to draw the seek bar and the
					// total-time label at all; a negative value is its documented
					// "length unknown" signal, which draws an indeterminate bar rather
					// than a bar stuck at zero.
					metadataBuilder.putLong(MediaMetadataCompat.METADATA_KEY_DURATION,
						infos.duration > 0 ? infos.duration * 1000L : -1L);

					mediaSessionCompat.setMetadata(metadataBuilder.build());

					// A closed player deactivates the session, so playing again has to
					// bring it back or the system controls never reappear.
					if (!mediaSessionCompat.isActive()) {
						mediaSessionCompat.setActive(true);
					}

					rememberTrack(infos);
					setMediaPlaybackState(infos.isPlaying
						? PlaybackStateCompat.STATE_PLAYING
						: PlaybackStateCompat.STATE_PAUSED);`;

const ANDROID_UPDATE_ELAPSED = `else if (action.equals("updateElapsed")){
			// The call the app makes every few seconds while playing, so it stays
			// cheap: a new playback state (which is what moves the seek bar) and a
			// notification rebuild only when the play state actually flipped.
			final JSONObject params = args.getJSONObject(0);
			final double elapsed = params.optDouble("elapsed", Double.NaN);
			if (!Double.isNaN(elapsed) && elapsed >= 0) {
				this.trackPositionMs = Math.round(elapsed * 1000.0d);
			}
			// Optional: the app learns the real length once the media plugin has
			// opened the file, which can correct the estimate create() was given.
			final double duration = params.optDouble("duration", Double.NaN);
			if (!Double.isNaN(duration) && duration > 0) {
				this.trackDurationMs = Math.round(duration * 1000.0d);
			}
			// The JS wrapper sends "" when the caller omitted isPlaying, and
			// optBoolean falls back for anything that is not a boolean.
			final boolean isPlaying = params.optBoolean("isPlaying", this.trackIsPlaying);
			if (this.hasTrack) {
				if (isPlaying != this.trackIsPlaying) {
					this.notification.updateIsPlaying(isPlaying);
				}
				setMediaPlaybackState(isPlaying
					? PlaybackStateCompat.STATE_PLAYING
					: PlaybackStateCompat.STATE_PAUSED);
			}
			callbackContext.success("success");
		}
		else if (action.equals("updateDismissable")){`;

// destroy(): tear the session down as well as the notification.
const ANDROID_DESTROY_RE =
    /(else if \(action\.equals\("destroy"\)\)\{\s*this\.notification\.destroy\(\);\s*this\.mMessageReceiver\.stopListening\(\);)(\s*callbackContext\.success)/;

// onDestroy()/onReset(): same, for a webview reload or an activity teardown.
const ANDROID_ON_DESTROY_RE =
    /(public void onDestroy\(\) \{\s*this\.notification\.destroy\(\);\s*this\.mMessageReceiver\.stopListening\(\);)(\s*this\.unregisterMediaButtonEvent\(\);)/;

function patchAndroidMediaSession(src) {
    if (src.indexOf('CUSTOM_ACTION_SKIP_FORWARD') === -1) {
        src = src.replace(
            'private MediaSessionCallback mMediaSessionCallback = new MediaSessionCallback();\n',
            'private MediaSessionCallback mMediaSessionCallback = new MediaSessionCallback();\n' +
            ANDROID_SESSION_MEMBERS
        );
    }
    if (src.indexOf('ACTION_SEEK_TO') === -1) {
        src = replaceMethod(src, 'private void setMediaPlaybackState(int state) {', ANDROID_PLAYBACK_STATE_BODY);
    }
    // Both replacements below only match the unpatched shape, so re-running is a
    // no-op without needing a marker.
    src = src.replace(ANDROID_CREATE_PUBLISH_RE, ANDROID_CREATE_PUBLISH);
    if (src.indexOf('action.equals("updateElapsed")') === -1) {
        src = src.replace('else if (action.equals("updateDismissable")){', ANDROID_UPDATE_ELAPSED);
    }
    src = src.replace(ANDROID_DESTROY_RE, '$1\n\t\t\tthis.teardownMediaSession();$2');
    src = src.replace(ANDROID_ON_DESTROY_RE, '$1\n\t\tthis.teardownMediaSession();$2');
    return src;
}

// ---------------------------------------------------------------------------
// Android — MusicControlsInfos.java
// ---------------------------------------------------------------------------

const ANDROID_INFOS_FIELDS = `public String notificationIcon;
	/** Track length in seconds; 0 when unknown. */
	public long duration;
	/** Playhead in seconds at the time of the call. */
	public long elapsed;
	public boolean hasScrubbing;
	public boolean hasSkipForward;
	public boolean hasSkipBackward;
	public long skipForwardInterval;
	public long skipBackwardInterval;`;

const ANDROID_INFOS_PARSE = `this.notificationIcon = params.getString("notificationIcon");

		// The timeline and skip settings. The JS wrapper has always sent these —
		// they were simply never read on Android, so there was nothing to draw a
		// seek bar from. optXxx because a caller may legitimately omit them.
		this.duration = Math.round(params.optDouble("duration", 0));
		this.elapsed = Math.round(params.optDouble("elapsed", 0));
		this.hasScrubbing = params.optBoolean("hasScrubbing", false);
		this.hasSkipForward = params.optBoolean("hasSkipForward", false);
		this.hasSkipBackward = params.optBoolean("hasSkipBackward", false);
		this.skipForwardInterval = Math.round(params.optDouble("skipForwardInterval", 0));
		this.skipBackwardInterval = Math.round(params.optDouble("skipBackwardInterval", 0));`;

function patchAndroidInfos(src) {
    if (src.indexOf('public long duration;') === -1) {
        src = src.replace('public String notificationIcon;', ANDROID_INFOS_FIELDS);
    }
    if (src.indexOf('params.optDouble("duration"') === -1) {
        src = src.replace('this.notificationIcon = params.getString("notificationIcon");', ANDROID_INFOS_PARSE);
    }
    return src;
}

// ---------------------------------------------------------------------------
// Android — MediaSessionCallback.java
//
// The session commands the stock callback ignored. Every handler fires the same
// events the JS side already listens for, so MediaPlayerService needs no
// Android-specific branch.
// ---------------------------------------------------------------------------

const ANDROID_CALLBACK_METHODS = `    super.onPlayFromMediaId(mediaId, extras);
  }

  @Override
  public void onSeekTo(long pos) {
    super.onSeekTo(pos);
    // Dragging the seek bar in the notification, on the lock screen or in the
    // Quick Settings media player. Reported in seconds, like the iOS event, so
    // both platforms hand the JS handler the same thing.
    this.emit("{\\"message\\": \\"music-controls-seek-to\\", \\"position\\": " + (pos / 1000.0)
      + ", \\"source\\": \\"music-controls-media-session-seek-to\\"}");
  }

  @Override
  public void onStop() {
    super.onStop();
    this.emitMessage("music-controls-destroy", "music-controls-media-session-stop");
  }

  @Override
  public void onFastForward() {
    super.onFastForward();
    this.emitMessage("music-controls-skip-forward", "music-controls-media-session-fast-forward");
  }

  @Override
  public void onRewind() {
    super.onRewind();
    this.emitMessage("music-controls-skip-backward", "music-controls-media-session-rewind");
  }

  @Override
  public void onCustomAction(String action, Bundle extras) {
    super.onCustomAction(action, extras);
    // The skip buttons Android 13+ renders come back this way. The action name is
    // already the event name, so it is passed straight through.
    if (MusicControls.CUSTOM_ACTION_SKIP_FORWARD.equals(action)
      || MusicControls.CUSTOM_ACTION_SKIP_BACKWARD.equals(action)) {
      this.emitMessage(action, "music-controls-media-session-custom-action");
    }
  }

  /**
   * The callback is single-shot: the JS wrapper re-arms it by calling watch()
   * again from the event handler, so an event with nothing armed is dropped.
   */
  private void emit(String json) {
    if (this.cb != null) {
      this.cb.success(json);
      this.cb = null;
    }
  }

  private void emitMessage(String message, String source) {
    this.emit("{\\"message\\": \\"" + message + "\\", \\"source\\": \\"" + source + "\\"}");
  }`;

function patchAndroidSessionCallback(src) {
    if (src.indexOf('public void onSeekTo(long pos)') !== -1) {
        return src;
    }
    return src.replace('    super.onPlayFromMediaId(mediaId, extras);\n  }', ANDROID_CALLBACK_METHODS);
}

/**
 * Verifies every intended Android change is present, so a silently-failed anchor
 * match (e.g. after a plugin upgrade) is loud instead of shipping the bug again.
 */
const ANDROID_REQUIRED = {
    'MusicControls.java': [
        ['Android 14 receiver flags', 'ContextCompat.registerReceiver'],
        ['explicit broadcast intents', 'setPackage(context.getPackageName())'],
        ['track length in the metadata', 'METADATA_KEY_DURATION'],
        ['published playhead', 'setState(state, this.trackPositionMs'],
        ['scrubbable seek bar', 'ACTION_SEEK_TO'],
        ['derived transport actions', 'if (this.trackHasNext) {'],
        ['skip custom actions', 'CUSTOM_ACTION_SKIP_FORWARD'],
        ['elapsed updates', 'action.equals("updateElapsed")'],
        ['session teardown', 'this.teardownMediaSession();']
    ],
    'MusicControlsNotification.java': [
        ['explicit broadcast intents', 'setPackage(context.getPackageName())']
    ],
    'MusicControlsInfos.java': [
        ['timeline fields', 'params.optDouble("duration"']
    ],
    'MediaSessionCallback.java': [
        ['seek-to handling', 'public void onSeekTo(long pos)'],
        ['custom-action handling', 'public void onCustomAction(String action']
    ]
};

function verifyAndroid(file, src) {
    const required = ANDROID_REQUIRED[path.basename(file)] || [];
    return required.filter((r) => src.indexOf(r[1]) === -1).map((r) => r[0]);
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
const ANDROID_SRC_DIR = 'plugins/cordova-plugin-music-controls2/src/android';
const ANDROID_PLATFORM_DIR = 'platforms/android/app/src/main/java/com/homerours/musiccontrols';

/** Which patches each Android source file gets, in order. */
const ANDROID_FILE_PATCHES = {
    'MusicControls.java': [patchJava, patchAndroidMediaSession],
    'MusicControlsNotification.java': [patchJava],
    'MusicControlsInfos.java': [patchAndroidInfos],
    'MediaSessionCallback.java': [patchAndroidSessionCallback]
};

function patchAndroidFile(file) {
    const chain = ANDROID_FILE_PATCHES[path.basename(file)] || [];
    return (src) => chain.reduce((acc, patch) => patch(acc), src);
}

function reportMissing(rel, missing) {
    console.error('[patch-music-controls] ERROR: ' + rel +
        ' is missing: ' + missing.join(', ') +
        '. cordova-plugin-music-controls2 may have changed upstream — re-check the anchors.');
}

function run(projectRoot) {
    let failed = false;

    const javaTargets = [];
    Object.keys(ANDROID_FILE_PATCHES).forEach((name) => {
        javaTargets.push(ANDROID_SRC_DIR + '/' + name, ANDROID_PLATFORM_DIR + '/' + name);
    });
    const iosHeaders = [
        'plugins/cordova-plugin-music-controls2/src/ios/MusicControls.h',
        IOS_PLUGIN_DIR + '/MusicControls.h'
    ];
    const iosImpls = [
        'plugins/cordova-plugin-music-controls2/src/ios/MusicControls.m',
        IOS_PLUGIN_DIR + '/MusicControls.m'
    ];

    javaTargets.forEach((rel) => {
        const abs = path.join(projectRoot, rel);
        if (patchFile(abs, patchAndroidFile(abs))) {
            console.log('[patch-music-controls] patched ' + rel);
        }
        if (fs.existsSync(abs)) {
            const missing = verifyAndroid(abs, fs.readFileSync(abs, 'utf8'));
            if (missing.length > 0) {
                reportMissing(rel, missing);
                failed = true;
            }
        }
    });

    iosHeaders.forEach((rel) => {
        if (patchFile(path.join(projectRoot, rel), patchIosHeader)) {
            console.log('[patch-music-controls] patched ' + rel);
        }
    });

    iosImpls.forEach((rel) => {
        const abs = path.join(projectRoot, rel);
        if (patchFile(abs, patchIosImplementation)) {
            console.log('[patch-music-controls] patched ' + rel);
        }
        if (fs.existsSync(abs)) {
            const missing = verifyIos(fs.readFileSync(abs, 'utf8'));
            if (missing.length > 0) {
                reportMissing(rel, missing);
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
