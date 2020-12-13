import { TestBed } from '@angular/core/testing';

import { ServiceGroupsProvider } from './service-groups.service';

describe('ServiceGroupsProvider', () => {
    let service: ServiceGroupsProvider;
    let httpClientSpy, httpSpy;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        //service = TestBed.inject(ServiceGroupsProvider);
        service = new ServiceGroupsProvider(httpClientSpy as any, httpSpy as any)
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
