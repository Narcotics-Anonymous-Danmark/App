import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { GrcPageRoutingModule } from './grc-routing.module';

import { GrcPage } from './grc.page';
import { TranslateModule } from '@ngx-translate/core';
import { ComponentModule } from '../../components/component/component.module';

//import { PdfViewerComponent } from '../../components/pdf-viewer/pdf-viewer.component';

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
export class GrcPageModule {}
