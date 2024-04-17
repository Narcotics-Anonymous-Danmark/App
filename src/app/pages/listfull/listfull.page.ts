import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Storage } from '@ionic/storage';
import { LoadingService } from '../../providers/loading.service';
import { ServiceGroupsProvider } from '../../providers/service-groups.service';
import { MeetingListProvider } from '../../providers/meeting-list.service';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { firstBy } from 'thenby';

@Component({
  selector: 'app-listfull',
  templateUrl: './listfull.page.html',
  styleUrls: ['./listfull.page.scss'],
})
export class ListfullPage {

  serviceGroups: any;
  serviceGroupHierarchy: any = [];
  meetingListCounties;
  uniqueCounties;
  shownDay = null;
  shownGroupL1 = null;
  shownGroupL2 = null;
  shownGroupL3 = null;
  shownGroupL4 = null;
  HTMLGrouping = 'counties';
  loader = null;
  meetingListArea: any = [];
  meetingListCounty: any = [];
  areaName: any = '';
  countyName: any = '';
  isLoaded = false;

  constructor(
    private meetingListProvider: MeetingListProvider,
    private serviceGroupsProvider: ServiceGroupsProvider,
    private loaderCtrl: LoadingService,
    private translate: TranslateService,
    private storage: Storage,
    private iab: InAppBrowser) {

    this.translate.get('FINDING_MTGS').subscribe(value => { this.presentLoader(value); })

    this.meetingListProvider.getCounties().subscribe((data) => {

      if (JSON.stringify(data) === '{}') {  // empty result set!
        this.meetingListArea = JSON.parse('[]');
      } else {
        this.meetingListCounties = data;
        this.isLoaded = true;
        for (let i = 0; i < this.meetingListCounties.length; i++) {
          if (this.meetingListCounties[i].location_municipality == "" || this.meetingListCounties[i].location_municipality == "Online møde" || this.meetingListCounties[i].location_municipality == "Viborg online" || this.meetingListCounties[i].location_municipality == "Viborg.") {
            this.meetingListCounties[i].location_municipality = "Online";
          }
        }
        this.uniqueCounties =( [...new Set(this.meetingListCounties.map(({location_municipality})=>location_municipality))]);
      }
      this.dismissLoader();
    });

  }

  getMeetingsByCounty(countyName) {
    this.translate.get('FINDING_MTGS').subscribe(value => { this.presentLoader(value); });
    this.HTMLGrouping = 'meetings';
    this.countyName = countyName;
    this.meetingListProvider.getAllMeetings().subscribe((data) => {

      if (JSON.stringify(data) === '{}') {  // empty result set!
        this.meetingListCounty = JSON.parse('[]');
      } else {
        this.meetingListCounty = data;
        if (countyName == "Online") {
          this.meetingListCounty = this.meetingListCounty.filter(meeting => meeting.location_municipality == "");
        } else {
          this.meetingListCounty = this.meetingListCounty.filter(meeting => meeting.location_municipality == countyName);
        }
        this.isLoaded = true;
      }
      this.dismissLoader();
    });
  }

  presentLoader(loaderText: any) {
    if (!this.loader) {
      this.loader = this.loaderCtrl.present(loaderText);
    }
  }

  dismissLoader() {
    if (this.loader) {
      this.loader = this.loaderCtrl.dismiss();
      this.loader = null;
    }
  }

  showCountyStructure() {
    this.HTMLGrouping = 'counties';
    this.countyName = '';
    this.shownDay = null;
  }

}