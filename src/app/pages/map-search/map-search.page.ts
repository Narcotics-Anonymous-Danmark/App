import { Component, NgZone, OnInit } from '@angular/core';
import { Storage } from '@ionic/storage';
import { Platform, ModalController } from '@ionic/angular';
import { MeetingListProvider } from '../../providers/meeting-list.service';
import { LoadingService } from '../../providers/loading.service';
import { TranslateService } from '@ngx-translate/core';
import { GoogleMaps, GoogleMap, GoogleMapOptions, GoogleMapsEvent, MarkerCluster, Marker, MarkerLabel, MarkerOptions,
         MarkerClusterIcon, MarkerClusterOptions, ILatLng, LatLng, VisibleRegion, CameraPosition, Spherical, Environment,
         LocationService, MyLocation, Geocoder, GeocoderResult } from '@ionic-native/google-maps/ngx';
import { ModalPage } from '../modal/modal.page';
import { Base64 } from '@ionic-native/base64/ngx';

declare const google: any;
@Component({
  selector: 'app-map-search',
  templateUrl: './map-search.page.html',
  styleUrls: ['./map-search.page.scss'],
})
export class MapSearchPage implements OnInit {

  meetingList: any = [];
  loader = null;
  zoom = 8;
  mapLatitude: any = 55.476224;
  mapLongitude: any = 8.4606976;

  eagerMapLat: number;
  eagerMapLng: number;

  origLocation = { lat: 55.476, lng: 8.460 };
  origZoom = 10;

  targLocation = { lat: 55.476, lng: 8.460 };
  targZoom = 10;

  formattedAddress = '';

  GoogleAutocomplete: { getPlacePredictions: (arg0: { input: any; }, arg1: (predictions: any, status: any) => void) => void; };
  autocompleteItems: any[];
  autocomplete: { input: any; };

  latitude = 0;
  longitude = 0;

  autoRadius = 5;
  map: GoogleMap;
  visibleRegion: VisibleRegion;
  marker: Marker;
  markers = [];
  meeting: any;
  ids: string;
  data: any;
  mapDragInProgress = false;
  cameraMoveInProgress = false;
  markerCluster: MarkerCluster;
  Base64MarkerRed: string;
  Base64MarkerBlue: string;
  Base64MarkerZero: string;

  Base64ClusterMarkerM1: string;
  Base64ClusterMarkerM2: string;
  Base64ClusterMarkerM3: string;
  Base64ClusterMarkerM4: string;
  Base64ClusterMarkerM5: string;

  filePathMarkerRed: string;
  filePathMarkerBlue: string;
  filePathMarkerZero: string;
  searchMarker: Marker;

  formatLanguage = 'en';

  constructor(
    private meetingListProvider: MeetingListProvider,
    public loadingCtrl: LoadingService,
    private storage: Storage,
    private platform: Platform,
    private translate: TranslateService,
    private zone: NgZone,
    public modalCtrl: ModalController,
    private base64: Base64,
  ) {
    console.log('Map page constructor');
  }

