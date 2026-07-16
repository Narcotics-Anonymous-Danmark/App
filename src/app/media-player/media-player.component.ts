import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { formatPlaybackTime, INITIAL_PLAYER_STATE, PlayerState } from './media-player.models';
import { MediaPlayerService } from './media-player.service';

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
    private seeking = false;
    private seekPreview = 0;
    private stateSub: Subscription;

    constructor(public player: MediaPlayerService) { }

    ngOnInit() {
        this.stateSub = this.player.state$.subscribe((state) => {
            this.state = state;
            // Pages pad their content while the player is docked (global.scss).
            document.body.classList.toggle('media-player-open', state.status !== 'idle');
        });
    }

    ngOnDestroy() {
        if (this.stateSub) {
            this.stateSub.unsubscribe();
        }
        document.body.classList.remove('media-player-open');
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
