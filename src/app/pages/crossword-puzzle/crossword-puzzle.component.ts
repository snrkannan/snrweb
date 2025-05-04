// crossword-puzzle.component.ts
import { Component, ViewChild, ElementRef } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver'; // Import FileSaver

interface Clue {
  number: number;
  clue: string;
  answer: string;
}

interface CrosswordData {
  grid: string[][];
  across: { number: number; clue: string; start: { row: number; col: number } }[];
  down: { number: number; clue: string; start: { row: number; col: number } }[];
}

@Component({
  selector: 'app-crossword-puzzle',
  templateUrl: './crossword-puzzle.component.html',
  styleUrls: ['./crossword-puzzle.component.css']
})
export class CrosswordPuzzleComponent {
  acrossClues: Clue[] = [{ number: 1, clue: '', answer: '' }];
  downClues: Clue[] = [{ number: 1, clue: '', answer: '' }];
  crossword: CrosswordData | null = null;
  excelInput = false;

  @ViewChild('crosswordContainer', { static: false }) crosswordContainer!: ElementRef;

  addAcrossClue() {
    this.acrossClues.push({ number: this.acrossClues.length + 1, clue: '', answer: '' });
  }

  addDownClue() {
    this.downClues.push({ number: this.downClues.length + 1, clue: '', answer: '' });
  }

  generateCrossword() {
    const { grid, across, down } = this.buildCrossword();
    this.crossword = { grid, across, down };
  }

  buildCrossword(): { grid: string[][]; across: { number: number; clue: string; start: { row: number; col: number } }[]; down: { number: number; clue: string; start: { row: number; col: number } }[] } {
    const gridSize = 15;
    const grid: string[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill('#'));
    const across: { number: number; clue: string; start: { row: number; col: number } }[] = [];
    const down: { number: number; clue: string; start: { row: number; col: number } }[] = [];

    this.acrossClues.forEach((clue) => {
      if (clue.answer) {
        const placement = this.findPlacement(grid, clue.answer, 'across');
        if (placement) {
          this.placeWord(grid, clue.answer, placement.row, placement.col, 'across');
          across.push({ number: clue.number, clue: clue.clue, start: { row: placement.row, col: placement.col } });
        }
      }
    });

    this.downClues.forEach((clue) => {
      if (clue.answer) {
        const placement = this.findPlacement(grid, clue.answer, 'down');
        if (placement) {
          this.placeWord(grid, clue.answer, placement.row, placement.col, 'down');
          down.push({ number: clue.number, clue: clue.clue, start: { row: placement.row, col: placement.col } });
        }
      }
    });

    return { grid, across, down };
  }

  findPlacement(grid: string[][], word: string, direction: 'across' | 'down'): { row: number; col: number } | null {
    const gridSize = grid.length;
    let attempts = 0;
    const maxAttempts = 1000;

    while (attempts < maxAttempts) {
      const row = Math.floor(Math.random() * gridSize);
      const col = Math.floor(Math.random() * gridSize);

      if (this.canPlaceWord(grid, word, row, col, direction)) {
        return { row, col };
      }
      attempts++;
    }
    return null;
  }

  canPlaceWord(grid: string[][], word: string, row: number, col: number, direction: 'across' | 'down'): boolean {
    const gridSize = grid.length;
    if (direction === 'across') {
      if (col + word.length > gridSize) return false;
      for (let i = 0; i < word.length; i++) {
        if (grid[row][col + i] !== '#' && grid[row][col + i] !== word[i].toUpperCase()) return false;
      }
    } else {
      if (row + word.length > gridSize) return false;
      for (let i = 0; i < word.length; i++) {
        if (grid[row + i][col] !== '#' && grid[row + i][col] !== word[i].toUpperCase()) return false;
      }
    }
    return true;
  }

  placeWord(grid: string[][], word: string, row: number, col: number, direction: 'across' | 'down'): void {
    if (direction === 'across') {
      for (let i = 0; i < word.length; i++) {
        grid[row][col + i] = word[i].toUpperCase();
      }
    } else {
      for (let i = 0; i < word.length; i++) {
        grid[row + i][col] = word[i].toUpperCase();
      }
    }
  }

  getNumber(row: number, col: number): number {
    if (!this.crossword) return 0;
    for (const clue of this.crossword.across) {
      if (clue.start.row === row && clue.start.col === col) {
        return clue.number;
      }
    }
    for (const clue of this.crossword.down) {
      if (clue.start.row === row && clue.start.col === col) {
        return clue.number;
      }
    }
    return 0;
  }

  generatePDF() {
    if (!this.crosswordContainer) return;
    const doc = new jsPDF();
    const content = this.crosswordContainer.nativeElement;

    html2canvas(content).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = doc.internal.pageSize.getWidth() - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      doc.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);

      // Add answers upside down at the bottom of the page
      const pageHeight = doc.internal.pageSize.getHeight();
      let y = pageHeight - 20; // Start near the bottom

      const answers = [...this.acrossClues, ...this.downClues].sort((a, b) => b.number - a.number); // Sort by number descending

      answers.forEach(clue => {
        doc.text(`${clue.number} ${this.acrossClues.includes(clue) ? 'Across' : 'Down'}: ${clue.answer.split('').reverse().join('')}`, 10, y, { angle: 180 });
        y -= 10;
      });

      doc.save('crossword.pdf');
    });
  }

  onFileChange(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader: FileReader = new FileReader();
      reader.onload = (e: any) => {
        const bstr: string = e.target.result;
        const wb: XLSX.WorkBook = XLSX.read(bstr, { type: 'binary' });
        const wsname: string = wb.SheetNames[0];
        const ws: XLSX.WorkSheet = wb.Sheets[wsname];
        const data: any = XLSX.utils.sheet_to_json(ws, { header: 1 });
        this.processExcelData(data);
      };
      reader.readAsBinaryString(file);
    }
  }

  processExcelData(data: any[]) {
    this.acrossClues = [];
    this.downClues = [];

    for (const row of data) {
      if (row[0] === 'across') {
        this.acrossClues.push({
          number: row[1],
          clue: row[2],
          answer: row[3]
        });
      } else if (row[0] === 'down') {
        this.downClues.push({
          number: row[1],
          clue: row[2],
          answer: row[3]
        });
      }
    }
  }

  toggleInputMode() {
    this.excelInput = !this.excelInput;
  }

  exportToExcel(): void {
    const worksheetName = 'Crossword Data';
    const workbook: XLSX.WorkBook = {
      SheetNames: [worksheetName],
      Sheets: {}
    };
    const data = [
      ['Direction', 'Number', 'Clue', 'Answer'], // Header row
      ...this.acrossClues.map(clue => ['across', clue.number, clue.clue, clue.answer]),
      ...this.downClues.map(clue => ['down', clue.number, clue.clue, clue.answer])
    ];

    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(data);
    workbook.Sheets[worksheetName] = worksheet;
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.saveAsExcel(excelBuffer, 'crossword_data.xlsx');
  }

  private saveAsExcel(buffer: any, filename: string): void {
    const data: Blob = new Blob([buffer], { type: 'application/octet-stream' });
    FileSaver.saveAs(data, filename);
  }
}