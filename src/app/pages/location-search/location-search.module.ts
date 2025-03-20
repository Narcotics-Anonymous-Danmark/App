import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { LocationSearchPageRoutingModule } from './location-search-routing.module';
import { LocationSearchPage } from './location-search.page';
import { TranslateModule } from '@ngx-translate/core';
import { MeetingListProvider } from 'src/app/providers/meeting-list.service';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { PipesModule } from 'src/app/pipes/pipes.module';
import { ComponentModule } from '../../components/component/component.module';
import { HTTP } from '@ionic-native/http/ngx';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule,
    PipesModule,
    LocationSearchPageRoutingModule,
    ComponentModule
  ],
  declarations: [
    LocationSearchPage
  ],
  providers: [
    InAppBrowser,
    MeetingListProvider,
    HTTP
  ]
})
export class LocationSearchPageModule {}
