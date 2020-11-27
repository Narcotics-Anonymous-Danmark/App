import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ComingSoonPage } from './coming-soon.page';

describe('ComingSoonPage', () => {
  let component: ComingSoonPage;
  let fixture: ComponentFixture<ComingSoonPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ComingSoonPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(ComingSoonPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
