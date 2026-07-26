import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { GlobalLoadingComponent } from './global-loading.component';

@NgModule({
    imports: [
        CommonModule,
        IonicModule
    ],
    declarations: [GlobalLoadingComponent],
    exports: [GlobalLoadingComponent]
})
export class GlobalLoadingModule { }
