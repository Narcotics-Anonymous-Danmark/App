import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { Storage } from '@ionic/storage';
import { TranslateService } from '@ngx-translate/core';
import { StorageMock } from '../../../testing/storage.mock';
import { TranslatePipeMock } from '../../../testing/translate.pipe.mock';

import { CleantimeCounterPage } from './cleantime-counter.page';

describe('CleantimeCounterPage', () => {
    let component: CleantimeCounterPage;
    let fixture: ComponentFixture<CleantimeCounterPage>;

    let storageSpy;
    let translateServiceSpy;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [CleantimeCounterPage, TranslatePipeMock],
            imports: [IonicModule.forRoot()],
            providers: [
                { provide: Storage, useClass: StorageMock },
                { provide: TranslateService, useValue: translateServiceSpy },
]
        }).compileComponents();

        fixture = TestBed.createComponent(CleantimeCounterPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }));

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
