import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';

/// Persists resume points in SharedPreferences / NSUserDefaults.
///
/// Key scheme (identical to the TypeScript ResumePointsService, see
/// docs/media-player.md):
///   mediaResume.book.<bookId>     -> one point per BOOK (chapter + position)
///   mediaResume.speak.<audioUrl>  -> one point per speak FILE
class ResumePointStore {
  static const String _prefix = 'mediaResume';

  String _key(MediaPlaylistType type, String playlistId) =>
      '$_prefix.${type.name}.$playlistId';

  Future<ResumePoint?> get(MediaPlaylistType type, String playlistId) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key(type, playlistId));
    if (raw == null) {
      return null;
    }
    try {
      return ResumePoint.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  /// Every saved point of one type, keyed by playlist id. Used by lists that
  /// show which items are already started ("continue listening").
  Future<Map<String, ResumePoint>> getAll(MediaPlaylistType type) async {
    final prefs = await SharedPreferences.getInstance();
    final prefix = '$_prefix.${type.name}.';
    final points = <String, ResumePoint>{};
    for (final key in prefs.getKeys()) {
      if (!key.startsWith(prefix)) {
        continue;
      }
      final raw = prefs.getString(key);
      if (raw == null) {
        continue;
      }
      try {
        points[key.substring(prefix.length)] =
            ResumePoint.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      } catch (_) {
        // Skip a corrupt entry rather than failing the whole list.
      }
    }
    return points;
  }

  Future<void> save(
      MediaPlaylistType type, String playlistId, ResumePoint point) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key(type, playlistId), jsonEncode(point.toJson()));
  }

  Future<void> clear(MediaPlaylistType type, String playlistId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key(type, playlistId));
  }
}
