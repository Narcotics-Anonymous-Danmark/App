import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AudioBackend, CordovaMediaBackend, HtmlAudioBackend } from './audio-backend';
import { CastBackend } from './cast-backend';
import { CastSessionService } from './cast.service';
import {
    INITIAL_PLAYER_STATE,
    MediaPlaylist,
    parseDurationLabel,
    PlaybackStatus,
    PlayerState,
    ResumePoint,
    SKIP_BACKWARD_SECONDS,
    SKIP_FORWARD_SECONDS
} from './media-player.models';
import { ResumePointsService } from './resume-points.service';

const RESUME_SAVE_INTERVAL_MS = 5000;
const POSITION_POLL_INTERVAL_MS = 1000;
const MIN_RESUME_POSITION_SECONDS = 3;
const MUSIC_CONTROLS_SYNC_INTERVAL_MS = 5000;

/**
 * The single shared media player for the app (audio books + speaks).
 *
 * - Plays through cordova-plugin-media on device, so audio keeps running
 *   with the screen off/locked and is never throttled by the webview.
 * - Shows lock-screen/notification controls via cordova-plugin-music-controls2
 *   when the plugin is present, including the timeline iOS draws from the
 *   published duration/position and the skip + scrub commands.
 * - Persists resume points: one per book (chapter + position) and one per
 *   speak file, restored automatically on the next play.
 * - Casts to a Chromecast while a Cast session is connected (CastBackend):
 *   the queue logic is unchanged, only the backend is swapped, and playback
 *   is handed over in both directions at the current position.
 *
 * The behaviour contract is documented in docs/media-player.md and mirrored
 * by the Dart implementation in flutter/na_media_player.
 */
@Injectable({
    providedIn: 'root'
})
export class MediaPlayerService {

    private stateSubject = new BehaviorSubject<PlayerState>(INITIAL_PLAYER_STATE);
    readonly state$: Observable<PlayerState> = this.stateSubject.asObservable();

    private backend: AudioBackend | null = null;
    private pendingSeek: number | null = null;
    private pollTimer: any = null;
    private lastResumeSaveAt = 0;
    private musicControlsActive = false;
    private musicControlsDuration = 0;
    private lastMusicControlsSyncAt = 0;
    private notificationPermissionRequested = false;
    private casting = false;

    constructor(
        private resumePoints: ResumePointsService,
        private cast: CastSessionService,
        private zone: NgZone
    ) {
        // Save the position when the app goes to the background so a swipe-kill
        // does not lose more than one poll interval of progress.
        document.addEventListener('pause', () => this.persistResumePoint(), false);

        this.cast.initialize();
        this.cast.state$.subscribe((castState) => this.onCastConnectionChanged(castState.connected));
    }

    get isCasting(): boolean {
        return this.casting;
    }

    get state(): PlayerState {
        return this.stateSubject.value;
    }

    /**
     * Starts a playlist.
     *
     * - No trackIndex: continue from the playlist's resume point (or track 0).
     * - Explicit trackIndex: play that track; if it is the resume-point track
     *   the saved position is restored, otherwise it starts from 0.
     * - Tapping the already-active track toggles play/pause instead.
     */
    async play(playlist: MediaPlaylist, trackIndex?: number): Promise<void> {
        if (!playlist || !playlist.tracks || playlist.tracks.length === 0) {
            return;
        }

        const current = this.state;
        if (current.playlist && current.playlist.id === playlist.id && current.status !== 'idle'
            && (trackIndex === undefined || trackIndex === current.trackIndex)) {
            this.togglePlayPause();
            return;
        }

        // Switching away from another active playlist: keep its place first.
        if (current.playlist && current.status !== 'idle' && current.playlist.id !== playlist.id) {
            await this.persistResumePoint();
        }

        const resume = await this.resumePoints.get(playlist.type, playlist.id);
        const resumeIndex = this.resolveResumeIndex(playlist, resume);

        let index = trackIndex;
        let startPosition = 0;
        if (index === undefined || index === null) {
            index = resumeIndex !== null ? resumeIndex : 0;
            startPosition = resume && resumeIndex !== null ? resume.position : 0;
        } else if (resume && resumeIndex === index) {
            startPosition = resume.position;
        }
        if (startPosition < MIN_RESUME_POSITION_SECONDS) {
            startPosition = 0;
        }

        this.startTrack(playlist, index, startPosition);
    }

