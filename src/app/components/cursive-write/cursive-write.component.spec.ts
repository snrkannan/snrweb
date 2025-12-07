import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CursiveWriteComponent } from './cursive-write.component';

describe('CursiveWriteComponent', () => {
  let component: CursiveWriteComponent;
  let fixture: ComponentFixture<CursiveWriteComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CursiveWriteComponent]
    });
    fixture = TestBed.createComponent(CursiveWriteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
