import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { IonicStorageModule } from '@ionic/storage';
import { TranslateService } from '@ngx-translate/core';
import { LoadingServiceMock } from '../../../testing/loading.service.mock';
import { TranslatePipeMock } from '../../../testing/translate.pipe.mock';
import { TranslateServiceMock } from '../../../testing/translate.service.mock';
import { LoadingService } from '../../providers/loading.service';

import { MeetingListProvider } from '../../providers/meeting-list.service';
import { LocationSearchPage } from './location-search.page';

describe('LocationSearchPage', () => {
    let component: LocationSearchPage;
    let fixture: ComponentFixture<LocationSearchPage>;

    let meetingListProviderSpy;
    //let storageSpy;

    beforeEach(async(() => {
        //storageSpy = jasmine.createSpyObj('Storage', ['get', 'set', 'clear', 'remove', 'ready']);
        //storageSpy = jasmine.createSpyObj('Storage',['set']);

        //{ provide: Storage, useValue: storageSpy },


        TestBed.configureTestingModule({
            declarations: [LocationSearchPage, TranslatePipeMock],
            imports: [IonicModule.forRoot(), IonicStorageModule.forRoot()],
            providers: [
                { provide: MeetingListProvider, useValue: meetingListProviderSpy },
                { provide: TranslateService, useClass: TranslateServiceMock },
                { provide: LoadingService, useClass: LoadingServiceMock },
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(LocationSearchPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }));

    it('should create', () => {

        //const expectedLanguage = 'en';
        //const otherValue = 25;

        //let store = {};
        //const mockLocalStorage = {
        //    getItem: (key: string): Promise<string> => {
        //        return new Promise(function (resolve: Function): void {
        //            resolve(
        //                key in store ? store[key] : null
        //            );
        //            //return key in store ? store[key] : null;
        //        })
        //    },
        //    setItem: (key: string, value: string) => {
        //        store[key] = `${value}`;
        //    },
        //    removeItem: (key: string) => {
        //        delete store[key];
        //    },
        //    clear: () => {
        //        store = {};
        //    },
        //    ready: (): Promise<LocalForage> => {
        //        return new Promise(function (resolve: Function): void {
        //            resolve(storageSpy);
        //        })
        //    }
            //ready: (): Promise<typeof storageSpy> => {
            //    return new Promise(function (resolve: Function): void {
            //        resolve(storageSpy);
            //    })
            //}
        //}

        //spyOn(storageSpy, 'get').and.callFake(mockLocalStorage.getItem);
        //spyOn(storageSpy, 'ready').and.callFake(mockLocalStorage.ready);


        //storageSpy.ready.and.callFake(mockLocalStorage.ready);
        //storageSpy.get.and.callFake(mockLocalStorage.getItem);

        //spyOn(storageSpy, 'get').and.callFake(mockLocalStorage.getItem);
        //spyOn(storageSpy, 'ready').and.callFake(mockLocalStorage.ready);

        //storageSpy.ready.and.callFake(
        //    () => {
        //        return new Promise(function (resolve: Function): void {
        //            resolve(true);
        //        });
        //    }
        //);
        //storageSpy.get.and.callFake(
        //    () => {
        //        return new Promise(function (resolve: Function): void {
        //            resolve(otherValue);
        //        });
        //    }
        //);

        expect(component).toBeTruthy();
    });
});
