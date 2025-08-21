import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed, async, fakeAsync } from '@angular/core/testing';

import { Platform } from '@ionic/angular';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { RouterTestingModule } from '@angular/router/testing';

import { AppComponent } from './app.component';
import { TranslateModule } from '@ngx-translate/core';
import { Storage } from '@ionic/storage';
import { asyncData } from '../testing/async-observable-helpers';

describe('AppComponent', () => {

    let statusBarSpy, platformReadySpy, platformSpy;
    let storageSpy: { get: jasmine.Spy };
    //let storageSpy: { get: jasmine.Spy, then: jasmine.Spy };

    beforeEach(async(() => {
        statusBarSpy = jasmine.createSpyObj('StatusBar', ['styleDefault']);
        platformReadySpy = Promise.resolve();
        platformSpy = jasmine.createSpyObj('Platform', { ready: platformReadySpy });
        storageSpy = jasmine.createSpyObj('Storage', ['get']);
        //storageSpy = jasmine.createSpyObj('Storage', ['get', 'set', 'then']);

        TestBed.configureTestingModule({
            declarations: [AppComponent],
            schemas: [CUSTOM_ELEMENTS_SCHEMA],
            providers: [
                { provide: StatusBar, useValue: statusBarSpy },
                { provide: Platform, useValue: platformSpy },
                { provide: Storage, useValue: storageSpy },
            ],
            imports: [RouterTestingModule.withRoutes([]), TranslateModule.forRoot()],
        }).compileComponents();
    }));

    it('should create the app', fakeAsync(() => {
        const expectedLanguage = 'en';
        storageSpy.get.and.callFake(
            () => {
                return new Promise(function (resolve: Function): void {
                    resolve(expectedLanguage);
                });
            }
        );


        //spyOn(storageSpy, 'get').and.callFake(
        //    () => {

        //        return new Promise(function (resolve: Function): void {
        //            resolve('en');
        //        });

        //    }
        //);

        const fixture = TestBed.createComponent(AppComponent);
        const app = fixture.debugElement.componentInstance;
        expect(app).toBeTruthy();
    }));

    it('should initialize the app', async () => {
        const expectedLanguage = 'en';
        storageSpy.get.and.callFake(
            () => {
                return new Promise(function (resolve: Function): void {
                    resolve(expectedLanguage);
                });
            }
        );

        TestBed.createComponent(AppComponent);
        expect(platformSpy.ready).toHaveBeenCalled();
        await platformReadySpy;
        expect(statusBarSpy.styleDefault).toHaveBeenCalled();
    });

    it('should have menu labels', async () => {
        const expectedLanguage = 'en';
        storageSpy.get.and.callFake(
            () => {
                return new Promise(function (resolve: Function): void {
                    resolve(expectedLanguage);
                });
            }
        );

        const fixture = await TestBed.createComponent(AppComponent);
        await fixture.detectChanges();
        const app = fixture.nativeElement;
        const menuItems = app.querySelectorAll('ion-label');
        expect(menuItems.length).toEqual(11);
        expect(menuItems[0].textContent).toContain('HOME');
        expect(menuItems[1].textContent).toContain('JFT');
    });

    it('should have urls', async () => {
        const expectedLanguage = 'en';
        storageSpy.get.and.callFake(
            () => {
                return new Promise(function (resolve: Function): void {
                    resolve(expectedLanguage);
                });
            }
        );

        const fixture = await TestBed.createComponent(AppComponent);
        await fixture.detectChanges();
        const app = fixture.nativeElement;
        const menuItems = app.querySelectorAll('ion-item');
        expect(menuItems.length).toEqual(12);
        expect(menuItems[0].getAttribute('ng-reflect-router-link')).toEqual('home');
        expect(menuItems[1].getAttribute('ng-reflect-router-link')).toEqual('jft');
    });

});
