import { AudioBackend, AudioBackendEvents } from './audio-backend';
import { CastSessionService } from './cast.service';

/**
 * AudioBackend that plays on the connected Chromecast instead of locally.
 *
 * MediaPlayerService keeps driving the queue exactly as with the local
 * backends: one item is loaded on the receiver at a time and the three
 * AudioBackend events are mapped from the receiver's media status —
 *
 *   PLAYING                     -> onRunning (once per loaded item)
 *   IDLE + FINISHED             -> onEnded
 *   IDLE + ERROR / load failure -> onError
 *
 * IDLE + CANCELLED/INTERRUPTED is what the receiver reports for the *previous*
 * item when a new one is loaded (or when we pause and release), so it is
 * ignored. A FINISHED is only honoured once this item has been seen playing,
 * which filters the replayed status of the previous track.
 *
 * The receiver is told the start position in the load request, so the
 * service does not need a pending seek for this backend. Calls made while the
 * load is still in flight are queued and applied when the receiver accepts.
 */

export interface CastTrackMeta {
    title: string;
    artist: string;
    duration: number;
    startPosition: number;
}

export class CastBackend implements AudioBackend {

    private events: AudioBackendEvents | null = null;
    private unsubscribe: (() => void) | null = null;
    private loaded = false;
    private released = false;
    private sawPlaying = false;
    private duration: number;
    private desired: 'play' | 'pause' | null = null;
    private pendingSeek: number | null = null;

    constructor(private cast: CastSessionService, private meta: CastTrackMeta) {
        this.duration = meta.duration > 0 ? meta.duration : 0;
    }

    static contentTypeFor(url: string): string {
        const clean = url.split('?')[0].split('#')[0].toLowerCase();
        if (clean.endsWith('.wav')) {
            return 'audio/wav';
        }
        if (clean.endsWith('.m4a') || clean.endsWith('.mp4')) {
            return 'audio/mp4';
        }
        if (clean.endsWith('.ogg') || clean.endsWith('.oga')) {
            return 'audio/ogg';
        }
        if (clean.endsWith('.aac')) {
            return 'audio/aac';
        }
        return 'audio/mpeg';
    }

    load(url: string, events: AudioBackendEvents): void {
        this.events = events;
        this.unsubscribe = this.cast.onMediaStatus((status) => this.onStatus(status));
        this.cast.loadMedia({
            url,
            contentType: CastBackend.contentTypeFor(url),
            title: this.meta.title,
            artist: this.meta.artist,
            duration: this.duration,
            position: Math.max(0, this.meta.startPosition || 0),
            autoplay: true
        }).then(() => {
            if (this.released) {
                return;
            }
            this.loaded = true;
            if (this.pendingSeek !== null) {
                this.cast.seek(this.pendingSeek).catch(() => { });
                this.pendingSeek = null;
            }
            if (this.desired === 'pause') {
                this.cast.pause().catch(() => { });
            }
            this.desired = null;
        }).catch((error) => {
            if (!this.released && this.events) {
                this.events.onError(error);
            }
        });
    }

    play(): void {
        if (this.released) {
            return;
        }
        if (!this.loaded) {
            // autoplay covers it; only remember a change of mind.
            this.desired = 'play';
            return;
        }
        this.cast.play().catch(() => { });
    }

    pause(): void {
        if (this.released) {
            return;
        }
        if (!this.loaded) {
            this.desired = 'pause';
            return;
        }
        this.cast.pause().catch(() => { });
    }

    seekTo(seconds: number): void {
        if (this.released) {
            return;
        }
        const target = Math.max(0, seconds);
        if (!this.loaded) {
            this.pendingSeek = target;
            return;
        }
        this.cast.seek(target).catch(() => { });
    }

    getPosition(): Promise<number> {
        if (this.released) {
            return Promise.resolve(0);
        }
        if (!this.loaded) {
            return Promise.resolve(Math.max(0, this.meta.startPosition || 0));
        }
        return this.cast.getPosition();
    }

    getDuration(): number {
        return this.duration;
    }

    release(): void {
        if (this.released) {
            return;
        }
        this.released = true;
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.events = null;
        if (this.loaded) {
            this.cast.pause().catch(() => { });
        }
    }

    private onStatus(status: NaCastMediaStatus): void {
        if (this.released || !this.events || !this.loaded) {
            return;
        }
        if (status.duration > 0) {
            this.duration = status.duration;
        }
        switch (status.playerState) {
            case 'PLAYING':
                if (!this.sawPlaying) {
                    this.sawPlaying = true;
                    this.events.onRunning();
                }
                break;
            case 'IDLE':
                if (status.idleReason === 'FINISHED' && this.sawPlaying) {
                    this.events.onEnded();
                } else if (status.idleReason === 'ERROR') {
                    this.events.onError({ code: 'CAST_ERROR', message: 'Receiver reported a playback error' });
                }
                break;
            default:
                break;
        }
    }
}
