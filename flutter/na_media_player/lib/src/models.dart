/// Shared data model for the cross-platform media player.
///
/// Mirrors src/app/media-player/media-player.models.ts (TypeScript).
/// Keep both in sync — the contract is documented in docs/media-player.md.

enum MediaPlaylistType {
  book,
  speak;

  static MediaPlaylistType fromName(String name) =>
      MediaPlaylistType.values.firstWhere((t) => t.name == name);
}

class MediaTrack {
  /// Stable identifier for the track. We use the audio URL.
  final String id;
  final String title;
  final String url;

  /// Display-only duration label from the source data, e.g. "8:10".
  final String? durationLabel;

  const MediaTrack({
    required this.id,
    required this.title,
    required this.url,
    this.durationLabel,
  });

  factory MediaTrack.fromJson(Map<String, dynamic> json) => MediaTrack(
        id: json['id'] as String,
        title: json['title'] as String,
        url: json['url'] as String,
        durationLabel: json['durationLabel'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'url': url,
        if (durationLabel != null) 'durationLabel': durationLabel,
      };
}

class MediaPlaylist {
  /// Stable identifier for the playlist. Books use their slug
  /// ("basic-text", "how-and-why", "step-working-guides"); speaks use the
  /// audio file URL. Resume points are keyed on this id.
  final String id;
  final MediaPlaylistType type;

  /// Book title or speak event title. Shown as the secondary line.
  final String title;

  /// Optional artwork URL for lock-screen/notification controls.
  final String? coverUrl;
  final List<MediaTrack> tracks;

  const MediaPlaylist({
    required this.id,
    required this.type,
    required this.title,
    this.coverUrl,
    required this.tracks,
  });

  factory MediaPlaylist.fromJson(Map<String, dynamic> json) => MediaPlaylist(
        id: json['id'] as String,
        type: MediaPlaylistType.fromName(json['type'] as String),
        title: json['title'] as String,
        coverUrl: json['coverUrl'] as String?,
        tracks: (json['tracks'] as List)
            .map((t) => MediaTrack.fromJson(t as Map<String, dynamic>))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type.name,
        'title': title,
        if (coverUrl != null) 'coverUrl': coverUrl,
        'tracks': tracks.map((t) => t.toJson()).toList(),
      };
}

/// A saved listening position. Books get ONE resume point per book (the
/// chapter index + position within it), speaks get one per audio file.
class ResumePoint {
  final String trackId;
  final int trackIndex;

  /// Whole seconds into the track.
  final int position;

  /// ISO-8601 timestamp of the last save.
  final String updatedAt;

  const ResumePoint({
    required this.trackId,
    required this.trackIndex,
    required this.position,
    required this.updatedAt,
  });

  factory ResumePoint.fromJson(Map<String, dynamic> json) => ResumePoint(
        trackId: json['trackId'] as String,
        trackIndex: json['trackIndex'] as int,
        position: (json['position'] as num).floor(),
        updatedAt: json['updatedAt'] as String,
      );

  Map<String, dynamic> toJson() => {
        'trackId': trackId,
        'trackIndex': trackIndex,
        'position': position,
        'updatedAt': updatedAt,
      };
}
