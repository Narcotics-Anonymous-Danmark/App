import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AudioBackend, CordovaMediaBackend, HtmlAudioBackend } from './audio-backend';
import {
    INITIAL_PLAYER_STATE,
    MediaPlaylist,
    MediaTrack,
    PlaybackStatus,
    PlayerState,
    ResumePoint
} from './media-player.models';
import { ResumePointsService } from './resume-points.service';

const RESUME_SAVE_INTERVAL_MS = 5000;
const POSITION_POLL_INTERVAL_MS = 1000;
// A resume position this close to the start is not worth restoring.
const MIN_RESUME_POSITION_SECONDS = 3;

/**
 * The single shared media player for the app (audio books + speaks).
 *
 * - Plays through cordova-plugin-media on device, so audio keeps running
 *   with the screen off/locked and is never throttled by the webview.
 * - Shows lock-screen/notification controls via cordova-plugin-music-controls2
 *   when the plugin is present.
 * - Persists resume points: one per book (chapter + position) and one per
 *   speak file, restored automatically on the next play.
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
    private notificationPermissionRequested = false;

    constructor(
        private resumePoints: ResumePointsService,
        private zone: NgZone
    ) {
        // Save the position when the app goes to the background so a swipe-kill
        // does not lose more than one poll interval of progress.
        document.addEventListener('pause', () => this.persistResumePoint(), false);
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
        this.updateMusicControlsPlaying(false);
    }

    resume(): void {
        if (!this.backend || this.state.status !== 'paused') {
            return;
        }
        this.backend.play();
        this.setStatus('playing');
        this.updateMusicControlsPlaying(true);
    }

    /** Stops playback and hides the player. The resume point is kept. */
    async stop(persist: boolean = true): Promise<void> {
        if (persist) {
            await this.persistResumePoint();
        }
        this.releaseBackend();
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
        if (!this.backend || this.state.status === 'idle') {
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
            duration: 0
        });

        this.backend = CordovaMediaBackend.isAvailable()
            ? new CordovaMediaBackend()
            : new HtmlAudioBackend();
        this.pendingSeek = startPosition >= MIN_RESUME_POSITION_SECONDS ? startPosition : null;

        this.backend.load(track.url, {
            onEnded: () => this.zone.run(() => this.onTrackEnded()),
            onError: (error) => this.zone.run(() => this.onTrackError(error)),
            onRunning: () => this.zone.run(() => this.onTrackRunning())
        });
        this.backend.play();
        this.setStatus('playing');
        this.startPolling();
        this.persistResumePoint();
        this.showMusicControls(playlist, track, trackIndex);
    }

    private onTrackRunning(): void {
        if (this.pendingSeek !== null && this.backend) {
            this.backend.seekTo(this.pendingSeek);
            this.pendingSeek = null;
        }
        if (this.state.status === 'loading') {
            this.setStatus('playing');
        }
    }

    private onTrackEnded(): void {
        const { playlist, trackIndex } = this.state;
        if (!playlist) {
            return;
        }
        if (trackIndex < playlist.tracks.length - 1) {
            // Auto-advance; the resume point moves to the start of the next
            // track so a killed app still comes back to the right chapter.
            this.startTrack(playlist, trackIndex + 1, 0);
        } else {
            // Finished the whole book / speak: forget the resume point.
            this.resumePoints.clear(playlist.type, playlist.id);
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
        const { playlist, trackIndex, position, status } = this.state;
        if (!playlist || status === 'idle') {
            return;
        }
        const track = playlist.tracks[trackIndex];
        if (!track) {
            return;
        }
        this.lastResumeSaveAt = Date.now();
        await this.resumePoints.save(playlist.type, playlist.id, {
            trackId: track.id,
            trackIndex,
            position: Math.floor(position),
            updatedAt: new Date().toISOString()
        });
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

    private showMusicControls(playlist: MediaPlaylist, track: MediaTrack, trackIndex: number): void {
        const controls = (window as any).MusicControls as MusicControlsStatic | undefined;
        if (!controls) {
            return;
        }
        this.ensureNotificationPermission();
        controls.create({
            track: track.title,
            artist: playlist.title,
            cover: playlist.coverUrl || '',
            isPlaying: true,
            dismissable: false,
            hasPrev: playlist.type === 'book' && trackIndex > 0,
            hasNext: playlist.type === 'book' && trackIndex < playlist.tracks.length - 1,
            hasClose: true,
            hasScrubbing: false,
            ticker: track.title
        }, () => { }, () => { });
        controls.subscribe((action) => this.zone.run(() => this.onMusicControlsEvent(action)));
        controls.listen();
        this.musicControlsActive = true;
    }

    private onMusicControlsEvent(action: string): void {
        let message = '';
        try {
            message = JSON.parse(action).message;
        } catch (e) {
            return;
        }
        switch (message) {
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
            case 'music-controls-destroy':
                this.stop();
                break;
        }
    }

    private updateMusicControlsPlaying(isPlaying: boolean): void {
        const controls = (window as any).MusicControls as MusicControlsStatic | undefined;
        if (controls && this.musicControlsActive) {
            controls.updateIsPlaying(isPlaying);
        }
    }

    private destroyMusicControls(): void {
        const controls = (window as any).MusicControls as MusicControlsStatic | undefined;
        if (controls && this.musicControlsActive) {
            controls.destroy(() => { }, () => { });
            this.musicControlsActive = false;
        }
    }
}
