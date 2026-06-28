import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import { FamilyTree, FamilyMember, PdfOptions } from './family-tree.models';

@Injectable({ providedIn: 'root' })
export class FamilyTreePdfService {

  async export(tree: FamilyTree, opts: PdfOptions, canvasEl: HTMLElement | null) {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pw = doc.internal.pageSize.getWidth();

    let members = [...tree.members];
    if (opts.exportMode === 'ancestors') {
      members = members.filter(m => m.generation <= 0);
    } else if (opts.exportMode === 'descendants') {
      members = members.filter(m => m.generation >= 0);
    }

    // ── Page 1: Visual tree snapshot ────────────────────────────────────────
    if (opts.layoutExport && canvasEl) {
      try {
        const { default: html2canvas } = await import('html2canvas');

        // canvasEl is the inner .ft-canvas div with transform applied.
        // We need to capture it without the CSS transform so nothing gets clipped.
        // Strategy: temporarily remove the transform, capture, then restore.
        const originalTransform = canvasEl.style.transform;

        // Calculate the min x/y of all cards to determine offset needed
        const cards = Array.from(canvasEl.querySelectorAll<HTMLElement>('.ft-card'));
        const svgEl = canvasEl.querySelector<SVGElement>('.ft-svg');

        // Find bounds of all card positions
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        cards.forEach(card => {
          const l = parseFloat(card.style.left) || 0;
          const t = parseFloat(card.style.top)  || 0;
          minX = Math.min(minX, l);
          minY = Math.min(minY, t);
          maxX = Math.max(maxX, l + 160);
          maxY = Math.max(maxY, t + 90);
        });
        if (!cards.length) { minX = 0; minY = 0; maxX = 800; maxY = 500; }

        const padding = 40;
        const totalW = maxX - minX + padding * 2;
        const totalH = maxY - minY + padding * 2;
        const offsetX = -minX + padding;
        const offsetY = -minY + padding;

        // Shift all cards and the SVG so everything starts at (padding, padding)
        cards.forEach(card => {
          card.style.left = (parseFloat(card.style.left) + offsetX) + 'px';
          card.style.top  = (parseFloat(card.style.top)  + offsetY) + 'px';
        });
        if (svgEl) {
          svgEl.setAttribute('width',  String(totalW));
          svgEl.setAttribute('height', String(totalH));
          svgEl.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        }

        // Remove the CSS transform so html2canvas sees the real coordinates
        canvasEl.style.transform = 'none';
        canvasEl.style.width  = totalW + 'px';
        canvasEl.style.height = totalH + 'px';

        const snapshot = await html2canvas(canvasEl, {
          scale: 1.5,
          useCORS: true,
          backgroundColor: '#f8f9fa',
          width: totalW,
          height: totalH,
          scrollX: 0,
          scrollY: 0
        });

        // Restore everything
        canvasEl.style.transform = originalTransform;
        canvasEl.style.width  = '';
        canvasEl.style.height = '';
        cards.forEach(card => {
          card.style.left = (parseFloat(card.style.left) - offsetX) + 'px';
          card.style.top  = (parseFloat(card.style.top)  - offsetY) + 'px';
        });
        if (svgEl) {
          svgEl.removeAttribute('width');
          svgEl.removeAttribute('height');
          svgEl.style.transform = '';
        }

        const imgData = snapshot.toDataURL('image/jpeg', 0.85);
        const ph = doc.internal.pageSize.getHeight();
        const ratio = snapshot.height / snapshot.width;
        const imgW = pw - 20;
        const imgH = Math.min(imgW * ratio, ph - 30);
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text('Family Tree', pw / 2, 12, { align: 'center' });
        doc.addImage(imgData, 'JPEG', 10, 18, imgW, imgH);
      } catch (e) { console.warn('Tree snapshot failed', e); }
    }

    // ── Report pages ─────────────────────────────────────────────────────────
    if (opts.reportExport) {
      if (opts.layoutExport) doc.addPage();

      const lineH = 7, marginX = 14, pageH = doc.internal.pageSize.getHeight();
      let y = 20;

      const checkPage = (needed = lineH * 2) => {
        if (y + needed > pageH - 15) { doc.addPage(); y = 20; }
      };

      doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
      doc.text('Family Members Report', pw / 2, y, { align: 'center' }); y += 12;

      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.setTextColor(120);
      doc.text(`Generated: ${new Date().toLocaleDateString()} | Mode: ${opts.exportMode} | ${members.length} members`, pw / 2, y, { align: 'center' });
      doc.setTextColor(0); y += 10;

      // Sort by generation then name
      const sorted = [...members].sort((a, b) => a.generation !== b.generation ? a.generation - b.generation : a.name.localeCompare(b.name));

      let lastGen: number | null = null;

      for (const m of sorted) {
        checkPage(lineH * 8);

        // Generation header
        if (m.generation !== lastGen) {
          lastGen = m.generation;
          y += 4;
          const [cr, cg, cb] = this.hexToRgb(this.genColor(m.generation));
          doc.setFillColor(cr, cg, cb);
          doc.roundedRect(marginX, y - 5, pw - marginX * 2, 8, 2, 2, 'F');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255);
          doc.text(`Generation ${m.generation === 0 ? '0 (Root)' : m.generation > 0 ? `+${m.generation} (Descendants)` : `${m.generation} (Ancestors)`}`, marginX + 4, y);
          doc.setTextColor(0); y += 10;
        }

        // Member card
        doc.setDrawColor(220); doc.setFillColor(252, 252, 252);
        doc.roundedRect(marginX, y - 4, pw - marginX * 2, lineH * (this.countLines(m, opts)) + 4, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        const genderDot = m.gender === 'male' ? '♂' : m.gender === 'female' ? '♀' : '⚧';
        doc.text(`${genderDot}  ${m.name}`, marginX + 4, y + 2);

        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        let row = y + lineH;

        if (opts.includeAge    && m.age)    { doc.text(`Age: ${m.age}`, marginX + 8, row); row += lineH; }
        if (opts.includeGender)              { doc.text(`Gender: ${m.gender}`, marginX + 8, row); row += lineH; }

        if (opts.includeSpouse && m.spouseId) {
          // We don't have tree ref here but we pass it in as sorted
          const sp = sorted.find(x => x.id === m.spouseId);
          if (sp) { doc.text(`Spouse: ${sp.name}`, marginX + 8, row); row += lineH; }
        }
        if (opts.includeParents && m.parentIds.length) {
          const pNames = m.parentIds.map(pid => sorted.find(x => x.id === pid)?.name ?? '?').join(', ');
          doc.text(`Parents: ${pNames}`, marginX + 8, row); row += lineH;
        }
        if (opts.includeChildren && m.childIds.length) {
          const cNames = m.childIds.map(cid => sorted.find(x => x.id === cid)?.name ?? '?').join(', ');
          doc.text(`Children: ${cNames}`, marginX + 8, row); row += lineH;
        }
        if (opts.includeNotes && m.notes) {
          const wrapped = doc.splitTextToSize(`Notes: ${m.notes}`, pw - marginX * 2 - 12);
          doc.text(wrapped, marginX + 8, row); row += lineH * wrapped.length;
        }
        if (opts.includeCustomFields && m.customFields.length) {
          for (const cf of m.customFields) { doc.text(`${cf.key}: ${cf.value}`, marginX + 8, row); row += lineH; }
        }

        y = row + 6;
        checkPage();
      }
    }

    doc.save(`family-tree-${Date.now()}.pdf`);
  }

  private countLines(m: FamilyMember, opts: PdfOptions): number {
    let n = 1;
    if (opts.includeAge && m.age) n++;
    if (opts.includeGender) n++;
    if (opts.includeSpouse && m.spouseId) n++;
    if (opts.includeParents && m.parentIds.length) n++;
    if (opts.includeChildren && m.childIds.length) n++;
    if (opts.includeNotes && m.notes) n++;
    if (opts.includeCustomFields) n += m.customFields.length;
    return n;
  }

  private genColor(gen: number): string {
    const colors = ['#6f42c1','#0d6efd','#198754','#fd7e14','#dc3545','#0d9488','#6c757d'];
    return colors[Math.abs(gen) % colors.length];
  }

  private hexToRgb(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  }
}
