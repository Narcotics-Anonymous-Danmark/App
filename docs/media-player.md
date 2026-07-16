# Media Player — cross-platform / cross-stack contract

The app has two long-form audio features: **audio books** (books split into
chapters) and **speaks** (single recorded talks). Both play through ONE shared
media player with two implementations that must behave identically:

| Stack                          | Implementation                                   |
| ------------------------------ | ------------------------------------------------ |
| Cordova / Angular / TypeScript | `src/app/media-player/` (current app)            |
| Flutter / Dart                 | `flutter/na_media_player/` (future app)          |

This document is the contract both implement. Change behaviour here first,
then in both implementations.

## Requirements

1. **Background playback.** Audio keeps playing with the screen off or locked,
   and is never stopped by the OS after N minutes. Playback stops only when the
   user stops it or the playlist finishes. This rules out webview `<audio>`
   playback — both stacks use native players:
   - TypeScript: `cordova-plugin-media` (AVPlayer / MediaPlayer) +
     `UIBackgroundModes: audio` (iOS) + `WAKE_LOCK`/foreground-service
     permissions and a media-session notification via
     `cordova-plugin-music-controls2` (Android).
   - Dart: `just_audio` (AVPlayer / ExoPlayer) + `audio_service`
     (foreground service + media session).
2. **Lock-screen / notification controls.** Play/pause always; previous/next
   chapter for books; close/stop.
3. **Single player.** Starting any track stops whatever else was playing
   (after saving its resume point). The player UI is global and survives
   page navigation.
4. **Auto-advance.** When a book chapter ends, the next chapter starts
   automatically. When the last track ends, playback stops.

## Data model

```
MediaTrack    { id, title, url, durationLabel? }
MediaPlaylist { id, type: 'book' | 'speak', title, coverUrl?, tracks[] }
```

- Track `id` = the audio URL (the only stable identifier in the source data).
- Book playlist `id` = the book slug: `basic-text`, `how-and-why`,
  `step-working-guides`. Chapter lists come from `src/assets/data/<slug>.json`.
- Speak playlist `id` = the speak's `audioUrl` (from the WordPress `/speaks`
  endpoint); a speak playlist has exactly one track.

## Resume points

**Granularity — this is the key rule:**

- **Books: one resume point per BOOK** — the chapter index + position within
  it. Not one per chapter: starting chapter 5 moves the book's single resume
  point to chapter 5, and "continue" always returns to the last place in the
  whole book.
- **Speaks: one resume point per FILE** (per `audioUrl`).

**Storage.** One entry per playlist in the stack's key-value store
(Ionic Storage / SharedPreferences+NSUserDefaults):

```
key   = mediaResume.<type>.<playlistId>      e.g. mediaResume.book.basic-text
value = { "trackId": "<url>", "trackIndex": 7, "position": 754, "updatedAt": "2026-07-16T12:34:56.000Z" }
```

`position` is whole seconds. `trackId` guards against the chapter list
changing: on restore, if `tracks[trackIndex].id != trackId`, look the track up
by id; if it is gone, discard the point.

**When to save:**
- every 5 seconds while playing;
- on pause, stop, seek, and manual track change;
- when the app is sent to the background;
- on auto-advance (the point moves to the new chapter).

**When to restore** — in `play(playlist, trackIndex?)`:
- `trackIndex` omitted ("continue" button / speak tap): start at the resume
  point's track + position, else track 0 at 0:00.
- `trackIndex` given (chapter tap): play that chapter; restore the saved
  position only if the resume point is on that same chapter, else start at 0.
- Positions under 3 seconds are treated as "start from the beginning".
- Tapping the already-playing track toggles play/pause instead of restarting.

**When to clear:** when the final track of the playlist finishes. Stopping or
closing the player never clears the point.

## Migration between stacks

The key/value format is identical, but the physical stores differ (Ionic
Storage uses IndexedDB/SQLite inside the webview; Flutter uses
SharedPreferences/NSUserDefaults). Moving existing users to the Flutter app
requires a one-time export/import of `mediaResume.*` keys (plus the other
Ionic Storage keys: `language`, `theme`, `cleanDateProfiles`, ...). Plan this
as part of the Flutter migration.

## Cordova build notes

- New plugins (in `config*.xml` and `package*.json`): `cordova-plugin-media`,
  `cordova-plugin-music-controls2`.
- iOS: `UIBackgroundModes: audio` is injected into the Info.plist from
  `config.xml` / `config.ios.xml`.
- Android: `WAKE_LOCK`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
  and `POST_NOTIFICATIONS` permissions are injected into the manifest from
  `config.xml` / `config.android.xml`. On Android 13+ `POST_NOTIFICATIONS` is a
  *runtime* permission; the player requests it lazily the first time playback
  starts (via `cordova-plugin-local-notification`'s `requestPermission`, whose
  permission is `POST_NOTIFICATIONS`) so the media-controls notification and its
  foreground service can show. Audio plays whether or not it is granted, but the
  foreground service (which guarantees the process survives long backgrounding
  under memory pressure) needs the notification.
- The Android app scheme must be `https://localhost` (the cordova-android
  default), NOT `ionic://`. `ionic` as the scheme makes cordova-android reject
  the bridge origin (`gap_init called from restricted origin`), so `deviceready`
  never fires and no native plugin — including the media player — works. The
  `scheme`/`hostname` preferences are therefore iOS-only (set inside
  `<platform name="ios">`), never at the top level.
- If `cordova-plugin-music-controls2` ever breaks a platform build, the app
  still works without it — the player feature-detects `window.MusicControls`
  and degrades to no lock-screen buttons (audio itself keeps playing).
- Browser development (`ionic serve`): the player falls back to HTML5 audio
  automatically (no background guarantees, dev only).
