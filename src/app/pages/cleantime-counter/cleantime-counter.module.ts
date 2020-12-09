import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CleantimeCounterPageRoutingModule } from './cleantime-counter-routing.module';
import { CleantimeCounterPage } from './cleantime-counter.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule,
    CleantimeCounterPageRoutingModule
  ],
  declarations: [CleantimeCounterPage]
})
export class CleantimeCounterPageModule {}
