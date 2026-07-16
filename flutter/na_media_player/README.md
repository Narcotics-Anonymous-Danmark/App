# na_media_player

Cross-platform background media player for the NA Danmark app — the Dart/Flutter
twin of the TypeScript player in `src/app/media-player`. Both implement the same
behaviour contract, documented in [`docs/media-player.md`](../../docs/media-player.md):

- **Audio books** play as a chapter queue with auto-advance; **speaks** play as
  single files.
- Playback continues with the **screen off/locked** and never stops until the
  user stops it (native playback + foreground service / background audio session,
  no webview timers involved).
- **Lock-screen / notification controls** (play/pause, seek, chapter skip).
- **Resume points**: one per *book* (chapter + position, not per chapter) and
  one per *speak file*, saved every 5 seconds and on pause/stop, restored on
  the next play, cleared when the playlist finishes.

Built on [`just_audio`](https://pub.dev/packages/just_audio) (ExoPlayer/AVPlayer),
[`audio_service`](https://pub.dev/packages/audio_service) (media session +
foreground service) and [`shared_preferences`](https://pub.dev/packages/shared_preferences).

## Usage

```dart
import 'package:na_media_player/na_media_player.dart';

// Once, at app startup (before runApp or in main()):
final player = await NaMediaPlayer.init();

// An audio book (same JSON shape as src/assets/data/basic-text.json):
final book = MediaPlaylist(
  id: 'basic-text',            // stable book id -> resume point per book
  type: MediaPlaylistType.book,
  title: 'Basis Tekst',
  tracks: chapters
      .map((c) => MediaTrack(id: c.url, title: c.title, url: c.url,
                             durationLabel: c.duration))
      .toList(),
);

await player.play(book);              // continue where the user left off
await player.play(book, trackIndex: 3); // or play a specific chapter

// A speak (id = the audio URL -> resume point per file):
final speak = MediaPlaylist(
  id: audioUrl,
  type: MediaPlaylistType.speak,
  title: eventTitle,
  tracks: [MediaTrack(id: audioUrl, title: speakName, url: audioUrl)],
);
await player.play(speak);

// Controls:
await player.togglePlayPause();
await player.seekBy(const Duration(seconds: 30));
await player.next();   // books only
await player.stop();   // keeps the resume point

// UI streams:
player.playbackState.listen((state) { /* position, playing, ... */ });
player.mediaItem.listen((item) { /* current chapter metadata */ });
```

## Platform setup (required for background playback)

### Android — `android/app/src/main/AndroidManifest.xml`

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.WAKE_LOCK" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

  <application ...>
    <service
        android:name="com.ryanheise.audioservice.AudioService"
        android:foregroundServiceType="mediaPlayback"
        android:exported="true">
      <intent-filter>
        <action android:name="android.media.browse.MediaBrowserService" />
      </intent-filter>
    </service>

    <receiver
        android:name="com.ryanheise.audioservice.MediaButtonReceiver"
        android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MEDIA_BUTTON" />
      </intent-filter>
    </receiver>
  </application>
</manifest>
```

The main activity must use `com.ryanheise.audioservice.AudioServiceActivity`
(or an activity that wires `AudioServiceFragmentActivity`) — see the
audio_service README.

### iOS — `ios/Runner/Info.plist`

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

## Keeping the two implementations in sync

Any behaviour change (resume rules, storage keys, auto-advance, lock-screen
controls) must be made in **both**:

| Concern            | TypeScript (Cordova app)                          | Dart (this package)              |
| ------------------ | ------------------------------------------------- | -------------------------------- |
| Models             | `src/app/media-player/media-player.models.ts`     | `lib/src/models.dart`            |
| Resume-point store | `src/app/media-player/resume-points.service.ts`   | `lib/src/resume_point_store.dart`|
| Player engine      | `src/app/media-player/media-player.service.ts`    | `lib/src/na_audio_handler.dart`  |
| App-facing API     | `MediaPlayerService`                              | `lib/src/na_media_player_base.dart` |

and reflected in `docs/media-player.md`.

Note: resume points are stored in each stack's native preference store
(Ionic Storage vs SharedPreferences/NSUserDefaults). The key/value format is
identical, but a migration step is still needed if existing users switch
stacks — see "Migration" in `docs/media-player.md`.
