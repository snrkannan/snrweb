import { Component, ViewChild, ElementRef } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';

interface Clue {
  number: number;
  clue: string;
  answer: string;
}

interface PlacedWord {
  word: string;
  clue: string;
  number: number;
  row: number;
  col: number;
  direction: 'across' | 'down';
}

interface Cell {
  letter: string;       // answer letter (empty string = black cell)
  userInput: string;    // what the user typed
  number: number | null;
  isBlack: boolean;
  acrossWord: number | null;
  downWord: number | null;
  highlighted: boolean;
  active: boolean;
}

@Component({
  selector: 'app-crossword-puzzle',
  templateUrl: './crossword-puzzle.component.html',
  styleUrls: ['./crossword-puzzle.component.scss']
})
export class CrosswordPuzzleComponent {

  // ── Input state ────────────────────────────────────────────────────────────
  excelInput = false;
  acrossClues: Clue[] = [
    { number: 1, clue: '', answer: '' }
  ];
  downClues: Clue[] = [
    { number: 1, clue: '', answer: '' }
  ];

  // ── Generated puzzle state ─────────────────────────────────────────────────
  grid: Cell[][] = [];
  placedWords: PlacedWord[] = [];
  acrossPlaced: PlacedWord[] = [];
  downPlaced: PlacedWord[] = [];
  gridSize = 0;
  generated = false;
  errorMessage = '';

  // ── Interaction state ──────────────────────────────────────────────────────
  selectedClue: PlacedWord | null = null;
  selectedDirection: 'across' | 'down' = 'across';
  isChecked = false;
  correctCells: boolean[][] = [];

  @ViewChild('crosswordContainer') crosswordContainer!: ElementRef;

  // ── Input management ───────────────────────────────────────────────────────
  toggleInputMode() { this.excelInput = !this.excelInput; }
  addAcrossClue() { this.acrossClues.push({ number: this.acrossClues.length + 1, clue: '', answer: '' }); }
  addDownClue()   { this.downClues.push({ number: this.downClues.length + 1, clue: '', answer: '' }); }
  removeAcrossClue(i: number) { this.acrossClues.splice(i, 1); }
  removeDownClue(i: number)   { this.downClues.splice(i, 1); }

  // ── Core generation ────────────────────────────────────────────────────────
  generateCrossword() {
    this.errorMessage = '';
    this.isChecked = false;
    this.selectedClue = null;

    const allClues: { clue: Clue; direction: 'across' | 'down' }[] = [
      ...this.acrossClues.filter(c => c.answer.trim()).map(c => ({ clue: c, direction: 'across' as const })),
      ...this.downClues.filter(c => c.answer.trim()).map(c => ({ clue: c, direction: 'down' as const }))
    ];

    if (allClues.length === 0) { this.errorMessage = 'Please enter at least one clue with an answer.'; return; }

    // Sort longest first for better placement
    allClues.sort((a, b) => b.clue.answer.length - a.clue.answer.length);

    const placed = this.buildLayout(allClues);
    if (placed.length === 0) { this.errorMessage = 'Could not place any words. Check your answers.'; return; }

    this.renderGrid(placed);
    this.generated = true;
  }

