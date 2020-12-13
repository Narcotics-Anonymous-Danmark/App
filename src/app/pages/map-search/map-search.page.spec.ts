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

        //googleAutocompleteSpy.google.maps.places.AutocompleteService.and.callFake(
        //    () => {
        //        return new Promise(function (resolve: Function): void {
        //            resolve(expectedTranslation);
        //        });
        //    }
        //);


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



    //let stubGoogleAPIS = function () {
    //    return {
    //        maps: {
    //            //https://developers.google.com/maps/documentation/javascript/reference#Animation
    //            Animation: {},
    //            //https://developers.google.com/maps/documentation/javascript/reference#Attribution
    //            Attribution: {},
    //            //https://developers.google.com/maps/documentation/javascript/reference#BicyclingLayer
    //            BicyclingLayer: function () {
    //                return {
    //                    //methods
    //                    getMap: function () { },
    //                    setMap: function () { }
    //                }
    //            },
    //            Circle: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#ControlPosition
    //            ControlPosition: {},
    //            //https://developers.google.com/maps/documentation/javascript/reference#Data
    //            Data: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#DirectionsRenderer
    //            DirectionsRenderer: function () {
    //                return {
    //                    getDirections: function () { },
    //                    getMap: function () { },
    //                    getPanel: function () { },
    //                    getRouteIndex: function () { },
    //                    setDirections: function () { },
    //                    setMap: function () { },
    //                    setOptions: function () { },
    //                    setPanel: function () { },
    //                    setRouteIndex: function () { }
    //                }
    //            },
    //            //https://developers.google.com/maps/documentation/javascript/reference#DirectionsService
    //            DirectionsService: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#DirectionsStatus
    //            DirectionsStatus: {},
    //            //https://developers.google.com/maps/documentation/javascript/reference#DistanceMatrixElementStatus
    //            DistanceMatrixElementStatus: {},
    //            //https://developers.google.com/maps/documentation/javascript/reference#DistanceMatrixService
    //            DistanceMatrixService: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#DistanceMatrixStatus
    //            DistanceMatrixStatus: {},
    //            //https://developers.google.com/maps/documentation/javascript/reference#ElevationService
    //            ElevationService: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#ElevationStatus
    //            ElevationStatus: {},
    //            //https://developers.google.com/maps/documentation/javascript/reference#FusionTablesLayer
    //            FusionTablesLayer: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#Geocoder
    //            Geocoder: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#GeocoderLocationType
    //            GeocoderLocationType: {},
    //            //https://developers.google.com/maps/documentation/javascript/reference#GeocoderStatus
    //            GeocoderStatus: {},
    //            //https://developers.google.com/maps/documentation/javascript/reference#GroundOverlay
    //            GroundOverlay: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#ImageMapType
    //            ImageMapType: function () { },
    //            InfoWindow: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#KmlLayer
    //            KmlLayer: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#KmlLayerStatus
    //            KmlLayerStatus: {},
    //            //https://developers.google.com/maps/documentation/javascript/reference#LatLng
    //            LatLng: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#LatLngBounds
    //            LatLngBounds: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#MVCArray
    //            MVCArray: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#MVCObject
    //            MVCObject: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#Map
    //            Map: function () {
    //                return {
    //                    //methods
    //                    fitBounds: function () { },
    //                    getBounds: function () { },
    //                    getCenter: function () { },
    //                    getClickableIcons: function () { },
    //                    getDiv: function () { },
    //                    getHeading: function () { },
    //                    getMapTypeId: function () { },
    //                    getProjection: function () { },
    //                    getStreetView: function () { },
    //                    getTilt: function () { },
    //                    getZoom: function () { },
    //                    panBy: function (x, y) { },
    //                    panTo: function (latLng) { },
    //                    panToBounds: function () { },
    //                    setCenter: function (latlng) { },
    //                    setClickableIcons: function (value) { },
    //                    setHeading: function (heading) { },
    //                    setMapTypeId: function (mapTypeId) { },
    //                    setOptions: function (options) { },
    //                    setStreetView: function (panorama) {
    //                        return {
    //                            //https://developers.google.com/maps/documentation/javascript/reference/street-view#StreetViewPanorama
    //                            getLinks: function () { },
    //                            getLocation: function () { },
    //                            getMotionTracking: function () { },
    //                            getPano: function () { },
    //                            getPhotographerPov: function () { },
    //                            getPosition: function () { },
    //                            getPov: function () { },
    //                            getStatus: function () { },
    //                            getVisible: function () { },
    //                            getZoom: function () { },
    //                            registerPanoProvider: function () { },
    //                            setLinks: function (links) { },
    //                            setMotionTracking: function (motionTracking) { },
    //                            setOptions: function (options) { },
    //                            setPano: function () { },
    //                            setPosition: function (latLng) { },
    //                            setPov: function (pov) { },
    //                            setVisible: function (flag) { },
    //                            setZoom: function (zoom) { }
    //                        }
    //                    },
    //                    setTilt: function (tilt) { },
    //                    setZoom: function (zoom) { },
    //                    //properties
    //                    controls: {},
    //                    data: {
    //                        //https://developers.google.com/maps/documentation/javascript/reference#Data
    //                        //methods
    //                        add: function () { },
    //                        addGeoJson: function () { },
    //                        contains: function () { },
    //                        forEach: function () { },
    //                        getControlPosition: function () { },
    //                        getControls: function () { },
    //                        getDrawingMode: function () { },
    //                        getFeatureById: function () { },
    //                        getMap: function () { },
    //                        getStyle: function () { },
    //                        loadGeoJson: function () { },
    //                        overrideStyle: function () { },
    //                        remove: function () { },
    //                        revertStyle: function () { },
    //                        setControlPosition: function () { },
    //                        setControls: function () { },
    //                        setDrawingMode: function () { },
    //                        setMap: function () { },
    //                        setStyle: function () { },
    //                        toGeoJson: function () { },
    //                        //properties
    //                        controlPosition: {},
    //                        controls: [],

    //                    },
    //                    mapTypes: {
    //                        //https://developers.google.com/maps/documentation/javascript/reference#MapTypeRegistry
    //                        //methods
    //                        set: function () { }
    //                    },
    //                    overlayMapTypes: {
    //                        //https://developers.google.com/maps/documentation/javascript/reference#MVCArray
    //                        clear: function () { },
    //                        forEach: function () { },
    //                        getArray: function () { },
    //                        getAt: function () { },
    //                        getLength: function () { },
    //                        insertAt: function () { },
    //                        pop: function () { },
    //                        push: function () { },
    //                        removeAt: function () { },
    //                        setAt: function () { }
    //                    }
    //                };
    //            },
    //            MapTypeControlStyle: {},
    //            //https://developers.google.com/maps/documentation/javascript/reference#MapTypeId
    //            MapTypeId: {
    //                HYBRID: '',
    //                ROADMAP: '',
    //                SATELLITE: '',
    //                TERRAIN: ''
    //            },
    //            //https://developers.google.com/maps/documentation/javascript/reference#MapTypeRegistry
    //            MapTypeRegistry: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#Marker
    //            Marker: function () {
    //                return {
    //                    setTitle: function (visible) { },
    //                    setVisible: function () { },
    //                    setZIndex: function () { }
    //                }
    //            },
    //            MarkerImage: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#MarkerOptions
    //            MarkerOptions: {
    //                //properties
    //                anchorPoint: {
    //                    //https://developers.google.com/maps/documentation/javascript/reference/coordinates#Point
    //                    equals: function () { },
    //                    toString: function () { }
    //                },
    //                animation: {
    //                    BOUNCE: '',
    //                    DROP: ''
    //                },
    //                visible: false
    //            },
    //            //https://developers.google.com/maps/documentation/javascript/reference#MaxZoomService
    //            MaxZoomService: function () {
    //                return {
    //                    getMaxZoomAtLatLng: function (latlng, callback) { }
    //                };
    //            },
    //            //https://developers.google.com/maps/documentation/javascript/reference#MaxZoomStatus
    //            MaxZoomStatus: {},
    //            NavigationControlStyle: {},
    //            OverlayView: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#Point
    //            Point: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference/polygon#Polygon
    //            Polygon: function () {
    //                return {
    //                    getDraggable: function () { },
    //                    getEditable: function () { },
    //                    getMap: function () { },
    //                    getPath: function () { },
    //                    getPaths: function () { },
    //                    getVisible: function () { },
    //                    setDraggable: function (draggable) { },
    //                    setEditable: function (editable) { },
    //                    setMap: function (map) { },
    //                    setOptions: function (options) { },
    //                    setPath: function (path) { },
    //                    setPaths: function (paths) { },
    //                    setVisible: function (visible) { }
    //                }
    //            },
    //            //https://developers.google.com/maps/documentation/javascript/reference#Polyline
    //            Polyline: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#Rectangle
    //            Rectangle: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#SaveWidget
    //            SaveWidget: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#ScaleControlStyle
    //            ScaleControlStyle: {},
    //            //https://developers.google.com/maps/documentation/javascript/reference#Size
    //            Size: function (width, height, widthUnit, heightUnit) { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#StreetViewCoverageLayer
    //            StreetViewCoverageLayer: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#StreetViewPanorama
    //            StreetViewPanorama: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#StreetViewService
    //            StreetViewService: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#StreetViewStatus
    //            StreetViewStatus: {},
    //            //https://developers.google.com/maps/documentation/javascript/reference#StrokePosition
    //            StrokePosition: {},
    //            //https://developers.google.com/maps/documentation/javascript/reference#StyledMapType
    //            StyledMapType: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#SymbolPath
    //            SymbolPath: {},
    //            //https://developers.google.com/maps/documentation/javascript/reference#TrafficLayer
    //            TrafficLayer: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#TransitLayer
    //            TransitLayer: function () { },
    //            //https://developers.google.com/maps/documentation/javascript/reference#TransitMode
    //            TransitMode: {},
    //            //https://developers.google.com/maps/documentation/javascript/reference#TransitRoutePreference
    //            TransitRoutePreference: {},
    //            //https://developers.google.com/maps/documentation/javascript/reference#TravelMode
    //            TravelMode: {},
    //            //https://developers.google.com/maps/documentation/javascript/reference#UnitSystem
    //            UnitSystem: {},
    //            //https://developers.google.com/maps/documentation/javascript/reference#ZoomControlStyle
    //            ZoomControlStyle: {},
    //            __gjsload__: function () { },
    //            event: {
    //                addListener: function () { },
    //                addDomListener: function () { }
    //            },
    //            places: {
    //                AutocompleteService: function () {
    //                    return {
    //                        getPlacePredictions: function () { }
    //                    };
    //                }
    //            }
    //        },
    //        visualization: {
    //            ColumnChart: function () {
    //                return {
    //                    draw: function () { }
    //                }
    //            },
    //            //https://developers.google.com/chart/interactive/docs/reference#DataTable
    //            DataTable: function () {
    //                return {
    //                    addColumn: function (description_object) { },
    //                    addRow: function (opt_cellArray) { },
    //                    addRows: function (numOrArray) { },
    //                    clone: function () { },
    //                    getColumnId: function (columnIndex) { },
    //                    getColumnLabel: function (columnIndex) { },
    //                    getColumnPattern: function (columnIndex) { },
    //                    getColumnProperties: function (columnIndex) { },
    //                    getColumnProperty: function (columnIndex, name) { },
    //                    getColumnRange: function (columnIndex) { },
    //                    getColumnRole: function (columnIndex) { },
    //                    getColumnType: function (columnIndex) { },
    //                    getDistinctValues: function (columnIndex) { },
    //                    getFilteredRows: function (filters) { },
    //                    getFormattedValue: function (rowIndex, columnIndex) { },
    //                    getNumberOfColumns: function () { },
    //                    getNumberOfRows: function () { },
    //                    getProperties: function (rowIndex, columnIndex) { },
    //                    getProperty: function (rowIndex, columnIndex, name) { },
    //                    getRowProperties: function (rowIndex) { },
    //                    getRowProperty: function () { },
    //                    getSortedRows: function (sortedColumns) { },
    //                    getTableProperties: function () { },
    //                    getTableProperty: function (name) { },
    //                    getValue: function (rowIndex, columnIndex) { }
    //                }
    //            },

    //            //https://developers.google.com/chart/interactive/docs/reference#dataview-class
    //            DataView: {},
    //            //https://developers.google.com/chart/interactive/docs/reference#chartwrapperobject
    //            ChartWrapper: {},
    //            //https://developers.google.com/chart/interactive/docs/reference#charteditor-class
    //            ChartEditor: {},

    //        }
    //    };
    //};




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