  async ngOnInit() {

    this.filePathMarkerRed = './assets/markercluster/MarkerRed.png';
    this.base64.encodeFile(this.filePathMarkerRed).then((base64imageR: string) => {
      this.Base64MarkerRed = base64imageR;
    });

    this.filePathMarkerBlue = '/assets/markercluster//MarkerBlue.png';
    this.base64.encodeFile(this.filePathMarkerBlue).then((base64imageB: string) => {
      this.Base64MarkerBlue = base64imageB;
    });

    this.filePathMarkerZero = '/assets/markercluster/FFFFFF-0.png';
    this.base64.encodeFile(this.filePathMarkerZero).then((base64imageZ: string) => {
      this.Base64MarkerZero = base64imageZ;
    });

    const filePathCusterMarkerM1 = '../../../assets/markercluster/m1.png';
    this.base64.encodeFile(filePathCusterMarkerM1).then((base64imageM1: string) => {
      this.Base64ClusterMarkerM1 = base64imageM1;
    });

    const filePathCusterMarkerM2 = '../../../assets/markercluster/m2.png';
    this.base64.encodeFile(filePathCusterMarkerM2).then((base64imageM2: string) => {
      this.Base64ClusterMarkerM2 = base64imageM2;
    });

    const filePathCusterMarkerM3 = '../../../assets/markercluster/m3.png';
    this.base64.encodeFile(filePathCusterMarkerM3).then((base64imageM3: string) => {
      this.Base64ClusterMarkerM3 = base64imageM3;
    });

    const filePathCusterMarkerM4 = '../../../assets/markercluster/m4.png';
    this.base64.encodeFile(filePathCusterMarkerM4).then((base64imageM4: string) => {
      this.Base64ClusterMarkerM4 = base64imageM4;
    });

    const filePathCusterMarkerM5 = '../../../assets/markercluster/m5.png';
    this.base64.encodeFile(filePathCusterMarkerM5).then((base64imageM5: string) => {
      this.Base64ClusterMarkerM5 = base64imageM5;
    });


    this.GoogleAutocomplete = new google.maps.places.AutocompleteService();
    this.autocomplete = { input: '' };
    this.autocompleteItems = [];

    await this.platform.ready();
    await this.loadMap();

  }

  loadMap() {

    Environment.setEnv({
      API_KEY_FOR_BROWSER_RELEASE: 'AIzaSyAiowBMk_xPfnzaq7wZzcbyuCDpKqzZkyA',
      API_KEY_FOR_BROWSER_DEBUG: 'AIzaSyAiowBMk_xPfnzaq7wZzcbyuCDpKqzZkyA'
    });

    this.translate.get('LOCATING').subscribe(value => {
      this.presentLoader(value);
    });

    if (LocationService.hasPermission()) {
      let locationTimeout = setTimeout(()=>{
        this.drawMap();
        this.dismissLoader();
      }, 10000);
      LocationService.getMyLocation().then((myLocation: MyLocation) => {
        clearTimeout(locationTimeout);
        this.mapLatitude = this.eagerMapLat = myLocation.latLng.lat;
        this.mapLongitude = this.eagerMapLng = myLocation.latLng.lng;
        this.drawMap();
        this.dismissLoader();
      }, (reason) => {
        clearTimeout(locationTimeout);
        this.eagerMapLat = this.mapLatitude;
        this.eagerMapLng = this.mapLongitude;
        this.drawMap();
        this.dismissLoader();
      });
    } else {
      this.eagerMapLat = this.mapLatitude;
      this.eagerMapLng = this.mapLongitude;
      this.drawMap();
      this.dismissLoader();
    }
  }


  drawMap() {
    const options: GoogleMapOptions = {
      building: true,
      controls: {
        compass: true,
        myLocationButton: true,
        myLocation: true,   // (blue dot)
        zoom: true,          // android only
        mapToolbar: true     // android only
      },
      gestures: {
        scroll: true,
        tilt: true,
        zoom: true,
        rotate: true
      },
      camera: {
        target: {
          lat: this.mapLatitude,
          lng: this.mapLongitude
        },
        zoom: 8
      }
    };

    this.map = GoogleMaps.create('map_canvas', options);

    this.map.one(GoogleMapsEvent.MAP_READY).then(this.onMapReady.bind(this));
  }

