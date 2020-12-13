import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { TranslateModule, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ServiceGroupsProviderMock } from '../../../testing/service-groups.provider.mock';
import { MeetingListProvider } from '../../providers/meeting-list.service';
import { ServiceGroupsProvider } from '../../providers/service-groups.service';

import { DoIHaveTheBmltPage } from './do-i-have-the-bmlt.page';
import { Storage } from '@ionic/storage';
import { Geolocation } from '@ionic-native/geolocation/ngx';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { TranslatePipeMock } from '../../../testing/translate.pipe.mock';
import { StorageMock } from '../../../testing/storage.mock';

describe('DoIHaveTheBmltPage', () => {
    let component: DoIHaveTheBmltPage;
    let fixture: ComponentFixture<DoIHaveTheBmltPage>;
    let meetingListProviderSpy;
    let translateServiceSpy;
    let storageSpy;
    let geolocationSpy;
    let iabSpy;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [DoIHaveTheBmltPage, TranslatePipeMock],
            imports: [IonicModule.forRoot()],
            providers: [
                { provide: MeetingListProvider, useValue: meetingListProviderSpy },
                { provide: ServiceGroupsProvider, useClass: ServiceGroupsProviderMock },
                { provide: TranslateService, useValue: translateServiceSpy },
                { provide: Storage, useClass: StorageMock },
                { provide: Geolocation, useValue: geolocationSpy },
                { provide: InAppBrowser, useValue: iabSpy },
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(DoIHaveTheBmltPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }));

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
