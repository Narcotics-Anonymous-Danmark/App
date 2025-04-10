import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { StepWorkingGuidesService } from './step-working-guides.service';

describe('StepWorkingGuidesService', () => {
    let service: StepWorkingGuidesService;
    let httpClientSpy;
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClient]
        });
        service = new StepWorkingGuidesService(httpClientSpy);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