  onMapReady() {

    this.map.on(GoogleMapsEvent.MAP_DRAG_START).subscribe((params: any[]) => {
      this.mapDragInProgress = true;
    });

    this.map.on(GoogleMapsEvent.MAP_DRAG_END).subscribe((params: any[]) => {
      this.mapDragInProgress = false;
    });

    this.map.on(GoogleMapsEvent.CAMERA_MOVE_START).subscribe((params: any[]) => {
      this.cameraMoveInProgress = true;
    });

    this.map.on(GoogleMapsEvent.CAMERA_MOVE_END).subscribe((params: any[]) => {
      if (this.mapDragInProgress === false) {
        this.cameraMoveInProgress = false;
        this.translate.get('FINDING_MTGS').subscribe(value => {
          this.presentLoader(value);
        });

        // if the map has only moved by less than 10%, then we dont get more meetings,
        // those will have been eagerly loaded earlier
        this.origLocation.lat = this.eagerMapLat;
        this.origLocation.lng = this.eagerMapLng;

        this.targLocation.lat = params[0].target.lat;
        this.targLocation.lng = params[0].target.lng;
        this.targZoom = params[0].zoom;

        const mapMovementDistance = Spherical.computeDistanceBetween(this.origLocation, this.targLocation) / 1000;
        const newSearchTriggerDistance = this.autoRadius / 11;
        if ((mapMovementDistance > newSearchTriggerDistance) || (this.targZoom < this.origZoom)) {
          this.deleteCluster();
          this.getMeetings(params);
        } else {
          this.dismissLoader();
        }
      }
    });

    this.map.on('trigger_initial_search_changed').subscribe((params: any[]) => {
      this.translate.get('FINDING_MTGS').subscribe(value => {
        this.presentLoader(value);
      });
      const mapPositionTarget: ILatLng = this.map.getCameraTarget();
      const mapPositionZoom = this.map.getCameraZoom();
      const mapVisiblePosition = this.map.getVisibleRegion();

      params[0] = {
        target: {
          lat: mapPositionTarget.lat,
          lng: mapPositionTarget.lng
        },
        zoom: mapPositionZoom,
        farLeft: {
          lat: mapVisiblePosition.farLeft.lat,
          lng: mapVisiblePosition.farLeft.lng
        }
      };
      this.getMeetings(params);
    });

    if (this.platform.is('ios')) {
      this.map.set('trigger_initial_search', 'go');
    }

  }


  addCluster() {
    const markerLabelOptions: MarkerLabel = {
      bold: true,
      fontSize: 15,
      color: 'white',
      italic: false
    };
    let markerClusterIconOptions: MarkerClusterIcon[];
    if (this.platform.is('ios')) {
      markerClusterIconOptions = [
        { min: 3, max: 10, url: this.Base64ClusterMarkerM1, anchor: { x: 16, y: 16 }, label: markerLabelOptions },
        { min: 11, max: 50, url: this.Base64ClusterMarkerM2, anchor: { x: 16, y: 16 }, label: markerLabelOptions },
        { min: 51, max: 100, url: this.Base64ClusterMarkerM3, anchor: { x: 24, y: 24 }, label: markerLabelOptions },
        { min: 101, max: 500, url: this.Base64ClusterMarkerM4, anchor: { x: 24, y: 24 }, label: markerLabelOptions },
        { min: 501, url: this.Base64ClusterMarkerM5, anchor: { x: 32, y: 32 }, label: markerLabelOptions }
      ];
    } else {
      markerClusterIconOptions = [
        { min: 3, max: 10, url: './assets/markercluster/m1.png', anchor: { x: 16, y: 16 }, label: markerLabelOptions },
        { min: 11, max: 50, url: './assets/markercluster/m2.png', anchor: { x: 16, y: 16 }, label: markerLabelOptions },
        { min: 51, max: 100, url: './assets/markercluster/m3.png', anchor: { x: 24, y: 24 }, label: markerLabelOptions },
        { min: 101, max: 500, url: './assets/markercluster/m4.png', anchor: { x: 24, y: 24 }, label: markerLabelOptions },
        { min: 501, url: './assets/markercluster/m5.png', anchor: { x: 32, y: 32 }, label: markerLabelOptions }
      ];
    }

    const markerClusterOptions: MarkerClusterOptions = {
      markers: this.markers,
      icons: markerClusterIconOptions,
      boundsDraw: false
    };

    this.map.addMarkerCluster(markerClusterOptions).then((markerCluster: MarkerCluster) => {
      this.markerCluster = markerCluster;
      this.markerCluster.on(GoogleMapsEvent.MARKER_CLICK).subscribe((params: Marker[]) => {
        const marker: Marker = params[1];
        this.openMeetingModal(marker.get('ID'));
      });
      this.dismissLoader();
    });
  }


