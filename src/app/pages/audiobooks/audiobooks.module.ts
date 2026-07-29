import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AudioBooksPageRoutingModule } from './audiobooks-routing.module';
import { AudioBooksPage } from './audiobooks.page';
import { TranslateModule } from '@ngx-translate/core';
import { AudioService } from '../../providers/audio.service';
import { HTTP } from '@ionic-native/http/ngx';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        TranslateModule,
        AudioBooksPageRoutingModule
    ],
    declarations: [AudioBooksPage],
    providers: [
        AudioService,
        HTTP,
    ]

})
export class AudioBooksPageModule { }