  private buildLayout(allClues: { clue: Clue; direction: 'across' | 'down' }[]): PlacedWord[] {
    const OFFSET = 50;
    const placed: PlacedWord[] = [];

    // Place first word at origin
    const first = allClues[0];
    placed.push({
      word: first.clue.answer.toUpperCase(),
      clue: first.clue.clue,
      number: first.clue.number,
      row: OFFSET,
      col: OFFSET,
      direction: first.direction
    });

    const unplaced: { clue: Clue; direction: 'across' | 'down' }[] = [];

    for (let i = 1; i < allClues.length; i++) {
      const { clue, direction } = allClues[i];
      const word = clue.answer.toUpperCase();
      const best = this.findBestPlacement(placed, word, direction);
      if (best) {
        placed.push({ word, clue: clue.clue, number: clue.number, row: best.row, col: best.col, direction });
      } else {
        unplaced.push({ clue, direction });
      }
    }

    // Second pass: retry unplaced words against the now-larger grid
    const stillUnplaced: { clue: Clue; direction: 'across' | 'down' }[] = [];
    for (const item of unplaced) {
      const word = item.clue.answer.toUpperCase();
      const best = this.findBestPlacement(placed, word, item.direction);
      if (best) {
        placed.push({ word, clue: item.clue.clue, number: item.clue.number, row: best.row, col: best.col, direction: item.direction });
      } else {
        stillUnplaced.push(item);
      }
    }

    // Force-place any remaining words that share no letters — stack them below/beside the grid
    if (stillUnplaced.length > 0) {
      // Find grid bounds after all successful placements
      let maxRow = -Infinity, maxCol = -Infinity, minCol = Infinity;
      for (const pw of placed) {
        const endRow = pw.direction === 'down'   ? pw.row + pw.word.length - 1 : pw.row;
        const endCol = pw.direction === 'across' ? pw.col + pw.word.length - 1 : pw.col;
        maxRow = Math.max(maxRow, endRow);
        maxCol = Math.max(maxCol, endCol);
        minCol = Math.min(minCol, pw.col);
      }

      // Place isolated words in a clean area below the main grid, 2 rows gap
      let acrossStackRow = maxRow + 2;
      let downStackRow   = maxRow + 2;
      let downStackCol   = minCol;
      const downColStep  = 8;

      for (const item of stillUnplaced) {
        const word = item.clue.answer.toUpperCase();
        // One final attempt at intersection now that grid is larger
        const best = this.findBestPlacement(placed, word, item.direction);
        if (best) {
          placed.push({ word, clue: item.clue.clue, number: item.clue.number, row: best.row, col: best.col, direction: item.direction });
        } else if (item.direction === 'across') {
          placed.push({ word, clue: item.clue.clue, number: item.clue.number, row: acrossStackRow, col: minCol, direction: 'across' });
          acrossStackRow += 2;
          // Keep down stack below across stack
          downStackRow = Math.max(downStackRow, acrossStackRow);
        } else {
          placed.push({ word, clue: item.clue.clue, number: item.clue.number, row: downStackRow, col: downStackCol, direction: 'down' });
          downStackCol += downColStep;
        }
      }
    }

    return placed;
  }

  private findBestPlacement(
    placed: PlacedWord[],
    word: string,
    direction: 'across' | 'down'
  ): { row: number; col: number } | null {

    const candidates: { row: number; col: number; score: number }[] = [];

    for (const pw of placed) {
      for (let wi = 0; wi < word.length; wi++) {
        for (let pi = 0; pi < pw.word.length; pi++) {
          if (word[wi] !== pw.word[pi]) continue;

          let row: number, col: number;
          if (direction === 'across') {
            row = pw.direction === 'across' ? pw.row       : pw.row + pi;
            col = pw.direction === 'across' ? pw.col + pi - wi : pw.col - wi;
          } else {
            row = pw.direction === 'across' ? pw.row - wi  : pw.row + pi - wi;
            col = pw.direction === 'across' ? pw.col + pi  : pw.col;
          }

          if (this.isValidPlacement(placed, word, row, col, direction)) {
            candidates.push({ row, col, score: this.scorePlacement(placed, word, row, col, direction) });
          }
        }
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  }

  private isValidPlacement(placed: PlacedWord[], word: string, row: number, col: number, direction: 'across' | 'down'): boolean {
    const cells = this.getOccupiedCells(placed);

    for (let i = 0; i < word.length; i++) {
      const r = direction === 'across' ? row : row + i;
      const c = direction === 'across' ? col + i : col;
      const key = `${r},${c}`;
      const existing = cells.get(key);

      if (existing) {
        // Letter must match
        if (existing.letter !== word[i]) return false;
        // Must be a true crossing — cell must not already have this direction
        if (existing.directions.has(direction)) return false;
        // Cell can only be a crossing point once (already has both directions)
        if (existing.directions.size >= 2) return false;
      } else {
        // Free cell — ensure no parallel neighbour from same direction
        if (direction === 'across') {
          const above = cells.get(`${r - 1},${c}`);
          const below = cells.get(`${r + 1},${c}`);
          if (above?.directions.has('across') || below?.directions.has('across')) return false;
        } else {
          const left  = cells.get(`${r},${c - 1}`);
          const right = cells.get(`${r},${c + 1}`);
          if (left?.directions.has('down') || right?.directions.has('down')) return false;
        }
      }
    }

    // Word must not butt directly against another word at its start or end
    if (direction === 'across') {
      if (cells.has(`${row},${col - 1}`) || cells.has(`${row},${col + word.length}`)) return false;
    } else {
      if (cells.has(`${row - 1},${col}`) || cells.has(`${row + word.length},${col}`)) return false;
    }

    return true;
  }

  private scorePlacement(placed: PlacedWord[], word: string, row: number, col: number, direction: 'across' | 'down'): number {
    const cells = this.getOccupiedCells(placed);
    let intersections = 0;
    for (let i = 0; i < word.length; i++) {
      const r = direction === 'across' ? row : row + i;
      const c = direction === 'across' ? col + i : col;
      if (cells.has(`${r},${c}`)) intersections++;
    }
    return intersections;
  }

  private getOccupiedCells(placed: PlacedWord[]): Map<string, { letter: string; directions: Set<'across' | 'down'> }> {
    const map = new Map<string, { letter: string; directions: Set<'across' | 'down'> }>();
    for (const pw of placed) {
      for (let i = 0; i < pw.word.length; i++) {
        const r = pw.direction === 'across' ? pw.row : pw.row + i;
        const c = pw.direction === 'across' ? pw.col + i : pw.col;
        const key = `${r},${c}`;
        const existing = map.get(key);
        if (existing) {
          existing.directions.add(pw.direction);
        } else {
          map.set(key, { letter: pw.word[i], directions: new Set([pw.direction]) });
        }
      }
    }
    return map;
  }

  // ── Grid rendering ─────────────────────────────────────────────────────────
  private renderGrid(placed: PlacedWord[]) {
    // Normalise coordinates to start at 0
    let minRow = Infinity, minCol = Infinity, maxRow = -Infinity, maxCol = -Infinity;
    for (const pw of placed) {
      minRow = Math.min(minRow, pw.row);
      minCol = Math.min(minCol, pw.col);
      const endRow = pw.direction === 'down'   ? pw.row + pw.word.length - 1 : pw.row;
      const endCol = pw.direction === 'across' ? pw.col + pw.word.length - 1 : pw.col;
      maxRow = Math.max(maxRow, endRow);
      maxCol = Math.max(maxCol, endCol);
    }

    const rows = maxRow - minRow + 1;
    const cols = maxCol - minCol + 1;
    this.gridSize = Math.max(rows, cols);

    // Normalise placed word positions
    const norm: PlacedWord[] = placed.map(pw => ({ ...pw, row: pw.row - minRow, col: pw.col - minCol }));

    // Build letter map
    const letterMap = new Map<string, string>();
    for (const pw of norm) {
      for (let i = 0; i < pw.word.length; i++) {
        const r = pw.direction === 'across' ? pw.row : pw.row + i;
        const c = pw.direction === 'across' ? pw.col + i : pw.col;
        letterMap.set(`${r},${c}`, pw.word[i]);
      }
    }

    // Re-number placed words sequentially by position (top-to-bottom, left-to-right)
    const sortedStarts = norm
      .map(pw => ({ row: pw.row, col: pw.col, key: `${pw.row},${pw.col}` }))
      .filter((v, i, a) => a.findIndex(x => x.key === v.key) === i)
      .sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);

    let cellNum = 1;
    const startNumberMap = new Map<string, number>();
    for (const s of sortedStarts) {
      startNumberMap.set(s.key, cellNum++);
    }

    // Update placed word numbers to match new sequential numbering
    for (const pw of norm) {
      const key = `${pw.row},${pw.col}`;
      pw.number = startNumberMap.get(key) ?? pw.number;
    }

    // Build grid
    this.grid = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => {
        const letter = letterMap.get(`${r},${c}`) ?? '';
        return {
          letter,
          userInput: '',
          number: startNumberMap.get(`${r},${c}`) ?? null,
          isBlack: letter === '',
          acrossWord: null,
          downWord: null,
          highlighted: false,
          active: false
        } as Cell;
      })
    );

