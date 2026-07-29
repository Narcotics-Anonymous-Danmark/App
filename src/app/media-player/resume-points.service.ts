import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';
import { MediaPlaylistType, ResumePoint } from './media-player.models';

/**
 * Persists resume points in Ionic Storage.
 *
 * Key scheme (mirrored by the Dart implementation, see docs/media-player.md):
 *   mediaResume.book.<bookId>     -> one point per BOOK (chapter + position)
 *   mediaResume.speak.<audioUrl>  -> one point per speak FILE
 *   mediaResume.index.<type>      -> { <playlistId>: <point> } for list views
 *
 * The index is a denormalised copy of the points of one type, kept so a list
 * can show "already started" items with a single read. Only get/set/remove are
 * used — enumerating keys is not dependable across storage drivers.
 */
@Injectable({
    providedIn: 'root'
})
export class ResumePointsService {

    constructor(private storage: Storage) { }

    private key(type: MediaPlaylistType, playlistId: string): string {
        return `mediaResume.${type}.${playlistId}`;
    }

    private indexKey(type: MediaPlaylistType): string {
        return `mediaResume.index.${type}`;
    }

    async get(type: MediaPlaylistType, playlistId: string): Promise<ResumePoint | null> {
        const value = await this.storage.get(this.key(type, playlistId));
        if (this.isPoint(value)) {
            return value as ResumePoint;
        }
        return null;
    }

    async getAll(type: MediaPlaylistType): Promise<{ [playlistId: string]: ResumePoint }> {
        const index = await this.storage.get(this.indexKey(type));
        const points: { [playlistId: string]: ResumePoint } = {};
        if (!index || typeof index !== 'object') {
            return points;
        }
        Object.keys(index).forEach((playlistId) => {
            if (this.isPoint(index[playlistId])) {
                points[playlistId] = index[playlistId] as ResumePoint;
            }
        });
        return points;
    }

    async save(type: MediaPlaylistType, playlistId: string, point: ResumePoint): Promise<void> {
        await this.storage.set(this.key(type, playlistId), point);
        const index = await this.getAll(type);
        index[playlistId] = point;
        await this.storage.set(this.indexKey(type), index);
    }

    async clear(type: MediaPlaylistType, playlistId: string): Promise<void> {
        await this.storage.remove(this.key(type, playlistId));
        const index = await this.getAll(type);
        if (index.hasOwnProperty(playlistId)) {
            delete index[playlistId];
            await this.storage.set(this.indexKey(type), index);
        }
    }

    private isPoint(value: any): boolean {
        return !!value && typeof value.position === 'number' && typeof value.trackIndex === 'number';
    }
}
