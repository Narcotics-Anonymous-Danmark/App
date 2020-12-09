import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { CleantimeCounterPage } from './cleantime-counter.page';

describe('CleantimeCounterPage', () => {
  let component: CleantimeCounterPage;
  let fixture: ComponentFixture<CleantimeCounterPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CleantimeCounterPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(CleantimeCounterPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
