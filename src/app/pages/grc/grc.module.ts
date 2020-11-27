import { NgModule, OnChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { GrcPageRoutingModule } from './grc-routing.module';

import { GrcPage } from './grc.page';
import { TranslateModule } from '@ngx-translate/core';
import { ComponentModule } from '../../components/component/component.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule,
    ComponentModule,
    GrcPageRoutingModule
    ],
    declarations: [GrcPage]
})
export class GrcPageModule implements OnInit, OnChanges {

    ngOnInit() { }

    ngOnChanges() { }
}
