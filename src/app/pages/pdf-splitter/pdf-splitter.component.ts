import { Component } from '@angular/core';
import { PDFDocument } from 'pdf-lib';

@Component({
  selector: 'app-pdf-splitter',
  templateUrl: './pdf-splitter.component.html',
  styleUrls: ['./pdf-splitter.component.scss']
})
export class PdfSplitterComponent {
  selectedFile!: File;
  pagesPerFile: number = 1;

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  async splitPdf() {
    if (!this.selectedFile || this.pagesPerFile <= 0) {
      alert('Please select a PDF file and enter a valid number of pages.');
      return;
    }

    const reader = new FileReader();
    reader.readAsArrayBuffer(this.selectedFile);
    reader.onload = async () => {
      const pdf = await PDFDocument.load(reader.result as ArrayBuffer);
      const totalPages = pdf.getPageCount();
      for (let i = 0; i < totalPages; i += this.pagesPerFile) {
        const newPdf = await PDFDocument.create();
        const end = Math.min(i + this.pagesPerFile, totalPages);
        const copiedPages = await newPdf.copyPages(pdf, Array.from({ length: end - i }, (_, j) => i + j));
        copiedPages.forEach((page) => newPdf.addPage(page));
        const newPdfBytes = await newPdf.save();
        this.downloadPdf(newPdfBytes, `split-${i + 1}-${end}.pdf`);
      }
    };
  }

  downloadPdf(data: Uint8Array, filename: string) {
    const blob = new Blob([data], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
