import { TestBed } from '@angular/core/testing';

import { CleantimeService } from './cleantime.service';

describe('CleantimeService', () => {
  let service: CleantimeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CleantimeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
