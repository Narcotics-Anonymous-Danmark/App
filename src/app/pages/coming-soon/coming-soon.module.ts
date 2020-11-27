import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ComingSoonPageRoutingModule } from './coming-soon-routing.module';

import { ComingSoonPage } from './coming-soon.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule,
    ComingSoonPageRoutingModule
  ],
  declarations: [ComingSoonPage]
})
export class ComingSoonPageModule {}
