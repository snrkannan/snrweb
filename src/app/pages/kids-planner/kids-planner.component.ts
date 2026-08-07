import { Component, OnInit } from '@angular/core';
import {
  KidsTask, KidsPdfOptions, TaskCategory, DayOfWeek,
  CATEGORY_META, DAYS, PdfBasis
} from './kids-planner.models';
import { KidsPlannerPdfService } from './kids-planner-pdf.service';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';

const DB_TABLE = 'kids_tasks';

@Component({
  selector: 'app-kids-planner',
  templateUrl: './kids-planner.component.html',
  styleUrls: ['./kids-planner.component.scss']
})
export class KidsPlannerComponent implements OnInit {

  // ── State ──────────────────────────────────────────────────────────────────
  tasks: KidsTask[] = [];
  filteredDay: DayOfWeek | 'All' = 'All';

  showForm = false;
  editingTask: KidsTask | null = null;

  // PDF panel
  showPdfPanel = false;
  pdfBasis: PdfBasis = 'weekly';
  pdfChildName = '';
  pdfMonth: number = new Date().getMonth();
  pdfYear: number = new Date().getFullYear();
  pdfWeekStart: string = this.todayIso();

  // Form model
  form: Partial<KidsTask> = this.emptyForm();

  // Consts exposed to template
  readonly DAYS = DAYS;
  readonly ALL_DAYS: Array<DayOfWeek | 'All'> = ['All', ...DAYS];
  readonly CATEGORIES = Object.entries(CATEGORY_META).map(([key, val]) => ({
    key: key as TaskCategory, ...val
  }));
  readonly MONTHS = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  readonly YEARS = [2024, 2025, 2026, 2027, 2028];
  readonly PRIORITIES: Array<'low'|'medium'|'high'> = ['low','medium','high'];

  /** Hours shown in the timetable grid (6 AM → 10 PM) */
  readonly TIME_SLOTS: number[] = Array.from({ length: 17 }, (_, i) => i + 6);

  get filteredTasks(): KidsTask[] {
    if (this.filteredDay === 'All') return this.tasks;
    return this.tasks.filter(t => t.days.includes(this.filteredDay as DayOfWeek));
  }

