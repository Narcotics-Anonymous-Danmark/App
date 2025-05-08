import { async, ComponentFixture, fakeAsync, TestBed } from '@angular/core/testing';
import { Insomnia } from '@ionic-native/insomnia/ngx';
import { IonicModule, LoadingController } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';

import { AudioBooksPage } from './audiobooks.page';
import { HttpClient } from '@angular/common/http';
import { LoadingService } from '../../providers/loading.service';

describe('AudioBooksPage', () => {
    let component: AudioBooksPage;
    let fixture: ComponentFixture<AudioBooksPage>;
    let insomniaSpy;
    let inAppBrowserSpy;
    let httpClientSpy;
    let loadingServiceSpy = jasmine.createSpyObj('LoadingService', ['present','dismiss']);

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [AudioBooksPage],
            imports: [IonicModule.forRoot(), TranslateModule.forRoot()],
            providers: [
                { provide: LoadingService, useValue: loadingServiceSpy },
                { provide: Insomnia, useValue: insomniaSpy },
                { provide: HttpClient, useValue: httpClientSpy },
                { provide: InAppBrowser, useValue: inAppBrowserSpy }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(AudioBooksPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }));

});
