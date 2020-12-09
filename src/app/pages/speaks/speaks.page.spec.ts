import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { SpeaksPage } from './speaks.page';

describe('SpeaksPage', () => {
  let component: SpeaksPage;
  let fixture: ComponentFixture<SpeaksPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SpeaksPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(SpeaksPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
