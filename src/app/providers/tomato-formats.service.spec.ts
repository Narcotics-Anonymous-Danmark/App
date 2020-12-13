import { TestBed } from '@angular/core/testing';

import { TomatoFormatsService } from './tomato-formats.service';

describe('TomatoFormatsService', () => {
    let service: TomatoFormatsService;
    let httpClientDummy;

  beforeEach(() => {
    TestBed.configureTestingModule({});
      //service = TestBed.inject(TomatoFormatsService);
      service = new TomatoFormatsService(httpClientDummy);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
