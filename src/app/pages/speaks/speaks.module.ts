import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SpeaksPageRoutingModule } from './speaks-routing.module';
import { SpeaksPage } from './speaks.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        TranslateModule,
        SpeaksPageRoutingModule
    ],
    declarations: [SpeaksPage]
})
export class SpeaksPageModule { }
