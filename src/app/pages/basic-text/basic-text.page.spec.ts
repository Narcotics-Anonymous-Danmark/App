import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { BasicTextPage } from './basic-text.page';

describe('BasicTextPage', () => {
  let component: BasicTextPage;
  let fixture: ComponentFixture<BasicTextPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ BasicTextPage ],
      imports: [IonicModule.forRoot(), TranslateModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(BasicTextPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
