import { TestBed } from '@angular/core/testing';

import { MeetingListProvider } from './meeting-list.service';

describe('MeetingListProvider', () => {
    let service: MeetingListProvider;

    let httpClientSpy, httpSpy;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        //service = TestBed.inject(MeetingListProvider);
        service = new MeetingListProvider(httpClientSpy as any, httpSpy as any)
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
