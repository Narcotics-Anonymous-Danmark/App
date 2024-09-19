import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Storage } from '@ionic/storage';
import { MeetingListProvider } from '../../providers/meeting-list.service';
import { GeolocateProvider } from '../../providers/geolocate.service';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { Geolocation } from '@ionic-native/geolocation/ngx';
import { LoadingService } from '../../providers/loading.service';

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
  currentAddress: any = '';
  addressLatitude: any = 0;
  addressLongitude: any = 0;
  radius: number;
  radiusMeters = 10000;

  constructor(private MeetingListProvider: MeetingListProvider,
              private loaderCtrl: LoadingService,
              private storage: Storage,
              private translate: TranslateService,
              private GeolocateProvider: GeolocateProvider,
              private geolocation: Geolocation) {
    this.meetingsListGrouping = 'weekday_tinyint';

    this.storage.ready().then(() => {

      this.storage.get('searchRange')
        .then(searchValue => {
          if (searchValue) {
            this.radius = searchValue;
          } else {
            this.radius = 25;
          }
        });

      this.storage.get('savedAddressLat').then(value => {
        if (value) {
          this.addressLatitude = value;
          this.storage.get('savedAddressLng').then(value => {
            if (value) {
              this.addressLongitude = value;
              this.getAllMeetings();
              // Do not use address
              // this.storage.get('savedAddress').then(value => {
              //   if (value) {
              //     this.currentAddress = value;
              //     this.getAllMeetings();
              //   } else {
              //     this.locatePhone();
              //   }
              // });
            } else {
              this.locatePhone();
            }
          });
        } else {
          this.locatePhone();
        }
      });
    });

  }

  getAllMeetings() {
    this.translate.get('FINDING_MTGS').subscribe(value => { this.presentLoader(value); });
    this.MeetingListProvider.getAddressMeetings(this.addressLatitude, this.addressLongitude, this.radius).subscribe((data) => {
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
    this.translate.get('LOCATING').subscribe(value => { this.presentLoader(value); });
    let locationTimeout = setTimeout(()=>{
      this.dismissLoader();
    }, 10000);
    this.geolocation.getCurrentPosition().then((resp) => {
      clearTimeout(locationTimeout);
      this.addressLatitude = resp.coords.latitude;
      this.addressLongitude = resp.coords.longitude;

      this.storage.set('savedAddressLat', this.addressLatitude);
      this.storage.set('savedAddressLng', this.addressLongitude);

      this.dismissLoader();

      this.getAllMeetings();

    }).catch((error) => {
      clearTimeout(locationTimeout);
      this.currentAddress = 'Location not found';
      this.dismissLoader();
    });
  }



}

