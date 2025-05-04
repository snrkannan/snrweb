import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PdfSplitterComponent } from './pdf-splitter.component';

describe('PdfSplitterComponent', () => {
  let component: PdfSplitterComponent;
  let fixture: ComponentFixture<PdfSplitterComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PdfSplitterComponent]
    });
    fixture = TestBed.createComponent(PdfSplitterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
