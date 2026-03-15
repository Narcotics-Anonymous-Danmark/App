import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ModalPageRoutingModule } from './modal-routing.module';
import { TranslateModule } from '@ngx-translate/core';
import { ComponentModule } from '../../components/component/component.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ModalPageRoutingModule,
    TranslateModule,
    ComponentModule
  ]
})
export class ModalPageModule {}
