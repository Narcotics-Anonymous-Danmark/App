import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
//import { InAppBrowserMock } from '@ionic-native-mocks/in-app-browser';

import { GrcPage } from './grc.page';
import { TranslateModule } from '@ngx-translate/core';

describe('GrcPage', () => {
  let iabSpy;
  let component: GrcPage;
  let fixture: ComponentFixture<GrcPage>;

  beforeEach(async(() => {
      iabSpy = jasmine.createSpyObj('InAppBrowser', ['create']);


      TestBed.configureTestingModule({
      declarations: [ GrcPage ],
        imports: [IonicModule.forRoot(), TranslateModule.forRoot()],
        //,
        //providers: [{ provide: InAppBrowser, useClass: InAppBrowserMock }]
    }).compileComponents();

    fixture = TestBed.createComponent(GrcPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
