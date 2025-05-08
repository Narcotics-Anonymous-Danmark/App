import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { HowAndWhyPageRoutingModule } from './how-and-why-routing.module';

import { HowAndWhyPage } from './how-and-why.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule,
    HowAndWhyPageRoutingModule
  ],
  declarations: [HowAndWhyPage]
})
export class HowAndWhyPageModule {}
