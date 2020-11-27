import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { JftPage } from './jft.page';

describe('JftPage', () => {
  let component: JftPage;
  let fixture: ComponentFixture<JftPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ JftPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(JftPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
