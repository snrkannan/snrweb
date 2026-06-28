import { Component, OnInit } from '@angular/core';
import jsPDF from 'jspdf';

interface SudokuCell {
  value: number | null;
  solution: number;
  isGiven: boolean;
  isRevealed: boolean;
  isWrong: boolean;
  isCorrect: boolean;
}

@Component({
  selector: 'app-sudoku',
  templateUrl: './sudoku.component.html',
  styleUrls: ['./sudoku.component.scss']
})
export class SudokuComponent implements OnInit {

  grid: SudokuCell[][] = [];
  difficulty: 'easy' | 'medium' | 'hard' = 'medium';
  isChecked = false;
  selectedCell: [number, number] | null = null;

  private cluesMap = { easy: 46, medium: 32, hard: 24 };

  ngOnInit() { this.newPuzzle(); }

  // ── Generation ─────────────────────────────────────────────────────────────

  newPuzzle() {
    this.isChecked = false;
    this.selectedCell = null;
    const solution = this.generateSolution();
    this.grid = this.buildGrid(solution);
  }

  private generateSolution(): number[][] {
    const g: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));
    this.fillGrid(g);
    return g;
  }

  private fillGrid(g: number[][]): boolean {
    const empty = this.findEmpty(g);
    if (!empty) return true;
    const [r, c] = empty;
    const nums = this.shuffle([1,2,3,4,5,6,7,8,9]);
    for (const n of nums) {
      if (this.isSafe(g, r, c, n)) {
        g[r][c] = n;
        if (this.fillGrid(g)) return true;
        g[r][c] = 0;
      }
    }
    return false;
  }

  private findEmpty(g: number[][]): [number, number] | null {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (g[r][c] === 0) return [r, c];
    return null;
  }

  private isSafe(g: number[][], r: number, c: number, n: number): boolean {
    for (let i = 0; i < 9; i++)
      if (g[r][i] === n || g[i][c] === n) return false;
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++)
      for (let dc = 0; dc < 3; dc++)
        if (g[br + dr][bc + dc] === n) return false;
    return true;
  }

  private buildGrid(solution: number[][]): SudokuCell[][] {
    const clues = this.cluesMap[this.difficulty];
    const positions = this.shuffle(Array.from({ length: 81 }, (_, i) => i));
    const givenSet = new Set(positions.slice(0, clues));

    return Array.from({ length: 9 }, (_, r) =>
      Array.from({ length: 9 }, (_, c) => {
        const isGiven = givenSet.has(r * 9 + c);
        return {
          value: isGiven ? solution[r][c] : null,
          solution: solution[r][c],
          isGiven,
          isRevealed: false,
          isWrong: false,
          isCorrect: false
        };
      })
    );
  }

  private shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ── Cell interaction ───────────────────────────────────────────────────────

  selectCell(r: number, c: number) {
    if (this.grid[r][c].isGiven) return;
    this.selectedCell = [r, c];
  }

  onKeyDown(event: KeyboardEvent, r: number, c: number) {
    if (this.grid[r][c].isGiven) return;
    const cell = this.grid[r][c];
    if (event.key >= '1' && event.key <= '9') {
      cell.value = +event.key;
      cell.isWrong = false;
      cell.isCorrect = false;
      if (this.isChecked) this.markCell(r, c);
    } else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
      cell.value = null;
      cell.isWrong = false;
      cell.isCorrect = false;
    } else if (event.key === 'ArrowRight') this.moveFocus(r, c, 0, 1);
    else if (event.key === 'ArrowLeft')  this.moveFocus(r, c, 0, -1);
    else if (event.key === 'ArrowDown')  this.moveFocus(r, c, 1, 0);
    else if (event.key === 'ArrowUp')    this.moveFocus(r, c, -1, 0);
    event.preventDefault();
  }

  onInput(r: number, c: number, event: Event) {
    const cell = this.grid[r][c];
    if (cell.isGiven) return;
    const val = (event.target as HTMLInputElement).value;
    const num = parseInt(val.slice(-1), 10);
    cell.value = (num >= 1 && num <= 9) ? num : null;
    (event.target as HTMLInputElement).value = cell.value ? String(cell.value) : '';
    cell.isWrong = false;
    cell.isCorrect = false;
    if (this.isChecked) this.markCell(r, c);
  }

  private moveFocus(r: number, c: number, dr: number, dc: number) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
      this.selectedCell = [nr, nc];
      const el = document.querySelector(`[data-cell="${nr}-${nc}"]`) as HTMLElement;
      el?.focus();
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  checkAnswers() {
    this.isChecked = true;
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        this.markCell(r, c);
  }

  private markCell(r: number, c: number) {
    const cell = this.grid[r][c];
    if (cell.isGiven || cell.isRevealed) return;
    if (cell.value === null) { cell.isWrong = false; cell.isCorrect = false; return; }
    cell.isCorrect = cell.value === cell.solution;
    cell.isWrong   = !cell.isCorrect;
  }

  revealAnswers() {
    this.isChecked = false;
    for (const row of this.grid)
      for (const cell of row)
        if (!cell.isGiven && cell.value !== cell.solution) {
          cell.value = cell.solution;
          cell.isRevealed = true;
          cell.isWrong = false;
          cell.isCorrect = false;
        }
  }

  resetPuzzle() {
    this.isChecked = false;
    this.selectedCell = null;
    for (const row of this.grid)
      for (const cell of row)
        if (!cell.isGiven) {
          cell.value = null;
          cell.isRevealed = false;
          cell.isWrong = false;
          cell.isCorrect = false;
        }
  }

  isSelected(r: number, c: number): boolean {
    return !!this.selectedCell && this.selectedCell[0] === r && this.selectedCell[1] === c;
  }

  isSameNumber(r: number, c: number): boolean {
    if (!this.selectedCell) return false;
    const [sr, sc] = this.selectedCell;
    const selVal = this.grid[sr][sc].value;
    return !!selVal && this.grid[r][c].value === selVal && !(r === sr && c === sc);
  }

  isRelated(r: number, c: number): boolean {
    if (!this.selectedCell) return false;
    const [sr, sc] = this.selectedCell;
    return r === sr || c === sc || (Math.floor(r/3) === Math.floor(sr/3) && Math.floor(c/3) === Math.floor(sc/3));
  }

  // ── PDF ────────────────────────────────────────────────────────────────────

  downloadPDF() {
    const doc = new jsPDF('portrait', 'mm', 'a4');
    const originX = 30, originY = 30, size = 150, cell = size / 9;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Sudoku — ${this.difficulty.charAt(0).toUpperCase() + this.difficulty.slice(1)}`, 105, 18, { align: 'center' });

    // Draw grid
    for (let i = 0; i <= 9; i++) {
      const thick = i % 3 === 0;
      doc.setLineWidth(thick ? 0.8 : 0.2);
      doc.line(originX, originY + i * cell, originX + size, originY + i * cell);
      doc.line(originX + i * cell, originY, originX + i * cell, originY + size);
    }

    // Fill given numbers
    doc.setFontSize(14);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const sd = this.grid[r][c];
        if (!sd.isGiven) continue;
        doc.setFont('helvetica', 'bold');
        doc.text(String(sd.solution), originX + c * cell + cell * 0.35, originY + r * cell + cell * 0.68);
      }
    }

    // Solution page
    doc.addPage();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Solution', 105, 18, { align: 'center' });

    for (let i = 0; i <= 9; i++) {
      const thick = i % 3 === 0;
      doc.setLineWidth(thick ? 0.8 : 0.2);
      doc.line(originX, originY + i * cell, originX + size, originY + i * cell);
      doc.line(originX + i * cell, originY, originX + i * cell, originY + size);
    }

    doc.setFontSize(14);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const sd = this.grid[r][c];
        doc.setFont('helvetica', sd.isGiven ? 'bold' : 'normal');
        doc.text(String(sd.solution), originX + c * cell + cell * 0.35, originY + r * cell + cell * 0.68);
      }
    }

    doc.save(`sudoku-${this.difficulty}-${Date.now()}.pdf`);
  }
}
