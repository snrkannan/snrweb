import { Component } from '@angular/core';
import { PDFDocument } from 'pdf-lib';

@Component({
  selector: 'app-pdf-merger',
  templateUrl: './pdf-merger.component.html',
  styleUrls: ['./pdf-merger.component.scss']
})
export class PdfMergerComponent {
  selectedFiles: File[] = [];

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.selectedFiles = Array.from(input.files);
    }
  }

  async mergePdfs() {
    if (this.selectedFiles.length < 2) {
      alert('Please select at least two PDFs to merge.');
      return;
    }

    const mergedPdf = await PDFDocument.create();
    for (const file of this.selectedFiles) {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      await new Promise<void>((resolve) => {
        reader.onload = async () => {
          const pdf = await PDFDocument.load(reader.result as ArrayBuffer);
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
          resolve();
        };
      });
    }

    const mergedPdfBytes = await mergedPdf.save();
    this.downloadPdf(mergedPdfBytes, 'merged.pdf');
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
