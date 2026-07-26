import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import { KidsTask, KidsPdfOptions, CATEGORY_META, DAYS, DayOfWeek } from './kids-planner.models';

// ─── Pastel palette ──────────────────────────────────────────────────────────
// Page background: warm cream
const PAGE_BG: [number, number, number]        = [255, 253, 245];
// Header band: soft lavender-blue
const HEADER_BG: [number, number, number]      = [220, 235, 255];
const HEADER_TEXT: [number, number, number]    = [55,  80, 130];
// Day-column header: soft sky
const DAY_HDR_BG: [number, number, number]     = [210, 230, 255];
const DAY_HDR_TEXT: [number, number, number]   = [50,  80, 150];
// Card background for tasks: off-white
const CARD_BG: [number, number, number]        = [250, 250, 248];
// Card border/stripe: pastel per category (computed at runtime)
// Footer text
const FOOTER_COL: [number, number, number]     = [160, 160, 160];
// Checkbox circle fill (open)
const CHK_STROKE: [number, number, number]     = [160, 180, 200];
// Body text
const BODY_TEXT: [number, number, number]      = [60, 60, 60];
const META_TEXT: [number, number, number]      = [120, 120, 120];

@Injectable({ providedIn: 'root' })
export class KidsPlannerPdfService {

  // ── Public entry ────────────────────────────────────────────────────────────
  generate(tasks: KidsTask[], opts: KidsPdfOptions): void {
    switch (opts.basis) {
      case 'daily':    this.buildDaily(tasks, opts);    break;
      case 'weekly':   this.buildWeekly(tasks, opts);   break;
      case 'monthly':  this.buildMonthly(tasks, opts);  break;
      case 'template': this.buildTemplate(opts);        break;
    }
  }

  // ── Daily ───────────────────────────────────────────────────────────────────
  private buildDaily(tasks: KidsTask[], opts: KidsPdfOptions): void {
    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    DAYS.forEach((day, idx) => {
      if (idx > 0) doc.addPage();
      this.fillPageBg(doc, pw, ph);
      const dayTasks = tasks.filter(t => t.days.includes(day));
      this.drawPageHeader(doc, pw, `${day} - Daily Planner`, opts.childName);
      this.drawTaskList(doc, pw, ph, dayTasks, 40);
      this.drawFooter(doc, pw, ph, `${opts.childName}'s Daily Schedule  ·  ${day}`);
    });

    doc.save(`${opts.childName}-daily-planner.pdf`);
  }

