import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Thin RxJS wrapper over the na-cast Cordova plugin (window.NaCast).
 *
 * Owns the session state stream the player and the UI react to, and forwards
 * the media calls the CastBackend needs. Every method is a safe no-op (or a
 * rejected promise for media calls) when the plugin is absent, so browser
 * development and unit tests run without it.
 *
 * Mirrored by the Dart CastSessionService in flutter/na_media_player.
 */

export interface CastSessionState {
    available: boolean;
    connected: boolean;
    connecting: boolean;
    deviceName: string | null;
}

export const IDLE_CAST_STATE: CastSessionState = {
    available: false,
    connected: false,
    connecting: false,
    deviceName: null
};

@Injectable({
    providedIn: 'root'
})
export class CastSessionService {

    private stateSubject = new BehaviorSubject<CastSessionState>(IDLE_CAST_STATE);
    readonly state$: Observable<CastSessionState> = this.stateSubject.asObservable();

    private initialized = false;

    constructor(private zone: NgZone) { }

    get state(): CastSessionState {
        return this.stateSubject.value;
    }

    get connected(): boolean {
        return this.state.connected;
    }

    /** True when the plugin exists (device build); false in the browser. */
    get supported(): boolean {
        return !!this.plugin;
    }

    protected get plugin(): NaCastPlugin | undefined {
        return (window as any).NaCast as NaCastPlugin | undefined;
    }

    /**
     * Creates the native Cast context and starts listening for session
     * changes. Waits for `deviceready` when Cordova is present but the
     * plugin has not been attached yet. Safe to call more than once.
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }
        if (!this.plugin && (window as any).cordova) {
            await new Promise<void>((resolve) => document.addEventListener('deviceready', () => resolve(), false));
        }
        const plugin = this.plugin;
        if (!plugin || this.initialized) {
            return;
        }
        this.initialized = true;
        plugin.onSessionState((state) => this.zone.run(() => this.publish(state)));
        try {
            this.publish(await plugin.initialize());
        } catch (e) {
            console.warn('Cast: initialize failed', e);
            this.publish(IDLE_CAST_STATE);
        }
    }

    /**
     * Opens the native device picker. While connected the native side shows
     * the controller dialog (volume / stop casting) instead, so the UI can
     * bind a single button to this call.
     */
    requestSession(): Promise<void> {
        const plugin = this.plugin;
        return plugin ? plugin.requestSession() : Promise.resolve();
    }

    endSession(stopReceiver: boolean = true): Promise<void> {
        const plugin = this.plugin;
        return plugin ? plugin.endSession(stopReceiver) : Promise.resolve();
    }

    // ------------------------------------------------------------------
    // Media calls used by CastBackend
    // ------------------------------------------------------------------

    loadMedia(media: NaCastMedia): Promise<void> {
        return this.withPlugin((p) => p.loadMedia(media));
    }

    play(): Promise<void> {
        return this.withPlugin((p) => p.play());
    }

    pause(): Promise<void> {
        return this.withPlugin((p) => p.pause());
    }

    seek(seconds: number): Promise<void> {
        return this.withPlugin((p) => p.seek(seconds));
    }

    getPosition(): Promise<number> {
        const plugin = this.plugin;
        return plugin ? plugin.getPosition().catch(() => 0) : Promise.resolve(0);
    }

    /** Subscribes to receiver media status; returns the unsubscribe function. */
    onMediaStatus(cb: (status: NaCastMediaStatus) => void): () => void {
        const plugin = this.plugin;
        if (!plugin) {
            return () => { };
        }
        return plugin.onMediaStatus((status) => this.zone.run(() => cb(status)));
    }

    // ------------------------------------------------------------------

    private withPlugin<T>(call: (plugin: NaCastPlugin) => Promise<T>): Promise<T> {
        const plugin = this.plugin;
        return plugin ? call(plugin) : Promise.reject('Cast plugin not available');
    }

    private publish(state: NaCastSessionState | null | undefined): void {
        const next: CastSessionState = state
            ? {
                available: !!state.available,
                connected: !!state.connected,
                connecting: !!state.connecting,
                deviceName: state.deviceName || null
            }
            : IDLE_CAST_STATE;
        const current = this.state;
        if (next.available !== current.available || next.connected !== current.connected
            || next.connecting !== current.connecting || next.deviceName !== current.deviceName) {
            this.stateSubject.next(next);
        }
    }
}
