import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AudioService } from '../../providers/audio.service';
import { LoadingService } from '../../providers/loading.service';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { Insomnia } from '@ionic-native/insomnia/ngx';

@Component({
    selector: 'app-speaks',
    templateUrl: './speaks.page.html',
    styleUrls: ['./speaks.page.scss'],
})
export class SpeaksPage implements OnInit {
    events: any;

    constructor(
        private translate: TranslateService,
        private insomnia: Insomnia,
        private theInAppBrowser: InAppBrowser,
        private audioProvider: AudioService,
        public loadingCtrl: LoadingService
    ) { }

    ngOnInit() {
        this.loadingCtrl.present('Loading Speakers...');
        this.getAllSpeakers();
    }

    getAllSpeakers() {
        this.audioProvider.load().subscribe((data) => {
            this.events = Array.of(data.events)[0];
            //debugger;
            this.loadingCtrl.dismiss();
        });
    }

    openWithInAppBrowser(url: string) {
        const target = 'playerWindow';
        const browser = this.theInAppBrowser.create(url, target, 'location=no');
        this.insomnia.keepAwake();
        browser.on('exit').subscribe((ev) => {
            this.insomnia.allowSleepAgain();
        });
        browser.show();
        console.log(url);
    }
}
