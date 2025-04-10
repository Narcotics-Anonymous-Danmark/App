import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { HowAndWhyService } from './how-and-why.service';

describe('HowAndWhyService', () => {
    let service: HowAndWhyService;
    let httpClientSpy;
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClient]
        });
        service = new HowAndWhyService(httpClientSpy);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
