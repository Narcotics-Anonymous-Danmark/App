import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SpeaksPageRoutingModule } from './speaks-routing.module';
import { SpeaksPage } from './speaks.page';
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
        SpeaksPageRoutingModule
    ],
    declarations: [SpeaksPage],
    providers: [
        AudioService,
        HTTP,
        InAppBrowser
    ]

})
export class SpeaksPageModule { }
