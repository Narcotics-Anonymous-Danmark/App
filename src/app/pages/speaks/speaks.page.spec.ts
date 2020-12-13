import { async, ComponentFixture, fakeAsync, TestBed } from '@angular/core/testing';
import { Insomnia } from '@ionic-native/insomnia/ngx';
import { IonicModule, LoadingController } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';

import { SpeaksPage } from './speaks.page';
import { HttpClient } from '@angular/common/http';
import { toArray } from 'rxjs/operators';
import { of } from 'rxjs';
import { AudioServiceStub } from '../../../testing/audio.service.mock';
import { AudioService } from '../../providers/audio.service';
import { LoadingService } from '../../providers/loading.service';

describe('SpeaksPage', () => {
    let component: SpeaksPage;
    let fixture: ComponentFixture<SpeaksPage>;
    let insomniaSpy;
    let inAppBrowserSpy;
    //let audioServiceSpy : { load: jasmine.Spy };
    //audioServiceSpy = jasmine.createSpyObj('AudioService', ['load']);
    let httpClientSpy;
    let loadingServiceSpy = jasmine.createSpyObj('LoadingService', ['present','dismiss']);

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [SpeaksPage],
            imports: [IonicModule.forRoot(), TranslateModule.forRoot()],
            providers: [
                { provide: LoadingService, useValue: loadingServiceSpy },
                { provide: Insomnia, useValue: insomniaSpy },
                { provide: AudioService, useClass: AudioServiceStub },
                { provide: HttpClient, useValue: httpClientSpy },
                { provide: InAppBrowser, useValue: inAppBrowserSpy }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(SpeaksPage);
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
