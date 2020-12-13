import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { Storage } from '@ionic/storage';
import { TranslateModule } from '@ngx-translate/core';
import { StorageMock } from '../../../testing/storage.mock';

import { SettingsPage } from './settings.page';

describe('SettingsPage', () => {
    let component: SettingsPage;
    let fixture: ComponentFixture<SettingsPage>;
    let storageSpy;

    beforeEach(async(() => {
        storageSpy = jasmine.createSpyObj('storage', ['get', 'set', 'then']);

        TestBed.configureTestingModule({
            declarations: [SettingsPage],
            imports: [IonicModule.forRoot(), TranslateModule.forRoot()],
            providers: [
                { provide: Storage, useClass: StorageMock },
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(SettingsPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }));

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
