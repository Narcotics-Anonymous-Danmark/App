import { async, ComponentFixture, fakeAsync, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Storage } from '@ionic/storage';
import { StorageMock } from '../../../testing/storage.mock';
import { MeetingListProvider } from '../../providers/meeting-list.service';
import { ServiceGroupsProvider } from '../../providers/service-groups.service';

import { ListfullPage } from './listfull.page';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { of } from 'rxjs';
import { TranslateServiceMock } from '../../../testing/translate.service.mock';
import { ServiceGroupsProviderMock } from '../../../testing/service-groups.provider.mock';
import { TranslatePipeMock } from '../../../testing/translate.pipe.mock';
import { LoadingService } from '../../providers/loading.service';
import { LoadingServiceMock } from '../../../testing/loading.service.mock';

describe('ListfullPage', () => {
    let component: ListfullPage;
    let fixture: ComponentFixture<ListfullPage>;

    let translateServiceSpy;// = jasmine.createSpyObj('TranslateService', ['get']);

    let meetingListProviderSpy;
    let serviceGroupsProviderSpy;
    let iabSpy;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [ListfullPage, TranslatePipeMock],
            imports: [IonicModule.forRoot()],
            providers: [
                { provide: InAppBrowser, useValue: iabSpy },
                { provide: Storage, useClass: StorageMock },
                { provide: LoadingService, useClass: LoadingServiceMock },
                { provide: TranslateService, useClass: TranslateServiceMock },
                { provide: MeetingListProvider, useValue: meetingListProviderSpy },
                { provide: ServiceGroupsProvider, useClass: ServiceGroupsProviderMock }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(ListfullPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }));

    it('should create', fakeAsync(() => {

        expect(component).toBeTruthy();
    }));
});