  deleteCluster() {
    this.markers = [];
    this.markers.length = 0;
    this.meetingList = [];
    this.meetingList.length = 0;
    if (typeof this.markerCluster !== 'undefined') {
      this.markerCluster.remove();
      this.markerCluster.empty();
      this.markerCluster.destroy();
    }
  }


  getMeetings(params: any[] | { farLeft: ILatLng; }[]) {
    this.mapLatitude = params[0].target.lat;
    this.eagerMapLat = this.mapLatitude;

    this.mapLongitude = params[0].target.lng;
    this.eagerMapLng = this.mapLongitude;

    this.origZoom = params[0].zoom;

    this.autoRadius = Spherical.computeDistanceBetween(params[0].target, params[0].farLeft) / 1000;
    // Eagerly load 10% around screen area
    this.autoRadius = this.autoRadius * 1.1;

    this.meetingListProvider.getRadiusMeetings(this.mapLatitude, this.mapLongitude, this.autoRadius).subscribe((data) => {
      if (JSON.stringify(data) === '{}') {  // empty result set!
        this.meetingList = JSON.parse('[]');
      } else {
        this.meetingList = data;
        this.meetingList = this.meetingList.filter((meeting: { latitude }) => meeting.latitude = parseFloat(meeting.latitude));
        this.meetingList = this.meetingList.filter((meeting: { longitude }) => meeting.longitude = parseFloat(meeting.longitude));
      }
      this.populateMarkers();
      this.addCluster();
    });
  }


  populateMarkers() {

    this.markers = [];
    let i: number;
    let areColocated = false;
    this.visibleRegion = this.map.getVisibleRegion();

    for (i = 0; i < this.meetingList.length; i++) {
      const meetingLocation = {
        lat: this.meetingList[i].latitude,
        lng: this.meetingList[i].longitude
      };
      if (this.visibleRegion.contains((meetingLocation) as LatLng)) {
        if (i === (this.meetingList.length - 1)) {
          // Last meeting on the list
          this.pushStandaloneMeeting(i);
        } else {
          // Not the last meeting in the list

          // Is this meeting in the same location as the next meeting on the list?
          areColocated = this.meetingsAreCoLocated(this.meetingList[i], this.meetingList[i + 1]);

          if (areColocated === false) {
            this.pushStandaloneMeeting(i);
          } else {
            // We have the start of some co-located meetings on the list
            this.ids = this.meetingList[i].id_bigint;
            do {
              this.ids += '&meeting_ids[]=' + this.meetingList[i + 1].id_bigint;
              if (this.platform.is('ios')) {
                this.data = {
                  position: { lat: this.meetingList[i].latitude, lng: this.meetingList[i].longitude },
                  icon: this.Base64MarkerZero
                };
              } else {
                this.data = {
                  position: { lat: this.meetingList[i].latitude, lng: this.meetingList[i].longitude },
                  icon: this.filePathMarkerZero
                };
              }
              this.markers.push(this.data);

              i++;
              // Is this the end of the list?
              if (i === (this.meetingList.length - 1)) {
                break;
              }
            } while (this.meetingsAreCoLocated(this.meetingList[i], this.meetingList[i + 1]));

            if (this.platform.is('ios')) {
              this.data = {
                position: { lat: this.meetingList[i].latitude, lng: this.meetingList[i].longitude },
                ID: this.ids,
                disableAutoPan: true,
                icon: this.Base64MarkerRed
              };
            } else {
              this.data = {
                position: { lat: this.meetingList[i].latitude, lng: this.meetingList[i].longitude },
                ID: this.ids,
                disableAutoPan: true,
                icon: this.filePathMarkerRed
              };
            }
            this.markers.push(this.data);
          }
        }
      }
    }
  }


  meetingsAreCoLocated(i: { latitude: number; longitude: number; }, j: { latitude: number; longitude: number; }) {
    let areColocated = false;
    if (((Math.round(i.latitude * 1000) / 1000) !== (Math.round(j.latitude * 1000) / 1000)) ||
      ((Math.round(i.longitude * 1000) / 1000) !== (Math.round(j.longitude * 1000) / 1000))) {
      areColocated = false;
    } else {
      areColocated = true;
    }
    return areColocated;
  }


