import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { BasicTextPageRoutingModule } from './basic-text-routing.module';

import { BasicTextPage } from './basic-text.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule,
    BasicTextPageRoutingModule
  ],
  declarations: [BasicTextPage]
})
export class BasicTextPageModule {}
