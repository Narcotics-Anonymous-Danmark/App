import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { StepWorkingGuidesPageRoutingModule } from './step-working-guides-routing.module';

import { StepWorkingGuidesPage } from './step-working-guides.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule,
    StepWorkingGuidesPageRoutingModule
  ],
  declarations: [StepWorkingGuidesPage]
})
export class StepWorkingGuidesPageModule {}
