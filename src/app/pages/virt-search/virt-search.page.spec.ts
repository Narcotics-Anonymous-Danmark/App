import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { IonicModule } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Storage } from '@ionic/storage';

import { MeetingListProvider } from '../../providers/meeting-list.service';

import { VirtSearchPage } from './virt-search.page';
import { TranslateServiceMock } from '../../../testing/translate.service.mock';
import { LoadingServiceMock } from '../../../testing/loading.service.mock';
import { LoadingService } from '../../providers/loading.service';
import { MeetingListProviderMock } from '../../../testing/meeting-list.provider.mock';

describe('VirtSearchPage', () => {
    let component: VirtSearchPage;
    let fixture: ComponentFixture<VirtSearchPage>;
    let meetingListProviderSpy;
    let translateServiceSpy;
    let dummy;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [VirtSearchPage],
            imports: [IonicModule.forRoot()],
            providers: [
                { provide: InAppBrowser, useValue: dummy },
                { provide: Storage, useValue: dummy },
                { provide: MeetingListProvider, useClass: MeetingListProviderMock },
                { provide: LoadingService, useClass: LoadingServiceMock },
                { provide: TranslateService, useClass: TranslateServiceMock },
            ]

        }).compileComponents();

        fixture = TestBed.createComponent(VirtSearchPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }));

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
