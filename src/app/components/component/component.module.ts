import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MeetingCardComponent } from '../meeting-card/meeting-card.component';
import { MeetingListComponent } from '../meeting-list/meeting-list.component';
import { PipesModule } from 'src/app/pipes/pipes.module';
import { TranslateModule } from '@ngx-translate/core';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    MeetingCardComponent,
    MeetingListComponent
  ],
  imports: [
    CommonModule,
    PipesModule,
    IonicModule,
    TranslateModule,
    FormsModule
  ],
  exports: [
    MeetingCardComponent,
    MeetingListComponent
  ],
  entryComponents: [
    MeetingCardComponent,
    MeetingListComponent
  ]
})
export class ComponentModule { }
