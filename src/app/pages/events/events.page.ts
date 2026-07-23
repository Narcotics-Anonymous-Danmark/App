import { Component, OnInit } from '@angular/core';
import { EventService } from '../../providers/event.service';
import { LoadingService } from '../../providers/loading.service';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';

@Component({
    selector: 'app-events',
    templateUrl: './events.page.html',
    styleUrls: ['./events.page.scss'],
})
export class EventsPage implements OnInit {
    events: any;

    constructor(
        private theInAppBrowser: InAppBrowser,
        private eventProvider: EventService,
        public loadingCtrl: LoadingService
    ) { }

    ngOnInit() {
        this.getAllEvents();
    }

    getAllEvents() {
        this.loadingCtrl.present('Loading Events...');
        this.eventProvider.load().subscribe((data: any) => {
            this.events = Array.of(data)[0];
        });
        this.loadingCtrl.dismiss();
    }

    openWithInAppBrowser(url: string) {
        const target = 'playerWindow';
        const browser = this.theInAppBrowser.create(url, target, 'location=no');
        browser.show();
        console.log(url);
    }
}
