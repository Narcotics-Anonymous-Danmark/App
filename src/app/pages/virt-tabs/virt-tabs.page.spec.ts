import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
//import { InAppBrowserMock } from '@ionic-native-mocks/in-app-browser';
import { VirtTabsPage } from './virt-tabs.page';
import { TranslateService } from '@ngx-translate/core';

describe('VirtTabsPage', () => {
    let iabSpy;
    let component: VirtTabsPage;
    let fixture: ComponentFixture<VirtTabsPage>;
    let translateServiceSpy;

    beforeEach(async(() => {
        //iabSpy = jasmine.createSpyObj('InAppBrowser');

        TestBed.configureTestingModule({
            declarations: [VirtTabsPage],
            imports: [IonicModule.forRoot()],
            providers: [
                { provide: InAppBrowser, useValue: iabSpy },
                { provide: TranslateService, useValue: translateServiceSpy },
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(VirtTabsPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }));

    xit('should create (No provider for UrlSerializer!)', () => {
        ///TODO: No provider for UrlSerializer!
        expect(component).toBeTruthy();
    });
});