    togglePlayPause(): void {
        const status = this.state.status;
        if (status === 'playing' || status === 'loading') {
            this.pause();
        } else if (status === 'paused') {
            this.resume();
        }
    }

    pause(): void {
        if (!this.backend || this.state.status === 'idle') {
            return;
        }
        this.backend.pause();
        this.setStatus('paused');
        this.persistResumePoint();
        this.syncMusicControlsPlayback();
    }

    resume(): void {
        if (!this.backend || this.state.status !== 'paused') {
            return;
        }
        this.backend.play();
        this.setStatus('playing');
        this.syncMusicControlsPlayback();
    }

    /** Stops playback and hides the player. The resume point is kept. */
    async stop(persist: boolean = true): Promise<void> {
        if (persist) {
            await this.persistResumePoint();
        }
        this.releaseBackend();
        this.casting = false;
        this.destroyMusicControls();
        this.patchState(INITIAL_PLAYER_STATE);
    }

    next(): void {
        const { playlist, trackIndex } = this.state;
        if (playlist && trackIndex < playlist.tracks.length - 1) {
            this.startTrack(playlist, trackIndex + 1, 0);
        }
    }

    previous(): void {
        const { playlist, trackIndex } = this.state;
        if (playlist && trackIndex > 0) {
            this.startTrack(playlist, trackIndex - 1, 0);
        }
    }

    seekTo(seconds: number): void {
        if (!this.backend || this.state.status === 'idle' || !isFinite(seconds)) {
            return;
        }
        const duration = this.state.duration;
        let target = Math.max(0, seconds);
        if (duration > 0) {
            target = Math.min(target, duration - 1);
        }
        this.backend.seekTo(target);
        this.patchState({ position: target });
        this.persistResumePoint();
        this.syncMusicControlsPlayback();
    }