  get tasksByDay(): Record<DayOfWeek, KidsTask[]> {
    const map = {} as Record<DayOfWeek, KidsTask[]>;
    DAYS.forEach(d => {
      map[d] = this.tasks.filter(t => t.days.includes(d))
                         .sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return map;
  }

  get statsTotal()    { return this.tasks.length; }
  get statsToday()    {
    const d = new Date().getDay();
    const key = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d] as DayOfWeek;
    return this.tasks.filter(t => t.days.includes(key)).length;
  }
  get statsChildren() {
    return new Set(this.tasks.map(t => t.childName).filter(Boolean)).size;
  }

  constructor(
    private pdfService: KidsPlannerPdfService,
    private supabase: SupabaseService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadFromStorage();
    const saved = localStorage.getItem('kp_child_name');
    if (saved) this.pdfChildName = saved;
    if (!this.pdfChildName) this.pdfChildName = 'My Child';
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  openAddForm(): void {
    this.editingTask = null;
    this.form = this.emptyForm();
    this.showForm = true;
  }

  openEditForm(task: KidsTask): void {
    this.editingTask = task;
    this.form = { ...task, days: [...task.days] };
    this.showForm = true;
  }

  closeForm(): void { this.showForm = false; this.editingTask = null; }

  toggleDay(day: DayOfWeek): void {
    const arr = this.form.days as DayOfWeek[];
    const idx = arr.indexOf(day);
    if (idx === -1) arr.push(day);
    else arr.splice(idx, 1);
  }

  isDaySelected(day: DayOfWeek): boolean {
    return (this.form.days as DayOfWeek[]).includes(day);
  }

  areAllDaysSelected(): boolean {
    return (this.form.days as DayOfWeek[]).length === DAYS.length;
  }

  toggleAllDays(): void {
    if (this.areAllDaysSelected()) {
      (this.form.days as DayOfWeek[]).splice(0);
    } else {
      this.form.days = [...DAYS];
    }
  }

  selectCategory(cat: TaskCategory): void {
    this.form.category = cat;
    this.form.emoji   = CATEGORY_META[cat].emoji;
    this.form.color   = CATEGORY_META[cat].color;
  }

  saveTask(): void {
    if (!this.form.title?.trim() || !this.form.days?.length || !this.form.startTime || !this.form.endTime) return;

    if (this.editingTask) {
      const idx = this.tasks.findIndex(t => t.id === this.editingTask!.id);
      if (idx !== -1) this.tasks[idx] = { ...this.editingTask, ...this.form } as KidsTask;
    } else {
      const task: KidsTask = {
        id: crypto.randomUUID(),
        createdAt: new Date(),
        ...this.form
      } as KidsTask;
      this.tasks.push(task);
    }

    this.saveToStorage();
    this.closeForm();
  }

  deleteTask(id: string): void {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.saveToStorage();
    if (this.auth.isLoggedIn() && this.supabase.client) {
      this.supabase.client.from(DB_TABLE).delete().eq('id', id)
        .then(({ error }) => { if (error) console.warn('Cloud delete failed:', error); });
    }
  }

  // ── PDF ────────────────────────────────────────────────────────────────────
  generatePdf(): void {
    if (this.pdfBasis !== 'template' && !this.tasks.length) return;
    const opts: KidsPdfOptions = {
      basis: this.pdfBasis,
      childName: this.pdfChildName || 'My Child',
      selectedMonth: this.pdfMonth,
      selectedYear: this.pdfYear,
      weekStartDate: this.pdfWeekStart
    };
    localStorage.setItem('kp_child_name', this.pdfChildName);
    this.pdfService.generate(this.tasks, opts);
  }

  // ── Utilities ──────────────────────────────────────────────────────────────
  getCategoryMeta(cat: TaskCategory) { return CATEGORY_META[cat]; }
  getPriorityIcon(p: string): string {
    return p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '🟢';
  }

  /**
   * Returns tasks for a given day that START within the given hour slot.
   * e.g. hour=9 captures tasks with startTime between 09:00 and 09:59.
   */
  getTasksForSlot(day: DayOfWeek, hour: number): KidsTask[] {
    return this.tasks.filter(t => {
      if (!t.days.includes(day)) return false;
      const h = parseInt(t.startTime.split(':')[0], 10);
      return h === hour;
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  /** Format hour number to display label, e.g. 9 → '9 AM', 13 → '1 PM' */
  formatHour(hour: number): string {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    return `${h} ${ampm}`;
  }

  /** Convert "HH:MM" (24-hr) to "H:MM AM/PM" (12-hr) */
  formatTime(time: string): string {
    if (!time) return '';
    const [hStr, mStr] = time.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const ampm  = h >= 12 ? 'PM' : 'AM';
    const hour  = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  onStartDateChange(): void {
    if (this.form.isWeeklyOnce && this.form.startDate) {
      const date = new Date(this.form.startDate + 'T00:00:00');
      const dayIndex = date.getDay();
      const day = DAYS[dayIndex];
      this.form.days = [day];
    }
  }

  private emptyForm(): Partial<KidsTask> {
    return {
      title: '',
      description: '',
      category: 'school',
      days: [],
      startTime: '08:00',
      endTime: '09:00',
      emoji: CATEGORY_META['school'].emoji,
      color: CATEGORY_META['school'].color,
      childName: this.pdfChildName || '',
      priority: 'medium',
      isWeeklyOnce: false,
      startDate: '',
      endDate: ''
    };
  }

  /** Save all tasks: localStorage always + Supabase if logged in */
  private saveToStorage(): void {
    localStorage.setItem('kp_tasks', JSON.stringify(this.tasks));
    if (this.auth.isLoggedIn()) {
      this.saveAllToCloud().catch(err => console.warn('Cloud save failed:', err));
    }
  }

  private async saveAllToCloud(): Promise<void> {
    if (!this.supabase.client) return;
    const userId = this.auth.currentUser?.id;
    if (!userId) return;

    const rows = this.tasks.map(t => ({
      id: t.id,
      user_id: userId,
      data: t,
      updated_at: new Date().toISOString()
    }));

    const { error } = await this.supabase.client
      .from(DB_TABLE)
      .upsert(rows, { onConflict: 'id' });

    if (error) throw error;
  }

  /** Load tasks: Supabase if logged in, localStorage otherwise */
  private loadFromStorage(): void {
    if (this.auth.isLoggedIn()) {
      this.loadFromCloud();
    } else {
      this.loadFromLocal();
    }
  }

  private async loadFromCloud(): Promise<void> {
    if (!this.supabase.client) { this.loadFromLocal(); return; }
    const userId = this.auth.currentUser?.id;
    if (!userId) { this.loadFromLocal(); return; }

    try {
      const { data, error } = await this.supabase.client
        .from(DB_TABLE)
        .select('data')
        .eq('user_id', userId);

      if (error) throw error;

      if (data && data.length > 0) {
        this.tasks = data.map((row: any) => row['data'] as KidsTask);
      } else {
        // Nothing in cloud — migrate localStorage up
        this.loadFromLocal();
        if (this.tasks.length > 0) {
          await this.saveAllToCloud();
        }
      }
    } catch (err) {
      console.warn('Cloud load failed, using local data:', err);
      this.loadFromLocal();
    }
  }

  private loadFromLocal(): void {
    try {
      const raw = localStorage.getItem('kp_tasks');
      if (raw) this.tasks = JSON.parse(raw);
    } catch { this.tasks = []; }
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  trackById(_: number, t: KidsTask) { return t.id; }
}

