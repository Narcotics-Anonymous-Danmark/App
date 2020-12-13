import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
//import { InAppBrowserMock } from '@ionic-native-mocks/in-app-browser';
import { MeetingCardComponent } from './meeting-card.component';
import { TranslateService } from '@ngx-translate/core';
import { TranslatePipeMock } from '../../../testing/translate.pipe.mock';

describe('MeetingCardComponent', () => {
    let iabSpy;
    let component: MeetingCardComponent;
    let fixture: ComponentFixture<MeetingCardComponent>;
    let translateServiceSpy;

    //providers: [{ provide: InAppBrowser, useClass: iabSpy }]

    beforeEach(async(() => {
        iabSpy = jasmine.createSpyObj('InAppBrowser', ['create']);

        TestBed.configureTestingModule({
            declarations: [MeetingCardComponent, TranslatePipeMock],
            imports: [IonicModule.forRoot()],
            providers: [
                { provide: InAppBrowser, useValue: iabSpy },
                { provide: TranslateService, useValue: translateServiceSpy },
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(MeetingCardComponent);
        component = fixture.componentInstance;
        component.data = singleMeeting;
        fixture.detectChanges();
    }));

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    let singleMeeting = {
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
    }
});
