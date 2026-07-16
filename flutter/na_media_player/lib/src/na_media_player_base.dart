import 'package:audio_service/audio_service.dart';

import 'models.dart';
import 'na_audio_handler.dart';
import 'resume_point_store.dart';

/// App-facing facade over the audio_service handler. Mirrors the public API
/// of the TypeScript MediaPlayerService.
///
/// Create it once at app startup:
///
/// ```dart
/// final player = await NaMediaPlayer.init();
/// ```
///
/// and use it from any screen:
///
/// ```dart
/// await player.play(playlist);            // continue from resume point
/// await player.play(playlist, trackIndex: 3); // play a specific chapter
/// ```
class NaMediaPlayer {
  final NaAudioHandler _handler;
  final ResumePointStore resumePoints;

  NaMediaPlayer._(this._handler, this.resumePoints);

  static Future<NaMediaPlayer> init({ResumePointStore? resumePointStore}) async {
    final store = resumePointStore ?? ResumePointStore();
    final handler = await AudioService.init(
      builder: () => NaAudioHandler(resumePointStore: store),
      config: const AudioServiceConfig(
        androidNotificationChannelId: 'dk.nadanmark.app.audio',
        androidNotificationChannelName: 'Audio playback',
        // Foreground service while playing: Android will not kill playback
        // with the screen off, and it survives well beyond 10 minutes.
        androidNotificationOngoing: true,
        androidStopForegroundOnPause: true,
      ),
    );
    return NaMediaPlayer._(handler, store);
  }

  /// Starts a playlist, restoring its resume point (see docs/media-player.md).
  /// Tapping the already-active track toggles play/pause instead.
  Future<void> play(MediaPlaylist playlist, {int? trackIndex}) async {
    final active = _handler.playlist;
    if (active != null &&
        active.id == playlist.id &&
        (trackIndex == null || trackIndex == _handler.currentIndex)) {
      await togglePlayPause();
      return;
    }
    await _handler.playPlaylist(playlist, startIndex: trackIndex);
  }

  Future<void> togglePlayPause() =>
      _handler.playing ? _handler.pause() : _handler.play();

  Future<void> pause() => _handler.pause();
  Future<void> resume() => _handler.play();

  /// Stops playback and hides the controls. The resume point is kept.
  Future<void> stop() => _handler.stop();

  Future<void> next() => _handler.skipToNext();
  Future<void> previous() => _handler.skipToPrevious();
  Future<void> seekTo(Duration position) => _handler.seek(position);

  Future<void> seekBy(Duration delta) async {
    final position = _handler.playbackState.value.position + delta;
    await _handler.seek(position.isNegative ? Duration.zero : position);
  }

  /// The playlist currently loaded in the player, if any.
  MediaPlaylist? get playlist => _handler.playlist;
  int get currentIndex => _handler.currentIndex;

  /// Streams for building UI (mini player, active-chapter highlight).
  Stream<PlaybackState> get playbackState => _handler.playbackState;
  Stream<MediaItem?> get mediaItem => _handler.mediaItem;
}