  // ── Weekly ──────────────────────────────────────────────────────────────────
  private buildWeekly(tasks: KidsTask[], opts: KidsPdfOptions): void {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    this.fillPageBg(doc, pw, ph);
    this.drawPageHeader(doc, pw, 'Weekly Planner', opts.childName, true);

    const colW    = (pw - 28) / 7;
    const startY  = 42;
    const rowH    = 9;
    const maxRows = Math.floor((ph - startY - 22) / rowH);

    // Day column headers
    DAYS.forEach((day, i) => {
      const x = 14 + i * colW;
      doc.setFillColor(...DAY_HDR_BG);
      doc.roundedRect(x, startY, colW - 2, 9, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...DAY_HDR_TEXT);
      doc.text(day, x + colW / 2 - 1, startY + 6, { align: 'center' });
    });

    doc.setTextColor(...BODY_TEXT);

    // Task rows per column
    DAYS.forEach((day, i) => {
      const x        = 14 + i * colW;
      const dayTasks = tasks
        .filter(t => t.days.includes(day))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      let y          = startY + 12;

      dayTasks.slice(0, maxRows).forEach(task => {
        const meta    = CATEGORY_META[task.category];
        const pastel  = this.pastelOf(meta.color);

        // Card bg
        doc.setFillColor(...pastel);
        doc.setDrawColor(220, 228, 240);
        doc.roundedRect(x, y, colW - 2, rowH - 1.5, 1, 1, 'FD');

        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...BODY_TEXT);
        const label = doc.splitTextToSize(this.stripEmoji(task.title), colW - 9);
        doc.text(label[0], x + 2, y + 3.5);

        // Time (AM/PM)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);
        doc.setTextColor(...META_TEXT);
        doc.text(`${this.formatTime(task.startTime)}–${this.formatTime(task.endTime)}`, x + 2, y + 6);

        // Pen checkbox circle (top-right of chip)
        this.drawCheckCircle(doc, x + colW - 5, y + rowH / 2 - 1.5, 2);

        doc.setTextColor(...BODY_TEXT);
        y += rowH;
      });

      if (!dayTasks.length) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.5);
        doc.setTextColor(180, 190, 200);
        doc.text('Free day!', x + 2, startY + 18);
        doc.setTextColor(...BODY_TEXT);
      }
    });

    this.drawFooter(doc, pw, ph, `${opts.childName}'s Weekly Schedule`);
    doc.save(`${opts.childName}-weekly-planner.pdf`);
  }

  // ── Monthly ─────────────────────────────────────────────────────────────────
  private buildMonthly(tasks: KidsTask[], opts: KidsPdfOptions): void {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pw  = doc.internal.pageSize.getWidth();
    const ph  = doc.internal.pageSize.getHeight();

    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
    const monthName  = monthNames[opts.selectedMonth];

    this.fillPageBg(doc, pw, ph);
    this.drawPageHeader(doc, pw, `${monthName} ${opts.selectedYear} - Monthly Planner`, opts.childName, true);

    const firstDay    = new Date(opts.selectedYear, opts.selectedMonth, 1);
    const daysInMonth = new Date(opts.selectedYear, opts.selectedMonth + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;   // Mon = 0

    const gridX = 14, gridY = 42;
    const cellW = (pw - 28) / 7;
    const cellH = (ph - gridY - 18) / 6;

    // Day-of-week headers
    const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    dayLabels.forEach((dl, i) => {
      doc.setFillColor(...DAY_HDR_BG);
      doc.roundedRect(gridX + i * cellW, gridY, cellW - 1, 7, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...DAY_HDR_TEXT);
      doc.text(dl, gridX + i * cellW + cellW / 2, gridY + 5, { align: 'center' });
    });
    doc.setTextColor(...BODY_TEXT);

    // Calendar cells
    let cellDay = 1;
    for (let week = 0; week < 6; week++) {
      for (let dow = 0; dow < 7; dow++) {
        const cellNum = week * 7 + dow;
        if (cellNum < startOffset || cellDay > daysInMonth) continue;

        const cx = gridX + dow * cellW;
        const cy = gridY + 7 + week * cellH;

        // Cell bg
        doc.setDrawColor(210, 220, 235);
        doc.setFillColor(...CARD_BG);
        doc.roundedRect(cx, cy, cellW - 1, cellH - 1, 1, 1, 'FD');

        // Date number
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(100, 120, 160);
        doc.text(String(cellDay), cx + 2.5, cy + 5);

        // Tasks for this weekday
        const weekdayKey = dayLabels[dow] as DayOfWeek;
        const dayTasks   = tasks.filter(t => t.days.includes(weekdayKey));
        let ty = cy + 8;

        dayTasks.slice(0, 3).forEach(task => {
          const meta   = CATEGORY_META[task.category];
          const pastel = this.pastelOf(meta.color);
          doc.setFillColor(...pastel);
          doc.setDrawColor(200, 210, 225);
          doc.roundedRect(cx + 1, ty, cellW - 6, 4.5, 0.5, 0.5, 'FD');

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(4.5);
          doc.setTextColor(...BODY_TEXT);
          const lbl = doc.splitTextToSize(this.stripEmoji(task.title), cellW - 10);
          doc.text(lbl[0], cx + 2.5, ty + 3);

          // Small checkbox circle
          this.drawCheckCircle(doc, cx + cellW - 5.5, ty + 2.2, 1.6);

          doc.setTextColor(...BODY_TEXT);
          ty += 5.2;
        });

        cellDay++;
      }
    }

    // Legend
    let lx = 14;
    const ly = ph - 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 120);
    doc.text('Legend:', lx, ly);
    lx += 14;

    Object.values(CATEGORY_META).forEach(meta => {
      const pastel = this.pastelOf(meta.color);
      doc.setFillColor(...pastel);
      doc.setDrawColor(180, 190, 210);
      doc.roundedRect(lx, ly - 3.5, 3, 3, 0.4, 0.4, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(80, 80, 100);
      doc.text(meta.label, lx + 4, ly - 0.5);
      lx += 24;
    });

    this.drawFooter(doc, pw, ph, `${opts.childName}'s Monthly Schedule  ·  ${monthName} ${opts.selectedYear}`);
    doc.save(`${opts.childName}-${monthName.toLowerCase()}-${opts.selectedYear}-planner.pdf`);
  }

  // ── Reusable Template ────────────────────────────────────────────────────────
  // A blank weekly grid — print it every week and fill in by hand.
  // Each day column has 8 blank task slots: time field + title line + checkbox.
  private buildTemplate(opts: KidsPdfOptions): void {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pw  = doc.internal.pageSize.getWidth();
    const ph  = doc.internal.pageSize.getHeight();

    this.fillPageBg(doc, pw, ph);

    // ── Header band ──────────────────────────────────────────────────────────
    doc.setFillColor(...HEADER_BG);
    doc.rect(0, 0, pw, 26, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(...HEADER_TEXT);
    doc.text(`${opts.childName}'s Weekly Planner`, pw / 2, 11, { align: 'center' });

    // Sub-line: "Week of ____________" — fill by hand
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...META_TEXT);
    doc.text('Week of', pw / 2 - 28, 20, { align: 'right' });
    // Dotted line for hand-fill
    doc.setDrawColor(...CHK_STROKE);
    doc.setLineWidth(0.3);
    doc.line(pw / 2 - 26, 20, pw / 2 + 26, 20);

    // ── Column layout ────────────────────────────────────────────────────────
    const colW   = (pw - 28) / 7;
    const startY = 30;
    const slotH  = 12;    // each blank task slot height
    const slots  = 8;     // blank rows per day column

    // Day headers
    DAYS.forEach((day, i) => {
      const x = 14 + i * colW;
      doc.setFillColor(...DAY_HDR_BG);
      doc.roundedRect(x, startY, colW - 2, 9, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...DAY_HDR_TEXT);
      doc.text(day, x + colW / 2 - 1, startY + 6, { align: 'center' });
    });

    // Blank task slots
    for (let slot = 0; slot < slots; slot++) {
      DAYS.forEach((_, i) => {
        const x  = 14 + i * colW;
        const sy = startY + 11 + slot * slotH;

        // Slot card bg
        doc.setFillColor(252, 252, 250);
        doc.setDrawColor(215, 225, 240);
        doc.setLineWidth(0.25);
        doc.roundedRect(x, sy, colW - 2, slotH - 1, 1, 1, 'FD');

        // Time mini-field (dotted underline)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);
        doc.setTextColor(190, 200, 215);
        doc.text('Time', x + 1.5, sy + 3.8);
        doc.setDrawColor(200, 210, 225);
        doc.setLineWidth(0.2);
        doc.line(x + 1.5, sy + 4.5, x + 13, sy + 4.5);

        // Title blank line
        doc.setTextColor(200, 210, 225);
        doc.setFontSize(5);
        doc.text('Task', x + 1.5, sy + 8);
        doc.line(x + 1.5, sy + 8.7, x + colW - 7, sy + 8.7);

        // Pen checkbox circle (right side, vertically centered)
        this.drawCheckCircle(doc, x + colW - 5, sy + slotH / 2 - 0.5, 2.5);
      });
    }

    // ── Footer note ──────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...FOOTER_COL);
    doc.text(
      'Fill in tasks and tick the circle when done  |  Print as many copies as you need',
      pw / 2, ph - 5, { align: 'center' }
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('SNR Kids Planner', 14, ph - 5);

    doc.save(`${opts.childName}-weekly-template.pdf`);
  }





  /** Pen-style open checkbox circle */
  private drawCheckCircle(doc: jsPDF, cx: number, cy: number, r: number): void {
    doc.setDrawColor(...CHK_STROKE);
    doc.setLineWidth(0.5);
    // jsPDF circle: ellipse(x, y, rx, ry, style)
    doc.ellipse(cx, cy, r, r, 'S');
  }

  /** Fill the whole page with a warm cream background */
  private fillPageBg(doc: jsPDF, pw: number, ph: number): void {
    doc.setFillColor(...PAGE_BG);
    doc.rect(0, 0, pw, ph, 'F');
  }

  /** Convert a saturated hex color to a soft pastel RGB triple */
  private pastelOf(hex: string): [number, number, number] {
    const [r, g, b] = this.hexToRgb(hex);
    // Blend 30% category color + 70% white → light pastel
    return [
      Math.round(r * 0.25 + 255 * 0.75),
      Math.round(g * 0.25 + 255 * 0.75),
      Math.round(b * 0.25 + 255 * 0.75),
    ];
  }

  /** Full-saturation RGB from hex (used for accent stripes / borders) */
  private accentOf(hex: string): [number, number, number] {
    return this.hexToRgb(hex);
  }

  private drawPageHeader(
    doc: jsPDF, pw: number, title: string,
    childName: string, landscape = false
  ): void {
    // Soft header band
    doc.setFillColor(...HEADER_BG);
    doc.rect(0, 0, pw, 30, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...HEADER_TEXT);
    doc.text(title, pw / 2, 13, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 130, 180);
    doc.text(`${childName}'s Schedule  -  Schedule, Organise, Achieve!`, pw / 2, 23, { align: 'center' });

    doc.setTextColor(...BODY_TEXT);
  }

  private drawTaskList(
    doc: jsPDF, pw: number, ph: number,
    tasks: KidsTask[], startY: number
  ): void {
    const marginX = 14;
    const lineH   = 10;
    let y         = startY;

    if (!tasks.length) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(11);
      doc.setTextColor(180, 190, 200);
      doc.text('No tasks scheduled for this day  :)', pw / 2, y + 12, { align: 'center' });
      doc.setTextColor(...BODY_TEXT);
      return;
    }

    const sorted = [...tasks].sort((a, b) => a.startTime.localeCompare(b.startTime));

    sorted.forEach(task => {
      if (y + lineH * 2 > ph - 20) { doc.addPage(); this.fillPageBg(doc, pw, ph); y = 20; }

      const meta   = CATEGORY_META[task.category];
      const pastel = this.pastelOf(meta.color);
      const accent = this.accentOf(meta.color);

      // Left accent stripe
      doc.setFillColor(...accent);
      doc.rect(marginX, y, 3, lineH + 5, 'F');

      // Card bg (pastel)
      doc.setFillColor(...pastel);
      doc.setDrawColor(210, 220, 235);
      doc.setLineWidth(0.3);
      doc.roundedRect(marginX + 4, y, pw - marginX * 2 - 4, lineH + 5, 1.5, 1.5, 'FD');

      // Category pill (accent color, white text)
      doc.setFillColor(...accent);
      doc.roundedRect(marginX + 6, y + 1.5, 22, 4.5, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(255, 255, 255);
      doc.text(meta.label.toUpperCase(), marginX + 17, y + 4.5, { align: 'center' });

      // Task title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...BODY_TEXT);
      doc.text(this.stripEmoji(task.title), marginX + 32, y + 6);

      // Time AM/PM (right-aligned, leave room for action boxes)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...META_TEXT);
      doc.text(
        `${this.formatTime(task.startTime)} – ${this.formatTime(task.endTime)}`,
        pw - marginX - 38, y + 6, { align: 'right' }
      );

      // Description
      if (task.description) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(150, 155, 165);
        const desc = doc.splitTextToSize(task.description, pw - marginX * 2 - 72);
        doc.text(desc[0], marginX + 32, y + 11);
      }

      // ── Action boxes (right side): Done ○  Edit ✏  Delete ✗ ─────────────
      const cardH  = lineH + 5;
      const boxW   = 10;
      const boxH   = cardH - 4;
      const boxY   = y + 2;
      const boxGap = 2;
      const box3X  = pw - marginX - 2 - boxW;          // Delete
      const box2X  = box3X - boxGap - boxW;             // Edit
      const box1X  = box2X - boxGap - boxW;             // Done

      // Done — open circle
      doc.setFillColor(245, 248, 255);
      doc.setDrawColor(...CHK_STROKE);
      doc.setLineWidth(0.35);
      doc.roundedRect(box1X, boxY, boxW, boxH, 1, 1, 'FD');
      this.drawCheckCircle(doc, box1X + boxW / 2, boxY + boxH / 2, 2.8);
      doc.setFont('courier', 'italic');
      doc.setFontSize(4.8);
      doc.setTextColor(...CHK_STROKE);
      doc.text('done', box1X + boxW / 2, boxY + boxH - 1.2, { align: 'center' });

      // Edit — pencil box
      doc.setFillColor(255, 252, 235);
      doc.setDrawColor(200, 185, 100);
      doc.roundedRect(box2X, boxY, boxW, boxH, 1, 1, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(180, 160, 60);
      doc.text('*', box2X + boxW / 2, boxY + boxH / 2 + 1.5, { align: 'center' });
      doc.setFont('courier', 'italic');
      doc.setFontSize(4.8);
      doc.text('edit', box2X + boxW / 2, boxY + boxH - 1.2, { align: 'center' });

      // Delete — X box
      doc.setFillColor(255, 245, 245);
      doc.setDrawColor(200, 140, 140);
      doc.roundedRect(box3X, boxY, boxW, boxH, 1, 1, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(210, 100, 100);
      doc.text('X', box3X + boxW / 2, boxY + boxH / 2 + 1.8, { align: 'center' });
      doc.setFont('courier', 'italic');
      doc.setFontSize(4.8);
      doc.setTextColor(200, 140, 140);
      doc.text('del', box3X + boxW / 2, boxY + boxH - 1.2, { align: 'center' });

      doc.setTextColor(...BODY_TEXT);
      y += lineH + 9;
    });
  }

  private drawFooter(doc: jsPDF, pw: number, ph: number, text: string): void {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(...FOOTER_COL);
    doc.text(
      `Generated by SNR Kids Planner  ·  ${new Date().toLocaleDateString()}`,
      pw / 2, ph - 5, { align: 'center' }
    );
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(130, 140, 160);
    doc.text(text, 14, ph - 5);
  }

  /** Convert "HH:MM" 24-hr string to "H:MM AM/PM" 12-hr display */
  private formatTime(time: string): string {
    if (!time) return '';
    const [hStr, mStr] = time.split(':');
    const h    = parseInt(hStr, 10);
    const m    = parseInt(mStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  private hexToRgb(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  }

  /**
   * Remove emoji and other non-Latin-1 characters that jsPDF's built-in
   * Helvetica font cannot render (they show as garbage like "Ø=ÜÚ").
   */
  private stripEmoji(text: string): string {
    // Remove anything outside the Basic Latin + Latin-1 Supplement ranges
    return text
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '') // emoji blocks
      .replace(/[\u2600-\u27FF]/gu, '')         // misc symbols, dingbats
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')  // supplemental symbols
      .replace(/[\uFE0F]/gu, '')               // variation selectors
      .replace(/[\u200D]/gu, '')               // zero-width joiners
      .trim();
  }
}
