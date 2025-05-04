import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrosswordPuzzleComponent } from './crossword-puzzle.component';

describe('CrosswordPuzzleComponent', () => {
  let component: CrosswordPuzzleComponent;
  let fixture: ComponentFixture<CrosswordPuzzleComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CrosswordPuzzleComponent]
    });
    fixture = TestBed.createComponent(CrosswordPuzzleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
