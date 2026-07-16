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
