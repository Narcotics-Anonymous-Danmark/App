import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { EventService } from './event.service';

describe('EventService', () => {
    let service: EventService;
    let httpClientSpy;
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClient]
        });
        //service = TestBed.inject(EventService);
        service = new EventService(httpClientSpy);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
