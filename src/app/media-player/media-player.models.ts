/**
 * Shared data model for the cross-platform media player.
 *
 * This contract is mirrored 1:1 by the Dart implementation in
 * flutter/na_media_player/lib/src/models.dart and documented in
 * docs/media-player.md. Keep the three in sync.
 */

export type MediaPlaylistType = 'book' | 'speak';

export const SKIP_BACKWARD_SECONDS = 15;
export const SKIP_FORWARD_SECONDS = 30;

export interface MediaTrack {
    /** Stable identifier for the track. We use the audio URL. */
    id: string;
    title: string;
    url: string;
    /** Display-only duration label from the source data, e.g. "8:10". */
    durationLabel?: string;
}

export interface MediaPlaylist {
    /**
     * Stable identifier for the playlist. Books use their route slug
     * ("basic-text", "how-and-why", "step-working-guides"); speaks use the
     * audio file URL. Resume points are keyed on this id.
     */
    id: string;
    type: MediaPlaylistType;
    /** Book title or speak event title. Shown as the secondary line. */
    title: string;
    /** Optional artwork URL for lock-screen/notification controls. */
    coverUrl?: string;
    tracks: MediaTrack[];
}

/**
 * A saved listening position. Books get ONE resume point per book (the
 * chapter index + position within it), speaks get one per audio file.
 */
export interface ResumePoint {
    trackId: string;
    trackIndex: number;
    position: number;
    duration?: number;
    updatedAt: string;
}

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused';

export interface PlayerState {
    status: PlaybackStatus;
    playlist: MediaPlaylist | null;
    trackIndex: number;
    position: number;
    duration: number;
}

export const INITIAL_PLAYER_STATE: PlayerState = {
    status: 'idle',
    playlist: null,
    trackIndex: 0,
    position: 0,
    duration: 0
};

export function parseDurationLabel(label?: string): number {
    if (!label) {
        return 0;
    }
    const parts = label.trim().split(':');
    if (parts.length < 2 || parts.length > 3) {
        return 0;
    }
    let seconds = 0;
    for (const part of parts) {
        const value = parseInt(part, 10);
        if (isNaN(value)) {
            return 0;
        }
        seconds = seconds * 60 + value;
    }
    return seconds;
}

/** Formats seconds as m:ss or h:mm:ss for display. */
export function formatPlaybackTime(totalSeconds: number): string {
    const seconds = Math.max(0, Math.floor(totalSeconds || 0));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
