import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { AudioService } from './audio.service';

describe('AudioService', () => {
    let service: AudioService;
    let httpClientSpy;
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClient]
        });
        //service = TestBed.inject(AudioService);
        service = new AudioService(httpClientSpy);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
