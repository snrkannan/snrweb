import { Component, ElementRef, ViewChild, OnInit, HostListener } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { HttpClient } from '@angular/common/http';

interface FontOption {
  name: string;
  value: string;
}

@Component({
  selector: 'app-cursive-write',
  templateUrl: './cursive-write.component.html',
  styleUrls: ['./cursive-write.component.scss']
})
export class CursiveWriteComponent implements OnInit {
  // Core Data
  public userName: string = 'John Doe';
  public currentDay: string = '';
  public pdfText: string = 'The quick brown fox jumps over the lazy dog.';
  public pages: string[] = [];

  // Visibility Toggles
  public showHeader: boolean = true;
  public showFooter: boolean = true;
  public showLines: boolean = true;
  public showColumnLines: boolean = false;
  public isDropdownOpen: boolean = false;

 public fontOptions: FontOption[] = [
  // Asset-based fonts
  { name: 'School Cursive (Local)', value: "'SchoolCursive', cursive" },
  { name: 'Classic Hand (Local)', value: "'ClassicHandwriting', serif" },
  { name: 'Kids Tracing (Local)', value: "'KidsTracing', sans-serif" },
  
  // Web fonts
  { name: 'Great Vibes', value: "'Great Vibes', cursive" },
  { name: 'Dancing Script', value: "'Dancing Script', cursive" }
];
  public selectedFont: string = this.fontOptions[0].value;
  public fontSize: number = 24;
  public letterSpacing: number = 0;
  public fontColor: string = '#1a237e';
  public headerColor: string = '#334155';
  public hLineColor: string = '#cbd5e1';
  public vLineColor: string = '#e2e8f0';

  // Grid Dimensions
  public lineSpacing: number = 40;
  public columnWidth: number = 30;
  public horizontalRows: number[] = [];
  public verticalCols: number[] = [];

  @ViewChild('pdfContent', { static: false }) pdfContent!: ElementRef;

  // Close dropdown if clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown-container')) {
      this.isDropdownOpen = false;
    }
  }
constructor(private http: HttpClient) {}
  ngOnInit() {
    this.currentDay = new Date().toLocaleDateString('en-US');
    this.loadAssetFonts();
    this.loadSettings();
    this.updateGridHelpers();
  }

  /**
   * Reads the JSON manifest and pushes fonts into fontOptions
   */
  private loadAssetFonts(): void {
    this.http.get<any>('assets/fonts/font-manifest.json').subscribe({
      next: (data) => {
        const localFonts = data.assetFonts.map((f: any) => ({
          name: `${f.name} (Asset)`,
          value: `'${f.family}', cursive`
        }));
        
        // Merge asset fonts at the beginning of the list
        this.fontOptions = [...localFonts, ...this.fontOptions];
        
        // Ensure local storage settings still match a valid font
        this.loadSettings(); 
      },
      error: (err) => console.error('Could not load font manifest', err)
    });
  }

  public async loadSystemFonts(): Promise<void> {
    if ('queryLocalFonts' in window) {
      try {
        const availableFonts: any[] = await (window as any).queryLocalFonts();
        const systemFonts = availableFonts.map(f => ({
          name: f.fullName,
          value: `"${f.fullName}", sans-serif`
        }));
        const all = [...this.fontOptions, ...systemFonts];
        this.fontOptions = Array.from(new Map(all.map(item => [item.name, item])).values());
      } catch (err) {
        alert('Permission to access local fonts was denied.');
      }
    } else {
      alert('Local Font API is only supported in Chrome/Edge.');
    }
  }

  public selectFont(font: FontOption): void {
    this.selectedFont = font.value;
    this.isDropdownOpen = false;
    this.saveSettings();
  }

  public updateGridHelpers(): void {
    // Fill virtual arrays to generate physical div lines
    this.horizontalRows = Array(Math.ceil(1100 / this.lineSpacing)).fill(0);
    this.verticalCols = Array(Math.ceil(800 / this.columnWidth)).fill(0);
    this.saveSettings();
  }

  public saveSettings(): void {
    const settings = {
      userName: this.userName, showHeader: this.showHeader, showFooter: this.showFooter,
      showLines: this.showLines, showColumnLines: this.showColumnLines,
      selectedFont: this.selectedFont, fontSize: this.fontSize,
      letterSpacing: this.letterSpacing, fontColor: this.fontColor,
      headerColor: this.headerColor, hLineColor: this.hLineColor, 
      vLineColor: this.vLineColor, lineSpacing: this.lineSpacing,
      columnWidth: this.columnWidth, pdfText: this.pdfText
    };
    localStorage.setItem('cursiveApp_v1', JSON.stringify(settings));
    this.paginateText();
  }

  private loadSettings(): void {
    const saved = localStorage.getItem('cursiveApp_v1');
    if (saved) Object.assign(this, JSON.parse(saved));
  }

  public paginateText(): void {
    const maxChars = 1600;
    const words = this.pdfText.split(' ');
    const newPages: string[] = [];
    let current = '';
    words.forEach(w => {
      if ((current + w).length > maxChars) {
        newPages.push(current);
        current = w + ' ';
      } else {
        current += w + ' ';
      }
    });
    newPages.push(current);
    this.pages = newPages;
  }

  public async generatePdf(): Promise<void> {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageElements = document.querySelectorAll('.a4-page');

    for (let i = 0; i < pageElements.length; i++) {
      const canvas = await html2canvas(pageElements[i] as HTMLElement, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      if (i > 0) doc.addPage();
      doc.addImage(imgData, 'PNG', 0, 0, 210, 297);
    }
    doc.save(`Cursive_Practice_${this.userName}.pdf`);
  }

  /**
 * Gets the clean display name for the currently selected font value
 */
get selectedFontName(): string {
  const found = this.fontOptions.find(f => f.value === this.selectedFont);
  // If found, return name; otherwise, clean up the raw string as a fallback
  return found ? found.name : this.selectedFont.split(',')[0].replace(/"/g, '');
}
}