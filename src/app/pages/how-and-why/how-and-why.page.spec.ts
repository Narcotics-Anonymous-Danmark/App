import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { HowAndWhyPage } from './how-and-why.page';

describe('HowAndWhyPage', () => {
  let component: HowAndWhyPage;
  let fixture: ComponentFixture<HowAndWhyPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ HowAndWhyPage ],
      imports: [IonicModule.forRoot(), TranslateModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(HowAndWhyPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
