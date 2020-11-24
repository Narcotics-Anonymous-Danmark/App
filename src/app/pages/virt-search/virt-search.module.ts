import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { VirtSearchPageRoutingModule } from './virt-search-routing.module';
import { VirtSearchPage } from './virt-search.page';
import { TranslateModule } from '@ngx-translate/core';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { MeetingListProvider } from 'src/app/providers/meeting-list.service';
import { HTTP } from '@ionic-native/http/ngx';
import { ComponentModule } from '../../components/component/component.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule,
    VirtSearchPageRoutingModule,
    ComponentModule
  ],
  declarations: [VirtSearchPage],
  providers: [
    InAppBrowser,
    MeetingListProvider,
    HTTP
  ]
})
export class VirtSearchPageModule {}
