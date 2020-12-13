import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Storage } from '@ionic/storage';
import { ServiceGroupsProviderMock } from '../../../testing/service-groups.provider.mock';
import { MeetingListProvider } from '../../providers/meeting-list.service';
import { ServiceGroupsProvider } from '../../providers/service-groups.service';

import { VirtMeetingsPage } from './virt-meetings.page';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { LoadingServiceMock } from '../../../testing/loading.service.mock';
import { LoadingService } from '../../providers/loading.service';
import { TranslateServiceMock } from '../../../testing/translate.service.mock';
import { TranslatePipeMock } from '../../../testing/translate.pipe.mock';

describe('VirtMeetingsPage', () => {
    let component: VirtMeetingsPage;
    let fixture: ComponentFixture<VirtMeetingsPage>;

    let meetingListProviderSpy;
    let dummy;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [VirtMeetingsPage, TranslatePipeMock],
            imports: [IonicModule.forRoot()],
            providers: [
                { provide: TranslateService, useClass: TranslateServiceMock },
                { provide: Storage, useValue: dummy },
                { provide: InAppBrowser, useValue: dummy },
                { provide: MeetingListProvider, useValue: meetingListProviderSpy },
                { provide: ServiceGroupsProvider, useClass: ServiceGroupsProviderMock },
                { provide: LoadingService, useClass: LoadingServiceMock },
            ]

        }).compileComponents();

        fixture = TestBed.createComponent(VirtMeetingsPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }));

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