    seekBy(deltaSeconds: number): void {
        this.seekTo(this.state.position + deltaSeconds);
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    private startTrack(playlist: MediaPlaylist, trackIndex: number, startPosition: number): void {
        const track = playlist.tracks[trackIndex];
        if (!track) {
            return;
        }

        this.releaseBackend();
        this.patchState({
            status: 'loading',
            playlist,
            trackIndex,
            position: startPosition,
            duration: parseDurationLabel(track.durationLabel)
        });

        this.casting = this.cast.connected;
        if (this.casting) {
            this.backend = new CastBackend(this.cast, {
                title: track.title,
                artist: playlist.title,
                duration: parseDurationLabel(track.durationLabel),
                startPosition
            });
            this.pendingSeek = null;
        } else {
            this.backend = CordovaMediaBackend.isAvailable()
                ? new CordovaMediaBackend()
                : new HtmlAudioBackend();
            this.pendingSeek = startPosition >= MIN_RESUME_POSITION_SECONDS ? startPosition : null;
        }

        this.backend.load(track.url, {
            onEnded: () => this.zone.run(() => this.onTrackEnded()),
            onError: (error) => this.zone.run(() => this.onTrackError(error)),
            onRunning: () => this.zone.run(() => this.onTrackRunning())
        });
        this.backend.play();
        this.setStatus('playing');
        this.startPolling();
        this.persistResumePoint();
        if (this.casting) {
            this.destroyMusicControls();
        } else {
            this.syncMusicControlsMetadata();
        }
    }

    /**
     * Hands playback over when a Cast session connects or drops: the current
     * track is restarted on the other backend at the same position. Also what
     * brings playback back to the device when a session ends unexpectedly.
     */
    private async onCastConnectionChanged(connected: boolean): Promise<void> {
        if (connected === this.casting) {
            return;
        }
        const { playlist, trackIndex, status } = this.state;
        if (!this.backend || !playlist || status === 'idle') {
            this.casting = connected && this.state.status !== 'idle';
            return;
        }
        const wasPaused = status === 'paused';
        const position = await this.backend.getPosition();
        if (this.state.playlist !== playlist || this.state.trackIndex !== trackIndex || this.state.status === 'idle') {
            return;
        }
        this.startTrack(playlist, trackIndex, position > 0 ? position : this.state.position);
        if (wasPaused) {
            this.pause();
        }
    }

    private onTrackRunning(): void {
        if (this.pendingSeek !== null && this.backend) {
            this.backend.seekTo(this.pendingSeek);
            this.pendingSeek = null;
        }
        if (this.state.status === 'loading') {
            this.setStatus('playing');
        }
        this.syncMusicControlsPlayback();
    }

    private async onTrackEnded(): Promise<void> {
        const { playlist, trackIndex } = this.state;
        if (!playlist) {
            return;
        }
        if (trackIndex < playlist.tracks.length - 1) {
            this.startTrack(playlist, trackIndex + 1, 0);
        } else {
            await this.resumePoints.clear(playlist.type, playlist.id);
            this.stop(false);
        }
    }

    private onTrackError(error: any): void {
        console.error('MediaPlayer: playback error', error);
        this.stop(true);
    }

    private resolveResumeIndex(playlist: MediaPlaylist, resume: ResumePoint | null): number | null {
        if (!resume) {
            return null;
        }
        const byIndex = playlist.tracks[resume.trackIndex];
        if (byIndex && byIndex.id === resume.trackId) {
            return resume.trackIndex;
        }
        // The chapter list changed since the point was saved: find the track
        // by id, or drop the stale point.
        const found = playlist.tracks.findIndex((t) => t.id === resume.trackId);
        return found >= 0 ? found : null;
    }

    private async persistResumePoint(): Promise<void> {
        const { playlist, trackIndex, position, duration, status } = this.state;
        if (!playlist || status === 'idle') {
            return;
        }
        const track = playlist.tracks[trackIndex];
        if (!track) {
            return;
        }
        this.lastResumeSaveAt = Date.now();
        const point: ResumePoint = {
            trackId: track.id,
            trackIndex,
            position: Math.floor(position),
            updatedAt: new Date().toISOString()
        };
        if (duration > 0) {
            point.duration = Math.floor(duration);
        }
        await this.resumePoints.save(playlist.type, playlist.id, point);
    }

    private startPolling(): void {
        this.stopPolling();
        this.pollTimer = setInterval(() => this.pollPosition(), POSITION_POLL_INTERVAL_MS);
    }

    private stopPolling(): void {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    private async pollPosition(): Promise<void> {
        if (!this.backend || this.state.status !== 'playing') {
            return;
        }
        const position = await this.backend.getPosition();
        const duration = this.backend.getDuration() || this.state.duration;
        this.zone.run(() => this.patchState({ position, duration }));
        if (Date.now() - this.lastResumeSaveAt >= RESUME_SAVE_INTERVAL_MS) {
            this.persistResumePoint();
        }
        if (this.supportsElapsedUpdates
            && (Math.floor(duration) !== this.musicControlsDuration
                || Date.now() - this.lastMusicControlsSyncAt >= MUSIC_CONTROLS_SYNC_INTERVAL_MS)) {
            this.syncMusicControlsPlayback();
        }
    }

    private releaseBackend(): void {
        this.stopPolling();
        this.pendingSeek = null;
        if (this.backend) {
            this.backend.release();
            this.backend = null;
        }
    }

    private setStatus(status: PlaybackStatus): void {
        this.patchState({ status });
    }

    private patchState(patch: Partial<PlayerState>): void {
        this.stateSubject.next({ ...this.stateSubject.value, ...patch });
    }

    // ------------------------------------------------------------------
    // Lock-screen / notification controls (cordova-plugin-music-controls2)
    // ------------------------------------------------------------------

    /**
     * On Android 13+ the media-controls notification (which anchors the
     * foreground service keeping audio alive when backgrounded) needs the
     * POST_NOTIFICATIONS runtime permission. Requested once, lazily, the
     * first time playback starts. Uses the already-bundled
     * cordova-plugin-local-notification, whose permission is POST_NOTIFICATIONS.
     */
    private ensureNotificationPermission(): void {
        if (this.notificationPermissionRequested) {
            return;
        }
        this.notificationPermissionRequested = true;
        const local = (window as any).cordova?.plugins?.notification?.local;
        if (local && typeof local.requestPermission === 'function') {
            local.requestPermission(() => { /* granted or denied — audio plays either way */ });
        }
    }

    private get musicControls(): MusicControlsStatic | undefined {
        return (window as any).MusicControls as MusicControlsStatic | undefined;
    }

    private get supportsElapsedUpdates(): boolean {
        const platform = (window as any).cordova?.platformId;
        return platform === 'ios' || platform === 'android';
    }

    private syncMusicControlsMetadata(): void {
        const controls = this.musicControls;
        const { playlist, trackIndex, position, duration, status } = this.state;
        if (!controls || !playlist || this.casting) {
            return;
        }
        const track = playlist.tracks[trackIndex];
        if (!track) {
            return;
        }
        this.ensureNotificationPermission();
        controls.create({
            track: track.title,
            artist: playlist.title,
            album: playlist.title,
            cover: playlist.coverUrl || '',
            duration: Math.floor(duration),
            elapsed: Math.floor(position),
            isPlaying: status !== 'paused',
            dismissable: false,
            hasPrev: playlist.type === 'book' && trackIndex > 0,
            hasNext: playlist.type === 'book' && trackIndex < playlist.tracks.length - 1,
            hasClose: true,
            hasSkipBackward: true,
            skipBackwardInterval: SKIP_BACKWARD_SECONDS,
            hasSkipForward: true,
            skipForwardInterval: SKIP_FORWARD_SECONDS,
            hasScrubbing: true,
            ticker: track.title
        }, () => { }, () => { });

        if (!this.musicControlsActive) {
            controls.subscribe((action) => this.zone.run(() => this.onMusicControlsEvent(action)));
            controls.listen();
            this.musicControlsActive = true;
        }
        this.musicControlsDuration = Math.floor(duration);
        this.lastMusicControlsSyncAt = Date.now();
    }

    private syncMusicControlsPlayback(): void {
        const controls = this.musicControls;
        if (!controls || !this.musicControlsActive || this.casting) {
            return;
        }
        const isPlaying = this.state.status !== 'paused';
        if (!this.supportsElapsedUpdates) {
            controls.updateIsPlaying(isPlaying);
            return;
        }
        if (Math.floor(this.state.duration) !== this.musicControlsDuration) {
            this.syncMusicControlsMetadata();
            return;
        }
        this.lastMusicControlsSyncAt = Date.now();
        controls.updateElapsed({ elapsed: Math.floor(this.state.position), isPlaying });
    }

    private onMusicControlsEvent(action: string): void {
        let event: { message?: string; position?: string | number };
        try {
            event = JSON.parse(action);
        } catch (e) {
            return;
        }
        switch (event.message) {
            case 'music-controls-play':
            case 'music-controls-media-button-play':
                this.resume();
                break;
            case 'music-controls-pause':
            case 'music-controls-media-button-pause':
                this.pause();
                break;
            case 'music-controls-toggle-play-pause':
            case 'music-controls-media-button-play-pause':
            case 'music-controls-headset-events':
                this.togglePlayPause();
                break;
            case 'music-controls-next':
            case 'music-controls-media-button-next':
                this.next();
                break;
            case 'music-controls-previous':
            case 'music-controls-media-button-previous':
                this.previous();
                break;
            case 'music-controls-skip-forward':
            case 'music-controls-forward':
            case 'music-controls-media-button-fast-forward':
            case 'music-controls-media-button-skip-forward':
            case 'music-controls-media-button-step-forward':
                this.seekBy(SKIP_FORWARD_SECONDS);
                break;
            case 'music-controls-skip-backward':
            case 'music-controls-rewind':
            case 'music-controls-media-button-rewind':
            case 'music-controls-media-button-skip-backward':
            case 'music-controls-media-button-step-backward':
                this.seekBy(-SKIP_BACKWARD_SECONDS);
                break;
            case 'music-controls-seek-to':
                this.seekTo(Number(event.position));
                break;
            case 'music-controls-destroy':
            case 'music-controls-stop':
            case 'music-controls-media-button-stop':
                this.stop();
                break;
        }
    }

    private destroyMusicControls(): void {
        const controls = this.musicControls;
        if (controls && this.musicControlsActive) {
            controls.destroy(() => { }, () => { });
            this.musicControlsActive = false;
        }
        this.musicControlsDuration = 0;
        this.lastMusicControlsSyncAt = 0;
    }
}
