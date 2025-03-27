import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Storage } from '@ionic/storage';
import { MeetingListProvider } from '../../providers/meeting-list.service';
import { LoadingService } from '../../providers/loading.service';
import { LocationService, MyLocation } from '@ionic-native/google-maps/ngx';

@Component({
  selector: 'app-location-search',
  templateUrl: './location-search.page.html',
  styleUrls: ['./location-search.page.scss'],
})
export class LocationSearchPage  {

  addressMeetingList: any;
  meetingsListGrouping: string;

  shownGroup = null;
  loader = null;
  isLoaded = false;
  radius = 25;

  currentLatitude: any = 55.476224;
  currentLongitude: any = 8.4606976;

  constructor(private MeetingListProvider: MeetingListProvider,
              private loaderCtrl: LoadingService,
              private storage: Storage,
              private translate: TranslateService) {
    this.meetingsListGrouping = 'weekday_tinyint';

    this.storage.ready().then(() => {
      this.storage.get('searchRange')
        .then(searchValue => {
          if (searchValue) {
            this.radius = searchValue;
          } else {
            this.radius = 25;
          }
          this.locatePhone();
        });
    });

  }

  getAllMeetings() {
    this.translate.get('FINDING_MTGS').subscribe(value => {
      this.presentLoader(value);
    });
    this.MeetingListProvider.getAddressMeetings(this.currentLatitude, this.currentLongitude, this.radius).subscribe((data) => {
      this.addressMeetingList = data;
      this.isLoaded = true;
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

  locatePhone() {
    this.translate.get('LOCATING').subscribe(value => {
      this.presentLoader(value);
    });
    if (LocationService.hasPermission()) {
      let locationTimeout = setTimeout(()=>{
        this.dismissLoaderAndLoadMeetings();
      }, 10000);
      LocationService.getMyLocation().then((myLocation: MyLocation) => {
        clearTimeout(locationTimeout);
        this.currentLatitude = myLocation.latLng.lat;
        this.currentLongitude = myLocation.latLng.lng;
        this.dismissLoaderAndLoadMeetings();
      }, (reason) => {
        clearTimeout(locationTimeout);
        this.dismissLoaderAndLoadMeetings();
      });
    } else {
      this.dismissLoaderAndLoadMeetings();
    }
  }

  dismissLoaderAndLoadMeetings() {
    this.loaderCtrl.getTop().then(loader => {
      loader.onDidDismiss().then(() => {
        this.getAllMeetings();
      });
    });
    this.dismissLoader();
  }

}

