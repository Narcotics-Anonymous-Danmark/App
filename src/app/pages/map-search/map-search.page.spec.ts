import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { MeetingListProvider } from '../../providers/meeting-list.service';
import { Storage } from '@ionic/storage';

import { MapSearchPage } from './map-search.page';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Base64 } from '@ionic-native/base64/ngx';
import { Pipe } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Base64Mock } from '../../../testing/base64.mock';

import {
    GoogleMaps, GoogleMap, GoogleMapOptions, GoogleMapsEvent, MarkerCluster, Marker, MarkerLabel, MarkerOptions,
    MarkerClusterIcon, MarkerClusterOptions, ILatLng, LatLng, VisibleRegion, CameraPosition, Spherical, Environment,
    LocationService, MyLocation, Geocoder, GeocoderResult
} from '@ionic-native/google-maps/ngx';
import { GoogleMapsMock } from '../../../testing/google.maps.mock';


// https://kwilson.io/blog/mock-out-google-maps-geocoder-with-jasmine-spies/
// https://stackoverflow.com/questions/16611747/fake-the-google-maps-objects-structure-with-javascript-for-unit-tests
// https://developers.google.com/maps/documentation/javascript/places-autocomplete

//import { defer, Observable, of } from 'rxjs';


//export function fakeAsyncResponse<T>(data: T) {
//    return defer(() => Promise.resolve(data));
//}

//const translateServiceStub = {
//    get() {
//        return of([{ id: 1 }]);
//        //return fakeAsyncResponse([{ id: 1 }]);
//    },
//    transform() {
//        return fakeAsyncResponse([{ id: 1 }]);
//    },
//    encodeFile() {
//        return fakeAsyncResponse([{ id: 1 }]);
//    },
//    subscribe() {
//        return fakeAsyncResponse([{ id: 1 }]);
//    }
//};

describe('MapSearchPage', () => {
    let component: MapSearchPage;
    let fixture: ComponentFixture<MapSearchPage>;

    let meetingListProviderSpy;
    let storageSpy;
    let translateServiceSpy;
    let base64Spy;
    let translateModuleSpy;

    let mockTranslationPipe;

    let googleAutocompleteSpy;

    let dummy;
    //{ provide: TranslateService, useValue: translateServiceSpy },
    //{ provide: TranslateService, useValue: translateServiceStub },


    // in test file.
    beforeAll(() => {
        setupGoogleMock();
    });


    beforeEach(async(() => {
        translateServiceSpy = jasmine.createSpyObj('TranslateService', ['get']);
        translateModuleSpy = jasmine.createSpyObj('TranslateModule', ['transform', 'updateValue']);
        base64Spy = jasmine.createSpyObj('TranslateService', ['encodeFile']);


        //{ provide: GoogleMaps, useClass: GoogleMapsMock },
        //{ provide: GoogleMap, useValue: stubGoogleAPIS },
        //{ provide: MarkerCluster, useValue: dummy },
        //{ provide: Marker, useValue: dummy },
        //{ provide: LatLng, useValue: dummy },
        //{ provide: VisibleRegion, useValue: dummy },
        //{ provide: Spherical, useValue: dummy },
        //{ provide: Environment, useValue: dummy },
        //{ provide: LocationService, useClasss: GoogleMapsMock },
        //{ provide: Geocoder, useValue: dummy },


        TestBed.configureTestingModule({
            declarations: [MapSearchPage
            ],
            imports: [IonicModule.forRoot(), TranslateModule

                //GoogleMaps, GoogleMap, GoogleMapOptions, GoogleMapsEvent, MarkerCluster, Marker, MarkerLabel, MarkerOptions,
                //MarkerClusterIcon, MarkerClusterOptions, ILatLng, LatLng, VisibleRegion, CameraPosition, Spherical, Environment,
                //LocationService, MyLocation, Geocoder, GeocoderResult 
            ],
            providers: [
                { provide: MeetingListProvider, useValue: meetingListProviderSpy },
                { provide: Storage, useValue: storageSpy },
                { provide: TranslateService, useValue: translateServiceSpy },
                { provide: TranslateModule, useValue: translateModuleSpy },
                { provide: Base64, useClass: Base64Mock },
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(MapSearchPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }));

    xit('should create (ReferenceError: google is not defined)', () => {
        const expectedTranslation = 'en';
        translateModuleSpy.transform.and.callFake(
            () => {
                return new Promise(function (resolve: Function): void {
                    resolve(expectedTranslation);
                });
            }
        );

        const expectedEncodedResult = 'base64value';
        base64Spy.encodeFile.and.callFake(
            () => {
                of({});
                //return new Promise(function (resolve: Function): void {
                //    resolve(expectedEncodedResult);
                //});
            }
        );
        expect(component).toBeTruthy();
    });

    const setupGoogleMock = () => {
        /*** Mock Google Maps JavaScript API ***/
        const google = {
            maps: {
                places: {
                    AutocompleteService: () => { },
                    PlacesServiceStatus: {
                        INVALID_REQUEST: 'INVALID_REQUEST',
                        NOT_FOUND: 'NOT_FOUND',
                        OK: 'OK',
                        OVER_QUERY_LIMIT: 'OVER_QUERY_LIMIT',
                        REQUEST_DENIED: 'REQUEST_DENIED',
                        UNKNOWN_ERROR: 'UNKNOWN_ERROR',
                        ZERO_RESULTS: 'ZERO_RESULTS',
                    },
                },
                Geocoder: () => { },
                GeocoderStatus: {
                    ERROR: 'ERROR',
                    INVALID_REQUEST: 'INVALID_REQUEST',
                    OK: 'OK',
                    OVER_QUERY_LIMIT: 'OVER_QUERY_LIMIT',
                    REQUEST_DENIED: 'REQUEST_DENIED',
                    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
                    ZERO_RESULTS: 'ZERO_RESULTS',
                },
            },
        };
        //global.window.google = google;
    };


});
