import { Component, OnDestroy, OnInit } from '@angular/core';
import { AudioService } from '../../providers/audio.service';
import { LoadingService } from '../../providers/loading.service';
import { Subscription } from 'rxjs';
import { MediaPlayerService } from 'src/app/media-player/media-player.service';

@Component({
    selector: 'app-speaks',
    templateUrl: './speaks.page.html',
    styleUrls: ['./speaks.page.scss'],
})
export class SpeaksPage implements OnInit, OnDestroy {
    events: any;
    activeSpeakUrl: string | null = null;
    private stateSub?: Subscription;

    constructor(
        private audioProvider: AudioService,
        private player: MediaPlayerService,
        public loadingCtrl: LoadingService
    ) { }

    ngOnInit() {
        this.getAllSpeakers();
        this.stateSub = this.player.state$.subscribe((state) => {
            this.activeSpeakUrl = state.playlist && state.playlist.type === 'speak' && state.status !== 'idle'
                ? state.playlist.id
                : null;
        });
    }

    ngOnDestroy() {
        if (this.stateSub) {
            this.stateSub.unsubscribe();
        }
    }

    getAllSpeakers() {
        this.loadingCtrl.present('Loading Speakers...');
        this.audioProvider.load().subscribe((data: any) => {
            this.events = Array.of(data)[0];
        });
        this.loadingCtrl.dismiss();
    }

    /**
     * Plays the speak in the shared background player. Resume points are per
     * speak file, so coming back to the same speak continues where it left off.
     */
    playSpeak(event: any, speak: any) {
        const title = `${speak.name} - ${speak.location} - ${speak.year}`;
        this.player.play({
            id: speak.audioUrl,
            type: 'speak',
            title: event.title,
            tracks: [{
                id: speak.audioUrl,
                title,
                url: speak.audioUrl
            }]
        });
    }
}
