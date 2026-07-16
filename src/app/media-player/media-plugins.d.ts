/**
 * Minimal ambient typings for the Cordova plugin globals used by the media
 * player: cordova-plugin-media (window.Media) and
 * cordova-plugin-music-controls2 (window.MusicControls).
 *
 * Both globals only exist on device; the player feature-detects them and
 * falls back to HTML5 audio (browser development) / no lock-screen controls.
 */

declare class Media {
    constructor(
        src: string,
        mediaSuccess?: () => void,
        mediaError?: (error: { code: number; message?: string }) => void,
        mediaStatus?: (status: number) => void
    );

    static MEDIA_NONE: number;
    static MEDIA_STARTING: number;
    static MEDIA_RUNNING: number;
    static MEDIA_PAUSED: number;
    static MEDIA_STOPPED: number;

    play(options?: { playAudioWhenScreenIsLocked?: boolean }): void;
    pause(): void;
    stop(): void;
    release(): void;
    seekTo(milliseconds: number): void;
    /** Duration in seconds, -1 while unknown. */
    getDuration(): number;
    /** Position in seconds via callback, -1 when not playing. */
    getCurrentPosition(success: (position: number) => void, error?: (e: any) => void): void;
}

interface MusicControlsStatic {
    create(options: {
        track?: string;
        artist?: string;
        cover?: string;
        isPlaying?: boolean;
        dismissable?: boolean;
        hasPrev?: boolean;
        hasNext?: boolean;
        hasClose?: boolean;
        hasScrubbing?: boolean;
        album?: string;
        duration?: number;
        elapsed?: number;
        ticker?: string;
        playIcon?: string;
        pauseIcon?: string;
        prevIcon?: string;
        nextIcon?: string;
        closeIcon?: string;
        notificationIcon?: string;
    }, onSuccess?: () => void, onError?: (e: any) => void): void;
    destroy(onSuccess?: () => void, onError?: (e: any) => void): void;
    subscribe(onEvent: (action: string) => void): void;
    listen(): void;
    updateIsPlaying(isPlaying: boolean): void;
    updateElapsed(args: { elapsed: number; isPlaying: boolean }): void;
}

interface Window {
    Media?: typeof Media;
    MusicControls?: MusicControlsStatic;
}