    // Tag each white cell with which word number it belongs to
    for (const pw of norm) {
      for (let i = 0; i < pw.word.length; i++) {
        const r = pw.direction === 'across' ? pw.row : pw.row + i;
        const c = pw.direction === 'across' ? pw.col + i : pw.col;
        if (pw.direction === 'across') this.grid[r][c].acrossWord = pw.number;
        else                           this.grid[r][c].downWord   = pw.number;
      }
    }

    this.placedWords  = norm;
    this.acrossPlaced = norm.filter(p => p.direction === 'across').sort((a, b) => a.number - b.number);
    this.downPlaced   = norm.filter(p => p.direction === 'down').sort((a, b) => a.number - b.number);
    this.correctCells = Array.from({ length: rows }, () => Array(cols).fill(false));
  }

  // ── Interaction ────────────────────────────────────────────────────────────
  onCellClick(row: number, col: number) {
    const cell = this.grid[row][col];
    if (cell.isBlack) return;

    // Toggle direction if clicking the already-active cell
    if (this.selectedClue && this.grid[row][col].active) {
      this.selectedDirection = this.selectedDirection === 'across' ? 'down' : 'across';
    }

    // Prefer the current direction, fall back to the other
    let target: PlacedWord | null = null;
    if (this.selectedDirection === 'across' && cell.acrossWord !== null) {
      target = this.placedWords.find(p => p.number === cell.acrossWord && p.direction === 'across') ?? null;
    } else if (this.selectedDirection === 'down' && cell.downWord !== null) {
      target = this.placedWords.find(p => p.number === cell.downWord && p.direction === 'down') ?? null;
    }
    if (!target) {
      // Fall back to the other direction
      if (cell.acrossWord !== null) {
        target = this.placedWords.find(p => p.number === cell.acrossWord && p.direction === 'across') ?? null;
        this.selectedDirection = 'across';
      } else if (cell.downWord !== null) {
        target = this.placedWords.find(p => p.number === cell.downWord && p.direction === 'down') ?? null;
        this.selectedDirection = 'down';
      }
    }

    this.selectClue(target);
  }

  selectClue(pw: PlacedWord | null) {
    this.clearHighlights();
    this.selectedClue = pw;
    if (!pw) return;
    this.selectedDirection = pw.direction;

    for (let i = 0; i < pw.word.length; i++) {
      const r = pw.direction === 'across' ? pw.row : pw.row + i;
      const c = pw.direction === 'across' ? pw.col + i : pw.col;
      this.grid[r][c].highlighted = true;
    }
    // Mark start cell as active
    this.grid[pw.row][pw.col].active = true;
  }

  private clearHighlights() {
    for (const row of this.grid) for (const cell of row) { cell.highlighted = false; cell.active = false; }
  }

  onKeyInput(event: KeyboardEvent, row: number, col: number) {
    const cell = this.grid[row][col];
    if (cell.isBlack) return;

    if (event.key === 'Backspace') {
      event.preventDefault();
      cell.userInput = '';
      this.moveFocus(row, col, -1);
      return;
    }
    if (event.key.length === 1 && /[a-zA-Z]/.test(event.key)) {
      event.preventDefault();
      cell.userInput = event.key.toUpperCase();
      this.moveFocus(row, col, 1);
    }
  }

  private moveFocus(row: number, col: number, delta: number) {
    if (!this.selectedClue) return;
    const pw = this.selectedClue;
    const cells: [number, number][] = pw.word.split('').map((_, i) => [
      pw.direction === 'across' ? pw.row : pw.row + i,
      pw.direction === 'across' ? pw.col + i : pw.col
    ]);
    const idx = cells.findIndex(([r, c]) => r === row && c === col);
    const next = cells[idx + delta];
    if (next) {
      const el = document.querySelector(`[data-cell="${next[0]}-${next[1]}"]`) as HTMLElement;
      el?.focus();
    }
  }

  checkAnswers() {
    this.isChecked = true;
    for (let r = 0; r < this.grid.length; r++) {
      for (let c = 0; c < this.grid[r].length; c++) {
        const cell = this.grid[r][c];
        this.correctCells[r][c] = !cell.isBlack && cell.userInput === cell.letter;
      }
    }
  }

  revealAnswers() {
    for (const row of this.grid) for (const cell of row) { if (!cell.isBlack) cell.userInput = cell.letter; }
    this.isChecked = false;
  }

  resetPuzzle() {
    for (const row of this.grid) for (const cell of row) { cell.userInput = ''; }
    this.isChecked = false;
    this.clearHighlights();
    this.selectedClue = null;
  }

  isCellCorrect(r: number, c: number): boolean  { return this.isChecked && this.correctCells[r][c]; }
  isCellWrong(r: number, c: number): boolean     { return this.isChecked && !this.grid[r][c].isBlack && this.grid[r][c].userInput !== '' && !this.correctCells[r][c]; }

  // ── Excel import/export ────────────────────────────────────────────────────
  onFileChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const wb = XLSX.read(e.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      this.processExcelData(XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[]);
    };
    reader.readAsBinaryString(file);
  }

  processExcelData(data: any[]) {
    this.acrossClues = [];
    this.downClues   = [];
    for (const row of data) {
      if (row[0] === 'across') this.acrossClues.push({ number: row[1], clue: row[2], answer: row[3] });
      else if (row[0] === 'down') this.downClues.push({ number: row[1], clue: row[2], answer: row[3] });
    }
  }

  exportToExcel() {
    const data = [
      ['Direction', 'Number', 'Clue', 'Answer'],
      ...this.acrossClues.map(c => ['across', c.number, c.clue, c.answer]),
      ...this.downClues.map(c => ['down',   c.number, c.clue, c.answer])
    ];
    const wb: XLSX.WorkBook = { SheetNames: ['Crossword'], Sheets: { Crossword: XLSX.utils.aoa_to_sheet(data) } };
    FileSaver.saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' }), 'crossword.xlsx');
  }

  // ── PDF export ─────────────────────────────────────────────────────────────
  generatePDF() {
    if (!this.crosswordContainer) return;
    html2canvas(this.crosswordContainer.nativeElement).then(canvas => {
      const doc = new jsPDF();
      const w = doc.internal.pageSize.getWidth() - 20;
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, w, (canvas.height * w) / canvas.width);
      doc.save('crossword.pdf');
    });
  }
}
