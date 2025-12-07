import { Component, ElementRef, ViewChild } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-cursive-write', 
  templateUrl: './cursive-write.component.html',
  styleUrls: ['./cursive-write.component.scss']
})
export class CursiveWriteComponent {
  // Binds to the textarea input
  public pdfText: string = 'Hello World!\nThis text will be converted to a PDF using a cursive font.';

  // Binds to the HTML element that contains the text we want to capture
  @ViewChild('pdfContent', { static: false }) pdfContent!: ElementRef;

  constructor() {}

  /**
   * Generates a PDF by converting the styled HTML content into an image
   * using html2canvas and then embedding the image into a jspdf document.
   */
  public generatePdf(): void {
    const data = this.pdfContent.nativeElement;

    // Use html2canvas to render the HTML element as a canvas (image)
    html2canvas(data, {
      scale: 2, // Increase scale for better resolution
      useCORS: true // Important for custom fonts/images
    }).then(canvas => {
      const imgWidth = 200; // PDF content width in mm (standard A4 is 210mm wide)
      const pageHeight = 295; // Standard A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      const doc = new jsPDF('p', 'mm', 'a4'); 
      let position = 0;

      const imgData = canvas.toDataURL('image/png');

      // Add the image to the PDF
      doc.addImage(imgData, 'PNG', 5, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Handle content that spans multiple pages
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        doc.addPage();
        doc.addImage(imgData, 'PNG', 5, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Save the PDF
      doc.save('cursive-document.pdf');
    });
  }
}