import { TestBed } from '@angular/core/testing';
import { HTTP } from '@ionic-native/http/ngx';

import { VirtFormatsProvider } from './virt-formats.service';

describe('VirtFormatsProvider', () => {
    let service: VirtFormatsProvider;
    let httpSpy;
    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                { provide: HTTP, useValue: httpSpy },
            ]
        });
        service = TestBed.inject(VirtFormatsProvider);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
