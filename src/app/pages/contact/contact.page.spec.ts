import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { ContactPage } from './contact.page';
import { TranslateModule } from '@ngx-translate/core';

describe('ContactPage', () => {
    let iabSpy;
    let component: ContactPage;
    let fixture: ComponentFixture<ContactPage>;

    beforeEach(async(() => {
        iabSpy = jasmine.createSpyObj('InAppBrowser', ['create']);

        TestBed.configureTestingModule({
            declarations: [ContactPage],
            imports: [IonicModule.forRoot(), TranslateModule.forRoot()],
            providers: [
                { provide: InAppBrowser, useValue: iabSpy }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(ContactPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }));

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
