import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';
import { MediaPlaylistType, ResumePoint } from './media-player.models';

/**
 * Persists resume points in Ionic Storage.
 *
 * Key scheme (mirrored by the Dart implementation, see docs/media-player.md):
 *   mediaResume.book.<bookId>     -> one point per BOOK (chapter + position)
 *   mediaResume.speak.<audioUrl>  -> one point per speak FILE
 */
@Injectable({
    providedIn: 'root'
})
export class ResumePointsService {

    constructor(private storage: Storage) { }

    private key(type: MediaPlaylistType, playlistId: string): string {
        return `mediaResume.${type}.${playlistId}`;
    }

    async get(type: MediaPlaylistType, playlistId: string): Promise<ResumePoint | null> {
        const value = await this.storage.get(this.key(type, playlistId));
        if (value && typeof value.position === 'number' && typeof value.trackIndex === 'number') {
            return value as ResumePoint;
        }
        return null;
    }

    async save(type: MediaPlaylistType, playlistId: string, point: ResumePoint): Promise<void> {
        await this.storage.set(this.key(type, playlistId), point);
    }

    async clear(type: MediaPlaylistType, playlistId: string): Promise<void> {
        await this.storage.remove(this.key(type, playlistId));
    }
}
