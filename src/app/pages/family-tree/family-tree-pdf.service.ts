import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import { FamilyTree, FamilyMember, PdfOptions } from './family-tree.models';

@Injectable({ providedIn: 'root' })
export class FamilyTreePdfService {

  async export(tree: FamilyTree, opts: PdfOptions, canvasEl: HTMLElement | null) {
    const doc = new jsPDF(opts.orientation || 'landscape', 'mm', opts.paperSize || 'a4');
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

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
          const w = card.offsetWidth || 160;
          const h = card.offsetHeight || 90;
          minX = Math.min(minX, l);
          minY = Math.min(minY, t);
          maxX = Math.max(maxX, l + w);
          maxY = Math.max(maxY, t + h);
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

        let svgGroup: SVGElement | null = null;
        if (svgEl) {
          svgEl.setAttribute('width',  String(totalW));
          svgEl.setAttribute('height', String(totalH));
          // Wrap all children of svgEl in a group tag with a transform attribute to shift them
          svgGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGElement;
          svgGroup.setAttribute('transform', `translate(${offsetX}, ${offsetY})`);
          while (svgEl.firstChild) {
            svgGroup.appendChild(svgEl.firstChild);
          }
          svgEl.appendChild(svgGroup);
        }

        // Temporarily hide action buttons and checkboxes inside cards without changing card height
        const actionElements = Array.from(canvasEl.querySelectorAll<HTMLElement>('.ft-card-actions, .ft-card-check'));
        actionElements.forEach(el => el.style.visibility = 'hidden');

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
        actionElements.forEach(el => el.style.visibility = '');
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
          if (svgGroup) {
            // Unwrap SVG children
            while (svgGroup.firstChild) {
              svgEl.appendChild(svgGroup.firstChild);
            }
            svgGroup.remove();
          }
        }

        if (opts.enableTiling) {
          const cols = opts.tileCols || 2;
          const rows = opts.tileRows || 2;
          const sw = snapshot.width / cols;
          const sh = snapshot.height / rows;

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (r > 0 || c > 0) {
                doc.addPage();
              }
              const sx = c * sw;
              const sy = r * sh;

              const tileCanvas = document.createElement('canvas');
              tileCanvas.width = sw;
              tileCanvas.height = sh;
              const tileCtx = tileCanvas.getContext('2d');
              if (tileCtx) {
                tileCtx.drawImage(snapshot, sx, sy, sw, sh, 0, 0, sw, sh);
              }
              const imgData = tileCanvas.toDataURL('image/jpeg', 0.85);
              const imgW = pw - 20;
              const imgH = ph - 30;

              // Title / position header
              doc.setFontSize(10);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(50);
              doc.text(`Family Tree Poster - Sheet [Row ${r+1}, Col ${c+1}] of [${rows}x${cols}]`, pw / 2, 10, { align: 'center' });

              // Image content
              doc.addImage(imgData, 'JPEG', 10, 14, imgW, imgH);

              // Draw joining alignment border
              doc.setDrawColor(180);
              doc.setLineDashPattern([1, 2], 0);
              doc.rect(10, 14, imgW, imgH, 'S');
              doc.setLineDashPattern([], 0);

              // Grid paste instructions
              let inst = [];
              if (c > 0) inst.push(`Left edge: Align with Col ${c}`);
              if (c < cols - 1) inst.push(`Right edge: Align with Col ${c+2}`);
              if (r > 0) inst.push(`Top edge: Align with Row ${r}`);
              if (r < rows - 1) inst.push(`Bottom edge: Align with Row ${r+2}`);

              const instText = inst.length > 0 ? `✂️ JOINING GUIDE: ${inst.join('  |  ')}` : 'Single Page';
              doc.setFontSize(8);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(100);
              doc.text(instText, pw / 2, ph - 8, { align: 'center' });
            }
          }
        } else {
          const imgData = snapshot.toDataURL('image/jpeg', 0.85);
          const ratio = snapshot.height / snapshot.width;
          const imgW = pw - 20;
          const imgH = Math.min(imgW * ratio, ph - 30);
          doc.setFontSize(14); doc.setFont('helvetica', 'bold');
          doc.text('Family Tree', pw / 2, 12, { align: 'center' });
          doc.addImage(imgData, 'JPEG', 10, 18, imgW, imgH);
        }
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

      const maxW = pw - marginX * 2 - 12;

      for (const m of sorted) {
        const isGenChange = m.generation !== lastGen;
        const cardH = lineH * (this.countLines(m, opts, doc, maxW)) + 4;
        const headerH = isGenChange ? 14 : 0;
        const needed = cardH + headerH + 6;

        checkPage(needed);

        // Generation header
        if (isGenChange) {
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
        doc.roundedRect(marginX, y - 4, pw - marginX * 2, cardH, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        const genderDot = m.gender === 'male' ? '♂' : m.gender === 'female' ? '♀' : '⚧';
        doc.text(`${genderDot}  ${m.name}`, marginX + 4, y + 2);

        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        let row = y + lineH;

        if (opts.includeAge    && m.age)    { doc.text(`Age: ${m.age}`, marginX + 8, row); row += lineH; }
        if (opts.includeGender)              { doc.text(`Gender: ${m.gender}`, marginX + 8, row); row += lineH; }

        if (opts.includeSpouse && m.spouseId) {
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
          const wrapped = doc.splitTextToSize(`Notes: ${m.notes}`, maxW);
          doc.text(wrapped, marginX + 8, row); row += lineH * wrapped.length;
        }
        if (opts.includeCustomFields && m.customFields.length) {
          for (const cf of m.customFields) { doc.text(`${cf.key}: ${cf.value}`, marginX + 8, row); row += lineH; }
        }

        y = row + 6;
      }
    }

    doc.save(`family-tree-${Date.now()}.pdf`);
  }

  private countLines(m: FamilyMember, opts: PdfOptions, doc: jsPDF, maxW: number): number {
    let n = 1;
    if (opts.includeAge && m.age) n++;
    if (opts.includeGender) n++;
    if (opts.includeSpouse && m.spouseId) n++;
    if (opts.includeParents && m.parentIds.length) n++;
    if (opts.includeChildren && m.childIds.length) n++;
    if (opts.includeNotes && m.notes) {
      const wrapped = doc.splitTextToSize(`Notes: ${m.notes}`, maxW);
      n += wrapped.length;
    }
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
