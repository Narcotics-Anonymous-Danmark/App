/**
 * Minimal ambient typings for the Cordova plugin globals used by the media
 * player: cordova-plugin-media (window.Media) and
 * cordova-plugin-music-controls2 (window.MusicControls).
 *
 * Both globals only exist on device; the player feature-detects them and
 * falls back to HTML5 audio (browser development) / no lock-screen controls.
 *
 * NOTE: cordova-plugin-media ships its own global `Media` type, so we do NOT
 * redeclare `Media` here (that would be a duplicate identifier). Our own
 * shape is named `CordovaMedia` and is self-contained, so the media backend
 * compiles whether or not the plugin's bundled types are in the program.
 */

declare class CordovaMedia {
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
        hasSkipBackward?: boolean;
        hasSkipForward?: boolean;
        skipBackwardInterval?: number;
        skipForwardInterval?: number;
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
    MusicControls?: MusicControlsStatic;
}

// ---------------------------------------------------------------------------
// na-cast (local-plugins/na-cast) — window.NaCast
// ---------------------------------------------------------------------------

interface NaCastSessionState {
    available: boolean;
    connected: boolean;
    connecting: boolean;
    deviceName: string | null;
}

type NaCastPlayerState = 'IDLE' | 'PLAYING' | 'PAUSED' | 'BUFFERING' | 'LOADING' | 'UNKNOWN';
type NaCastIdleReason = 'NONE' | 'FINISHED' | 'CANCELLED' | 'INTERRUPTED' | 'ERROR';

interface NaCastMediaStatus {
    playerState: NaCastPlayerState;
    idleReason: NaCastIdleReason | null;
    position: number;
    duration: number;
}

interface NaCastMedia {
    url: string;
    contentType?: string;
    title?: string;
    artist?: string;
    duration?: number;
    position?: number;
    autoplay?: boolean;
}

interface NaCastPlugin {
    initialize(): Promise<NaCastSessionState>;
    onSessionState(cb: (state: NaCastSessionState) => void): () => void;
    requestSession(): Promise<void>;
    endSession(stopReceiver?: boolean): Promise<void>;
    loadMedia(media: NaCastMedia): Promise<void>;
    play(): Promise<void>;
    pause(): Promise<void>;
    seek(seconds: number): Promise<void>;
    onMediaStatus(cb: (status: NaCastMediaStatus) => void): () => void;
    getPosition(): Promise<number>;
    readonly sessionState: NaCastSessionState | null;
    readonly mediaStatus: NaCastMediaStatus | null;
}

// ---------------------------------------------------------------------------
// na-airplay-picker (local-plugins/na-airplay-picker) — window.NaAirPlay, iOS only
// ---------------------------------------------------------------------------

interface NaAirPlayRoute {
    airplay: boolean;
    routeName: string;
    portType: string;
}

interface NaAirPlayPlugin {
    showPicker(): Promise<void>;
    getRoute(): Promise<NaAirPlayRoute>;
    onRouteChange(cb: (route: NaAirPlayRoute) => void): () => void;
    readonly route: NaAirPlayRoute | null;
}

interface Window {
    NaCast?: NaCastPlugin;
    NaAirPlay?: NaAirPlayPlugin;
}
