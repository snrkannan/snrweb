import { Component } from '@angular/core';
import { PDFDocument } from 'pdf-lib';

@Component({
  selector: 'app-pdf-merger',
  templateUrl: './pdf-merger.component.html',
  styleUrls: ['./pdf-merger.component.scss']
})
export class PdfMergerComponent {
  pdfFiles: { file: File; name: string; order: number }[] = [];

  onFilesSelected(event: any) {
    const files: FileList = event.target.files;
    this.pdfFiles = [];

    for (let i = 0; i < files.length; i++) {
      this.pdfFiles.push({ file: files[i], name: files[i].name, order: i + 1 });
    }
  }

  async mergePdfs() {
    const sortedFiles = this.pdfFiles.sort((a, b) => a.order - b.order);
    const mergedPdf = await PDFDocument.create();

    for (const { file } of sortedFiles) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach(page => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();
    const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'merged.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }
}
