import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { MediaPlayerComponent } from './media-player.component';

@NgModule({
    imports: [
        CommonModule,
        IonicModule,
        TranslateModule
    ],
    declarations: [MediaPlayerComponent],
    exports: [MediaPlayerComponent]
})
export class MediaPlayerModule { }
