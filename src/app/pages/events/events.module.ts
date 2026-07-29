import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { EventsPageRoutingModule } from './events-routing.module';
import { EventsPage } from './events.page';
import { TranslateModule } from '@ngx-translate/core';
import { AudioService } from '../../providers/audio.service';
import { HTTP } from '@ionic-native/http/ngx';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        TranslateModule,
        EventsPageRoutingModule
    ],
    declarations: [EventsPage],
    providers: [
        AudioService,
        HTTP,
        InAppBrowser
    ]

})
export class EventsPageModule { }
