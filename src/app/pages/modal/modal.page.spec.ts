import { HttpClient } from '@angular/common/http';
import { async, ComponentFixture, fakeAsync, TestBed } from '@angular/core/testing';
import { HTTP } from '@ionic-native/http/ngx';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { IonicModule, ModalController, NavParams } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { Storage } from '@ionic/storage';

import { ModalPage } from './modal.page';
import { TomatoFormatsService } from '../../providers/tomato-formats.service';
import { StorageMock } from '../../../testing/storage.mock';
import { NavParamsMock } from '../../../testing/navparams.mock';
import { TomatoFormatsServiceMock } from '../../../testing/tomato-formats.service.mock';

describe('ModalPage', () => {
    let component: ModalPage;
    let fixture: ComponentFixture<ModalPage>;
    let navParamsSpy;
    navParamsSpy = jasmine.createSpyObj('NavParam', ['data']);
    let iabSpy;
    let httpClientSpy, httpSpy;
    let storageSpy: { get: jasmine.Spy };
    let tomatoFormatsServiceSpy, modalControllerSpy;

    beforeEach(async(() => {
        storageSpy = jasmine.createSpyObj('Storage', ['get']);

        const data = twoMeetings;
        const navParams = new NavParams(data);
        //NavParamsMock.setParams(ownParams);
        //{ provide: NavParams, useValue: NavParamsMock },

        TestBed.configureTestingModule({
            declarations: [ModalPage],
            imports: [IonicModule.forRoot(), TranslateModule.forRoot()],
            providers: [

                { provide: NavParams, useValue: navParams },
                { provide: InAppBrowser, useValue: iabSpy },
                { provide: HttpClient, useValue: httpClientSpy },
                { provide: HTTP, useValue: httpSpy },
                { provide: Storage, useClass: StorageMock },
                { provide: TomatoFormatsService, useClass: TomatoFormatsServiceMock },
                { provide: ModalController, useValue: modalControllerSpy },
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(ModalPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }));

    it('should create', fakeAsync(() => {

        const expectedLanguage = 'en';
        storageSpy.get.and.callFake(
            () => {
                return new Promise(function (resolve: Function): void {
                    resolve(expectedLanguage);
                });
            }
        );

        expect(component).toBeTruthy();
    }));


    let twoMeetings = {
        data: [{
            "id_bigint": "2154",
            "worldid_mixed": "",
            "service_body_bigint": "9",
            "weekday_tinyint": "1",
            "start_time": "01:00:00",
            "duration_time": "02:00:00",
            "time_zone": "America/Sao_Paulo",
            "formats": "C,D,VM,PT,OT",
            "longitude": "-95.62532",
            "latitude": "36.3003274",
            "meeting_name": "Grupo Sistema RAD - temp",
            "location_text": "Clicar no link  para aceder. Na app digitar o ID da sala: 9998886262",
            "location_info": "Senha: 2014",
            "location_street": "",
            "location_neighborhood": "",
            "location_municipality": "",
            "location_sub_province": "",
            "location_province": "",
            "location_postal_code_1": "",
            "comments": "https://us04web.zoom.us/j/9998886262",
            "contact_phone_2": "",
            "contact_email_2": "",
            "contact_name_2": "",
            "contact_phone_1": "",
            "contact_email_1": "",
            "contact_name_1": "",
            "root_server_uri": "https://bmlt.virtual-na.org/main_server",
            "format_shared_id_list": "4,8,50,55,59"
        },
        {
            "id_bigint": "2170",
            "worldid_mixed": "",
            "service_body_bigint": "8",
            "weekday_tinyint": "1",
            "start_time": "05:00:00",
            "duration_time": "01:30:00",
            "time_zone": "Europe/Moscow",
            "formats": "C,D,RU,VM",
            "longitude": "-89.089343",
            "latitude": "42.268321",
            "meeting_name": "\u041d\u043e\u0432\u044b\u0439 \u0441\u0432\u0435\u0442",
            "location_text": "\u0429\u0435\u043b\u043a\u043d\u0438\u0442\u0435 \u0441\u0441\u044b\u043b\u043a\u0443 \u043d\u0438\u0436\u0435 \u0438 \u0441\u043b\u0435\u0434\u0443\u0439\u0442\u0435 \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0446\u0438\u044f\u043c",
            "location_info": "http://na-tranzit.org/raznoe/preambula-gr-novyj-svet",
            "location_street": "",
            "location_neighborhood": "",
            "location_municipality": "",
            "location_sub_province": "",
            "location_province": "",
            "location_postal_code_1": "",
            "comments": "https://zoom.us/j/9119111212",
            "contact_phone_2": "",
            "contact_email_2": "",
            "contact_name_2": "",
            "contact_phone_1": "",
            "contact_email_1": "",
            "contact_name_1": "",
            "root_server_uri": "https://bmlt.virtual-na.org/main_server",
            "format_shared_id_list": "4,8,49,50"
        }]
    };
});

