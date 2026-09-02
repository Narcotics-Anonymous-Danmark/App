import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import {
    formatPlaybackTime,
    INITIAL_PLAYER_STATE,
    PlayerState,
    SKIP_BACKWARD_SECONDS,
    SKIP_FORWARD_SECONDS
} from './media-player.models';
import { MediaPlayerService } from './media-player.service';
import { CastSessionService, CastSessionState, IDLE_CAST_STATE } from './cast.service';

/**
 * Global mini player docked at the bottom of the app. Rendered once in
 * app.component.html so playback (and its controls) survive navigation
 * between pages.
 */
@Component({
    selector: 'app-media-player',
    templateUrl: './media-player.component.html',
    styleUrls: ['./media-player.component.scss']
})
export class MediaPlayerComponent implements OnInit, OnDestroy {

    state: PlayerState = INITIAL_PLAYER_STATE;
    readonly skipBackward = SKIP_BACKWARD_SECONDS;
    readonly skipForward = SKIP_FORWARD_SECONDS;
    private seeking = false;
    private seekPreview = 0;
    private stateSub?: Subscription;
    private castSub?: Subscription;
    private unsubscribeAirPlay: (() => void) | null = null;

    castState: CastSessionState = IDLE_CAST_STATE;
    airPlayActive = false;

    constructor(public player: MediaPlayerService, public cast: CastSessionService) { }

    ngOnInit() {
        this.stateSub = this.player.state$.subscribe((state) => {
            this.state = state;
            // Pages pad their content while the player is docked (global.scss).
            document.body.classList.toggle('media-player-open', state.status !== 'idle');
        });
        this.castSub = this.cast.state$.subscribe((castState) => this.castState = castState);
        const airPlay = this.airPlayPlugin;
        if (airPlay) {
            this.unsubscribeAirPlay = airPlay.onRouteChange((route) => this.airPlayActive = !!route.airplay);
        }
    }

    ngOnDestroy() {
        if (this.stateSub) {
            this.stateSub.unsubscribe();
        }
        if (this.castSub) {
            this.castSub.unsubscribe();
        }
        if (this.unsubscribeAirPlay) {
            this.unsubscribeAirPlay();
            this.unsubscribeAirPlay = null;
        }
        document.body.classList.remove('media-player-open');
    }

    private get airPlayPlugin(): NaAirPlayPlugin | undefined {
        return (window as any).NaAirPlay as NaAirPlayPlugin | undefined;
    }

    get showCast(): boolean {
        return this.castState.available || this.castState.connected || this.castState.connecting;
    }

    get castIcon(): string {
        return this.castState.connected
            ? 'assets/img/player/cast-connected.svg'
            : 'assets/img/player/cast.svg';
    }

    get showAirPlay(): boolean {
        return !!this.airPlayPlugin;
    }

    onCastClick(): void {
        this.cast.requestSession().catch((e) => console.warn('Cast: could not open picker', e));
    }

    onAirPlayClick(): void {
        const airPlay = this.airPlayPlugin;
        if (airPlay) {
            airPlay.showPicker().catch((e) => console.warn('AirPlay: could not open picker', e));
        }
    }

    get visible(): boolean {
        return this.state.status !== 'idle';
    }

    get isBook(): boolean {
        return !!this.state.playlist && this.state.playlist.type === 'book';
    }

    get trackTitle(): string {
        const { playlist, trackIndex } = this.state;
        const track = playlist ? playlist.tracks[trackIndex] : null;
        return track ? track.title : '';
    }

    get hasPrevious(): boolean {
        return this.state.trackIndex > 0;
    }

    get hasNext(): boolean {
        return !!this.state.playlist && this.state.trackIndex < this.state.playlist.tracks.length - 1;
    }

    /** While the user drags the slider we show the drag position, not the poll. */
    get displayPosition(): number {
        return this.seeking ? this.seekPreview : this.state.position;
    }

    onSeekInput(event: any): void {
        this.seeking = true;
        this.seekPreview = Number(event.target.value);
    }

    onSeekCommit(event: any): void {
        this.seeking = false;
        this.player.seekTo(Number(event.target.value));
    }

    format(seconds: number): string {
        return formatPlaybackTime(seconds);
    }
}
