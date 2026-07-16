/**
 * Playback backends for the media player.
 *
 * CordovaMediaBackend drives cordova-plugin-media (native AVPlayer /
 * MediaPlayer), which keeps playing with the screen off or locked — unlike
 * an HTML5 <audio> tag inside the webview, which the OS suspends.
 * HtmlAudioBackend is the fallback for browser development (ionic serve).
 */

export interface AudioBackendEvents {
    /** The track finished playing on its own. */
    onEnded: () => void;
    onError: (error: any) => void;
    /** Playback actually started running (safe point to apply a seek). */
    onRunning: () => void;
}

export interface AudioBackend {
    load(url: string, events: AudioBackendEvents): void;
    play(): void;
    pause(): void;
    seekTo(seconds: number): void;
    getPosition(): Promise<number>;
    /** Duration in seconds, 0 while unknown. */
    getDuration(): number;
    release(): void;
}

export class CordovaMediaBackend implements AudioBackend {
    private media: Media | null = null;
    // Media fires its success callback on stop()/release() too, so we mute
    // callbacks once we tear the instance down ourselves.
    private released = false;

    static isAvailable(): boolean {
        return typeof (window as any).Media !== 'undefined';
    }

    load(url: string, events: AudioBackendEvents): void {
        const MediaCtor = (window as any).Media as typeof Media;
        this.media = new MediaCtor(
            url,
            () => { if (!this.released) { events.onEnded(); } },
            (error) => { if (!this.released) { events.onError(error); } },
            (status) => {
                if (!this.released && status === MediaCtor.MEDIA_RUNNING) {
                    events.onRunning();
                }
            }
        );
    }

    play(): void {
        if (this.media) {
            this.media.play({ playAudioWhenScreenIsLocked: true });
        }
    }

    pause(): void {
        if (this.media) {
            this.media.pause();
        }
    }

    seekTo(seconds: number): void {
        if (this.media) {
            this.media.seekTo(Math.max(0, seconds) * 1000);
        }
    }

    getPosition(): Promise<number> {
        return new Promise((resolve) => {
            if (!this.media || this.released) {
                resolve(0);
                return;
            }
            this.media.getCurrentPosition(
                (position) => resolve(position >= 0 ? position : 0),
                () => resolve(0)
            );
        });
    }

    getDuration(): number {
        if (!this.media) {
            return 0;
        }
        const duration = this.media.getDuration();
        return duration > 0 ? duration : 0;
    }

    release(): void {
        this.released = true;
        if (this.media) {
            try {
                this.media.stop();
            } catch (e) {
                // stop() throws if the media never started; release anyway
            }
            this.media.release();
            this.media = null;
        }
    }
}

export class HtmlAudioBackend implements AudioBackend {
    private audio: HTMLAudioElement | null = null;

    load(url: string, events: AudioBackendEvents): void {
        this.audio = new Audio(url);
        this.audio.preload = 'auto';
        this.audio.onended = () => events.onEnded();
        this.audio.onerror = (error) => events.onError(error);
        this.audio.onplaying = () => events.onRunning();
    }

    play(): void {
        if (this.audio) {
            this.audio.play().catch(() => { /* autoplay policy — user gesture required */ });
        }
    }

    pause(): void {
        if (this.audio) {
            this.audio.pause();
        }
    }

    seekTo(seconds: number): void {
        if (this.audio) {
            this.audio.currentTime = Math.max(0, seconds);
        }
    }

    getPosition(): Promise<number> {
        return Promise.resolve(this.audio ? this.audio.currentTime || 0 : 0);
    }

    getDuration(): number {
        if (this.audio && isFinite(this.audio.duration) && this.audio.duration > 0) {
            return this.audio.duration;
        }
        return 0;
    }

    release(): void {
        if (this.audio) {
            this.audio.pause();
            this.audio.onended = null;
            this.audio.onerror = null;
            this.audio.onplaying = null;
            this.audio.removeAttribute('src');
            this.audio = null;
        }
    }
}
