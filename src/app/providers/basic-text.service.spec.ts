import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { BasicTextService } from './basic-text.service';

describe('BasicTextService', () => {
    let service: BasicTextService;
    let httpClientSpy;
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClient]
        });
        service = new BasicTextService(httpClientSpy);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