  pushStandaloneMeeting(i: number) {
    if (this.platform.is('ios')) {
      this.data = {
        position: { lat: this.meetingList[i].latitude, lng: this.meetingList[i].longitude },
        ID: this.meetingList[i].id_bigint,
        disableAutoPan: true,
        icon: this.Base64MarkerBlue
      };
    } else {
      this.data = {
        position: { lat: this.meetingList[i].latitude, lng: this.meetingList[i].longitude },
        ID: this.meetingList[i].id_bigint,
        disableAutoPan: true,
        icon: this.filePathMarkerBlue
      };
    }
    this.markers.push(this.data);
  }


  updateSearchResults() {
    if (this.autocomplete.input === '') {
      this.autocompleteItems = [];
      return;
    }
    this.GoogleAutocomplete.getPlacePredictions({ input: this.autocomplete.input },
      (predictions, status) => {
        this.autocompleteItems = [];
        this.zone.run(() => {
          predictions.forEach((prediction: any) => {
            this.autocompleteItems.push(prediction);
          });
        });
      });
  }


  selectSearchResult(item: { description: string }) {
    this.autocompleteItems = [];
    this.autocomplete.input = item.description;

    // Address -> latitude,longitude
    Geocoder.geocode({
      address: item.description
    }).then((results: GeocoderResult[]) => {

      // Add a marker
      if (this.searchMarker) {
        this.searchMarker.remove();
      }

      this.searchMarker = this.map.addMarkerSync({
        position: results[0].position,
        title: item.description
      });

      this.searchMarker.on(GoogleMapsEvent.MARKER_CLICK).subscribe(this.onMarkerClick);
      this.searchMarker.on(GoogleMapsEvent.INFO_CLICK).subscribe(this.onMarkerClick);

      // Move to the position
      this.map.moveCamera({
        target: results[0].position,
        zoom: 10
      }).then(() => {
        this.searchMarker.showInfoWindow();
      });
    });
  }


  public onMarkerClick(params: any) {
    const searchMarkerClicked: Marker = params[1] as Marker;
    const isSearchMarkerClicked: any = searchMarkerClicked.get('isInfoWindowVisible');

    if (searchMarkerClicked.isInfoWindowShown() === true) {
      searchMarkerClicked.hideInfoWindow();
    } else {
      searchMarkerClicked.showInfoWindow();
    }
  }


  presentLoader(loaderText: any) {
    if (!this.loader) {
      this.loader = this.loadingCtrl.present(loaderText);
    }
  }


  dismissLoader() {
    if (this.loader) {
      console.log('Dismissing loader..');
      this.loader = this.loadingCtrl.dismiss();
      this.loader = null;
    }
  }


  openMeetingModal(meetingID) {
    console.log('openMeetingModal()');
    this.meetingListProvider.getSingleMeetingByID(meetingID).subscribe((meeting) => {
      this.meeting = meeting;
      this.meeting.filter((i) => i.start_time_raw = this.convertTo12Hr(i.start_time));
      this.openModal(this.meeting);
    });
  }


  async openModal(meeting) {
    const modal = await this.modalCtrl.create({
      component: ModalPage,
      componentProps: {
        data: this.meeting
      }
    });

    modal.onDidDismiss().then((dataReturned) => {
    });

    return await modal.present();
  }

  public openMapsLink(destLatitude: string, destLongitude: string) {
    window.open('https://www.google.com/maps/search/?api=1&query=' + destLatitude + '%2C' + destLongitude + ')', '_system');
  }

  public convertTo12Hr(timeString) {
    const H = +timeString.substr(0, 2);
    const h = H % 12 || 12;
    const ampm = (H < 12 || H === 24) ? ' am' : ' pm';
    timeString = h + timeString.substr(2, 3) + ampm;
    return timeString;
  }

}

