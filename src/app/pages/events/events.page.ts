import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { EventService } from '../../providers/event.service';
import { LoadingService } from '../../providers/loading.service';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { Insomnia } from '@ionic-native/insomnia/ngx';

@Component({
    selector: 'app-events',
    templateUrl: './events.page.html',
    styleUrls: ['./events.page.scss'],
})
export class EventsPage implements OnInit {
    events: any;

    constructor(
        private translate: TranslateService,
        private insomnia: Insomnia,
        private theInAppBrowser: InAppBrowser,
        private eventProvider: EventService,
        public loadingCtrl: LoadingService
    ) { }

    ngOnInit() {
        this.getAllEvents();
    }

    getAllEvents() {
        this.loadingCtrl.present('Loading Events...');
        this.eventProvider.load().subscribe((data) => {
            this.events = Array.of(data)[0];
        });
        this.loadingCtrl.dismiss();
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
