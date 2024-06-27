import { async, ComponentFixture, fakeAsync, TestBed } from '@angular/core/testing';
import { Insomnia } from '@ionic-native/insomnia/ngx';
import { IonicModule, LoadingController } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';

import { EventsPage } from './events.page';
import { HttpClient } from '@angular/common/http';
import { toArray } from 'rxjs/operators';
import { of } from 'rxjs';
import { EventServiceStub } from '../../../testing/event.service.mock';
import { EventService } from '../../providers/event.service';
import { LoadingService } from '../../providers/loading.service';

describe('EventsPage', () => {
    let component: EventsPage;
    let fixture: ComponentFixture<EventsPage>;
    let insomniaSpy;
    let inAppBrowserSpy;
    //let eventServiceSpy : { load: jasmine.Spy };
    //eventServiceSpy = jasmine.createSpyObj('EventService', ['load']);
    let httpClientSpy;
    let loadingServiceSpy = jasmine.createSpyObj('LoadingService', ['present','dismiss']);

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [EventsPage],
            imports: [IonicModule.forRoot(), TranslateModule.forRoot()],
            providers: [
                { provide: LoadingService, useValue: loadingServiceSpy },
                { provide: Insomnia, useValue: insomniaSpy },
                { provide: EventService, useClass: EventServiceStub },
                { provide: HttpClient, useValue: httpClientSpy },
                { provide: InAppBrowser, useValue: inAppBrowserSpy }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(EventsPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }));

    //const subjectMock = new BehaviorSubject<any>(undefined);

    it('should create', fakeAsync(() => {
        loadingServiceSpy.present;
        loadingServiceSpy.dismiss;

        expect(component).toBeTruthy();
    }));

    it('should load recordings', fakeAsync(() => {
        loadingServiceSpy.present;
        loadingServiceSpy.dismiss;

        expect(component.events.length).toBeGreaterThan(0);
    }));

});
