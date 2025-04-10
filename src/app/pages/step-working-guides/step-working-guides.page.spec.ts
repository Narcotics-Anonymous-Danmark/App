import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { StepWorkingGuidesPage } from './step-working-guides.page';

describe('StepWorkingGuidesPage', () => {
  let component: StepWorkingGuidesPage;
  let fixture: ComponentFixture<StepWorkingGuidesPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ StepWorkingGuidesPage ],
      imports: [IonicModule.forRoot(), TranslateModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(StepWorkingGuidesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
