import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { JftService } from './jft.service';

describe('JftService', () => {
    let service: JftService;
    let httpClientSpy;
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClient]
        });
        service = new JftService(httpClientSpy);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
