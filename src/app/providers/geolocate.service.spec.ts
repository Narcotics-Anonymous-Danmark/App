import { TestBed } from '@angular/core/testing';

import { GeolocateProvider } from './geolocate.service';

describe('GeolocateProvider', () => {
    let service: GeolocateProvider;
    let httpClientDummy;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        //service = TestBed.inject(GeolocateProvider);
        service = new GeolocateProvider(httpClientDummy);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
