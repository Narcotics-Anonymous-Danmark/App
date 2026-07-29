import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:just_audio/just_audio.dart';

import 'models.dart';
import 'resume_point_store.dart';

/// How often the current position is written to the resume-point store while
/// playing. Same cadence as the TypeScript player.
const Duration resumeSaveInterval = Duration(seconds: 5);

/// A resume position this close to the start is not worth restoring.
const Duration minResumePosition = Duration(seconds: 3);

/// audio_service handler backed by just_audio.
///
/// - Plays a [MediaPlaylist] (audio book chapters or a single speak file) as
///   a gapless queue with lock-screen / notification controls.
/// - Keeps playing with the screen off/locked; playback only stops when the
///   user stops it (or the playlist ends).
/// - Persists resume points through [ResumePointStore]: one per book
///   (chapter + position) and one per speak file, restored on the next play.
///
/// Behaviour contract shared with the TypeScript player: docs/media-player.md.
class NaAudioHandler extends BaseAudioHandler with QueueHandler, SeekHandler {
  final AudioPlayer _player = AudioPlayer();
  final ResumePointStore _resumePoints;

  MediaPlaylist? _playlist;
  Timer? _saveTimer;
  bool _completing = false;

  NaAudioHandler({ResumePointStore? resumePointStore})
      : _resumePoints = resumePointStore ?? ResumePointStore() {
    _player.playbackEventStream.listen(_broadcastState);

    // Keep the lock screen metadata on the current chapter and move the
    // resume point along when the queue auto-advances.
    _player.currentIndexStream.listen((index) {
      if (index == null || _playlist == null) {
        return;
      }
      final items = queue.value;
      if (index < items.length) {
        mediaItem.add(items[index]);
      }
      _persistResumePoint();
    });

    // End of the whole playlist: the listener finished the book/speak, so
    // the resume point is cleared and playback stops.
    _player.processingStateStream.listen((state) async {
      if (state == ProcessingState.completed && _playlist != null) {
        _completing = true;
        await _resumePoints.clear(_playlist!.type, _playlist!.id);
        await stop();
        _completing = false;
      }
    });
  }

  MediaPlaylist? get playlist => _playlist;
  int get currentIndex => _player.currentIndex ?? 0;
  bool get playing => _player.playing;

  /// Starts a playlist.
  ///
  /// - [startIndex] omitted: continue from the playlist's resume point
  ///   (or track 0).
  /// - [startIndex] given: play that track; if it is the resume-point track
  ///   the saved position is restored, otherwise it starts from zero.
  Future<void> playPlaylist(MediaPlaylist playlist, {int? startIndex}) async {
    // Switching away from another active playlist: keep its place first.
    if (_playlist != null && _playlist!.id != playlist.id) {
      await _persistResumePoint();
    }

    final resume = await _resumePoints.get(playlist.type, playlist.id);
    final resumeIndex = _resolveResumeIndex(playlist, resume);

    var index = startIndex;
    var position = Duration.zero;
    if (index == null) {
      index = resumeIndex ?? 0;
      if (resumeIndex != null) {
        position = Duration(seconds: resume!.position);
      }
    } else if (resumeIndex == index) {
      position = Duration(seconds: resume!.position);
    }
    if (position < minResumePosition) {
      position = Duration.zero;
    }

    _playlist = playlist;
    final items = playlist.tracks
        .map((track) => MediaItem(
              id: track.url,
              title: track.title,
              album: playlist.title,
              artUri: playlist.coverUrl != null
                  ? Uri.tryParse(playlist.coverUrl!)
                  : null,
            ))
        .toList();
    queue.add(items);
    mediaItem.add(items[index]);

    await _player.setAudioSource(
      ConcatenatingAudioSource(
        children: playlist.tracks
            .map((track) => AudioSource.uri(Uri.parse(track.url)))
            .toList(),
      ),
      initialIndex: index,
      initialPosition: position,
    );
    _startSaveTimer();
    await _player.play();
  }

  @override
  Future<void> play() => _player.play();

  @override
  Future<void> pause() async {
    await _player.pause();
    await _persistResumePoint();
  }

  @override
  Future<void> seek(Duration position) async {
    await _player.seek(position);
    await _persistResumePoint();
  }

  @override
  Future<void> skipToNext() => _player.seekToNext();

  @override
  Future<void> skipToPrevious() => _player.seekToPrevious();

  @override
  Future<void> skipToQueueItem(int index) async {
    if (index >= 0 && index < queue.value.length) {
      await _player.seek(Duration.zero, index: index);
    }
  }

  /// Stops playback and dismisses the media session. The resume point is
  /// kept unless the playlist just completed.
  @override
  Future<void> stop() async {
    _saveTimer?.cancel();
    if (!_completing) {
      await _persistResumePoint();
    }
    await _player.stop();
    _playlist = null;
    queue.add(const []);
    await super.stop();
  }

  Future<void> dispose() async {
    _saveTimer?.cancel();
    await _player.dispose();
  }

  // ------------------------------------------------------------------

  int? _resolveResumeIndex(MediaPlaylist playlist, ResumePoint? resume) {
    if (resume == null) {
      return null;
    }
    if (resume.trackIndex < playlist.tracks.length &&
        playlist.tracks[resume.trackIndex].id == resume.trackId) {
      return resume.trackIndex;
    }
    // The chapter list changed since the point was saved: find the track by
    // id, or drop the stale point.
    final found = playlist.tracks.indexWhere((t) => t.id == resume.trackId);
    return found >= 0 ? found : null;
  }

  void _startSaveTimer() {
    _saveTimer?.cancel();
    _saveTimer = Timer.periodic(resumeSaveInterval, (_) {
      if (_player.playing) {
        _persistResumePoint();
      }
    });
  }

  Future<void> _persistResumePoint() async {
    final playlist = _playlist;
    if (playlist == null) {
      return;
    }
    final index = _player.currentIndex ?? 0;
    if (index >= playlist.tracks.length) {
      return;
    }
    await _resumePoints.save(
      playlist.type,
      playlist.id,
      ResumePoint(
        trackId: playlist.tracks[index].id,
        trackIndex: index,
        position: _player.position.inSeconds,
        updatedAt: DateTime.now().toUtc().toIso8601String(),
      ),
    );
  }

  void _broadcastState(PlaybackEvent event) {
    final isBook = _playlist?.type == MediaPlaylistType.book;
    playbackState.add(playbackState.value.copyWith(
      controls: [
        if (isBook) MediaControl.skipToPrevious,
        MediaControl.rewind,
        if (_player.playing) MediaControl.pause else MediaControl.play,
        MediaControl.fastForward,
        if (isBook) MediaControl.skipToNext,
        MediaControl.stop,
      ],
      systemActions: const {
        MediaAction.seek,
        MediaAction.seekForward,
        MediaAction.seekBackward,
      },
      androidCompactActionIndices: isBook ? const [0, 2, 4] : const [0, 1, 2],
      processingState: const {
        ProcessingState.idle: AudioProcessingState.idle,
        ProcessingState.loading: AudioProcessingState.loading,
        ProcessingState.buffering: AudioProcessingState.buffering,
        ProcessingState.ready: AudioProcessingState.ready,
        ProcessingState.completed: AudioProcessingState.completed,
      }[_player.processingState]!,
      playing: _player.playing,
      updatePosition: _player.position,
      bufferedPosition: _player.bufferedPosition,
      speed: _player.speed,
      queueIndex: event.currentIndex,
    ));
  }
}
