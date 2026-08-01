import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MeetingCardComponent } from '../meeting-card/meeting-card.component';
import { MeetingListComponent } from '../meeting-list/meeting-list.component';
import { MeetingFormatsComponent } from '../meeting-formats/meeting-formats.component';

import { PipesModule } from 'src/app/pipes/pipes.module';
import { TranslateModule } from '@ngx-translate/core';
import { IonicModule } from '@ionic/angular';

@NgModule({
  declarations: [
    MeetingCardComponent,
    MeetingListComponent,
    MeetingFormatsComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    PipesModule,
    IonicModule,
    TranslateModule,
  ],
  exports: [
    MeetingCardComponent,
    MeetingListComponent,
    MeetingFormatsComponent,
  ],
  entryComponents: [
    MeetingCardComponent,
    MeetingListComponent,
    MeetingFormatsComponent
  ]
})
export class ComponentModule { }
