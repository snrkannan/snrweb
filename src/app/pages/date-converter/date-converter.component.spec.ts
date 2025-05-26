import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DateConverterComponent } from './date-converter.component';

describe('DateConverterComponent', () => {
  let component: DateConverterComponent;
  let fixture: ComponentFixture<DateConverterComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DateConverterComponent]
    });
    fixture = TestBed.createComponent(DateConverterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
