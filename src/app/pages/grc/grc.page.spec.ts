import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { GrcPage } from './grc.page';

describe('GrcPage', () => {
  let component: GrcPage;
  let fixture: ComponentFixture<GrcPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ GrcPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(GrcPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
