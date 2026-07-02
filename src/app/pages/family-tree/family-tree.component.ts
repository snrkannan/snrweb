import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { FamilyMember, FamilyTree, FamilyLink, FamilyGroup,
         RelationshipType, RELATIONSHIP_TYPES, PdfOptions, DEFAULT_PDF_OPTIONS } from './family-tree.models';
import { FamilyTreeService } from './family-tree.service';
import { FamilyTreePdfService } from './family-tree-pdf.service';

@Component({
  selector: 'app-family-tree',
  templateUrl: './family-tree.component.html',
  styleUrls: ['./family-tree.component.scss']
})
export class FamilyTreeComponent implements OnInit, OnDestroy {

  @ViewChild('treeCanvas') treeCanvas!: ElementRef<HTMLDivElement>;

  Math = Math;

  /** ISO date string for today — used as the max bound on the DOB picker. */
  get today(): string {
    return new Date().toISOString().split('T')[0];
  }

  tree: FamilyTree = { groups: [], members: [], links: [], activeGroupId: '' };
  filteredMembers: FamilyMember[] = [];
  searchQuery = '';
  selectedMember: FamilyMember | null = null;

  // modals
  showForm       = false;
  showConnect    = false;
  showPdfOpts    = false;
  showImport     = false;
  showGroupMgr   = false;
  showCrossConn  = false;
  showBulkEdit   = false;
  showLayoutPanel = false;

  // view mode
  viewMode: 'canvas' | 'list' = 'canvas';
  cardStyle: 'compact' | 'standard' | 'detailed' | 'photo' = 'standard';

  // list view sort
  listSort: { col: string; dir: 1 | -1 } = { col: 'name', dir: 1 };
  editingMember: FamilyMember | null = null;
  quickAddContext: { member: FamilyMember; rel: RelationshipType } | null = null;

  // add/edit form
  form: Partial<FamilyMember> & { relationshipType: RelationshipType; relatedMemberId: string; genMode: 'auto' | 'manual' } = this.emptyForm();

  // same-group connect
  connectForm = { fromId: '', toId: '', type: 'child' as RelationshipType };
  relationshipTypes = RELATIONSHIP_TYPES;

  // multi-select
  multiSelectMode = false;
  selectedMembers = new Set<string>();
  bulkForm: {
    applyGroup: boolean; groupId: string;
    applyGeneration: boolean; generation: number;
    applyGender: boolean; gender: string;
    applyNotes: boolean; notes: string;
  } = this.emptyBulkForm();

  // layout alignment
  layoutOpts: {
    direction: 'vertical' | 'horizontal';
    spacing:   'compact'  | 'normal' | 'spacious';
    align:     'left'     | 'center';
  } = { direction: 'vertical', spacing: 'normal', align: 'center' };

  // cross-group connect
  crossConnForm = { fromGroupId: '', fromId: '', toGroupId: '', toId: '', type: 'spouse' as RelationshipType };

  // group manager
  groupForm = { name: '' };
  editingGroupId = '';

  // pdf
  pdfOpts: PdfOptions = { ...DEFAULT_PDF_OPTIONS };

  importJson = '';

  // drag / zoom
  dragging: { id: string; ox: number; oy: number } | null = null;
  canvasOffset = { x: 0, y: 0 };
  zoom = 1;

  private sub!: Subscription;

  constructor(
    private svc: FamilyTreeService,
    private pdfSvc: FamilyTreePdfService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.sub = this.svc.tree$.subscribe(t => {
      this.tree = t;
      this.applySearch();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  // ── Helpers ────────────────────────────────────────────────────────────────

  get activeGroup(): FamilyGroup | undefined { return this.svc.getActiveGroup(); }

  /** Members currently shown in the list view — sorted and optionally filtered. */
  get sortedListMembers(): FamilyMember[] {
    const source = this.searchQuery
      ? this.tree.members.filter(m => m.name?.toLowerCase().includes(this.searchQuery.toLowerCase()))
      : [...this.tree.members];
    const { col, dir } = this.listSort;
    return source.sort((a: any, b: any) => {
      let av = a[col] ?? '';
      let bv = b[col] ?? '';
      if (col === 'group') { av = this.getGroup(a.groupId)?.name ?? ''; bv = this.getGroup(b.groupId)?.name ?? ''; }
      if (col === 'spouse') { av = this.getMember(a.spouseId)?.name ?? ''; bv = this.getMember(b.spouseId)?.name ?? ''; }
      if (col === 'parents') { av = a.parentIds?.length ?? 0; bv = b.parentIds?.length ?? 0; }
      if (col === 'children') { av = a.childIds?.length ?? 0; bv = b.childIds?.length ?? 0; }
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
  }

  setListSort(col: string) {
    if (this.listSort.col === col) {
      this.listSort.dir = this.listSort.dir === 1 ? -1 : 1;
    } else {
      this.listSort = { col, dir: 1 };
    }
  }

  jumpToCanvas(m: FamilyMember) {
    this.viewMode = 'canvas';
    // Switch to the member's group first
    this.svc.setActiveGroup(m.groupId);
    // Small delay so canvas renders, then highlight
    setTimeout(() => this.highlightMember(m.id), 100);
  }

  get activeMembers(): FamilyMember[] {
    return this.tree.members.filter(m => m.groupId === this.tree.activeGroupId);
  }

  get canvasWidth(): number {
    if (!this.tree.members.length) return 800;
    const xs = this.tree.members.map(m => m.x);
    return Math.max(800, Math.max(...xs) - Math.min(...xs) + 240);
  }

  get canvasHeight(): number {
    if (!this.tree.members.length) return 500;
    const ys = this.tree.members.map(m => m.y);
    return Math.max(500, Math.max(...ys) - Math.min(...ys) + 160);
  }

  get canvasTranslate(): string {
    const minX = this.tree.members.length ? Math.min(...this.tree.members.map(m => m.x)) : 0;
    const minY = this.tree.members.length ? Math.min(...this.tree.members.map(m => m.y)) : 0;
    return `translate(${-minX + 60 + this.canvasOffset.x}px, ${-minY + 40 + this.canvasOffset.y}px) scale(${this.zoom})`;
  }

  getMember(id: string): FamilyMember | undefined { return this.svc.getMember(id); }
  getGroup(id: string): FamilyGroup | undefined    { return this.svc.getGroup(id); }

  groupColor(groupId: string): string {
    return this.svc.getGroup(groupId)?.color ?? '#6f42c1';
  }

  genderColor(g: string): string {
    return g === 'male' ? '#3b82f6' : g === 'female' ? '#ec4899' : '#8b5cf6';
  }

  genBadgeColor(gen: number): string {
    const colors = ['#6f42c1','#0d6efd','#198754','#fd7e14','#dc3545','#0d9488'];
    return colors[Math.abs(gen) % colors.length];
  }

  isCrossGroupLink(link: FamilyLink): boolean { return !!link.crossGroup; }
  isSpouseLink(link: FamilyLink): boolean      { return link.type === 'spouse'; }

  linkPath(link: FamilyLink): string {
    const from = this.getMember(link.fromId);
    const to   = this.getMember(link.toId);
    if (!from || !to) return '';
    const fw = 160, fh = 90;
    const x1 = from.x + fw / 2, y1 = from.y + fh / 2;
    const x2 = to.x   + fw / 2, y2 = to.y   + fh / 2;
    if (link.type === 'spouse') return `M${x1},${y1} L${x2},${y2}`;
    const my = (y1 + y2) / 2;
    return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
  }

  linkLabelPos(link: FamilyLink): { x: number; y: number } {
    const from = this.getMember(link.fromId);
    const to   = this.getMember(link.toId);
    if (!from || !to) return { x: 0, y: 0 };
    return { x: (from.x + to.x) / 2 + 80, y: (from.y + to.y) / 2 + 45 };
  }

  membersForGroup(groupId: string): FamilyMember[] {
    return this.tree.members.filter(m => m.groupId === groupId);
  }

  groupMinY(groupId: string): number {
    const members = this.membersForGroup(groupId);
    return members.length ? Math.min(...members.map(m => m.y)) : 0;
  }

  // ── Group tabs ─────────────────────────────────────────────────────────────

  switchGroup(id: string) {
    this.svc.setActiveGroup(id);
    this.selectedMember = null;
  }

  // ── Group manager ──────────────────────────────────────────────────────────

  openGroupMgr() { this.groupForm = { name: '' }; this.editingGroupId = ''; this.showGroupMgr = true; }

  createGroup() {
    if (!this.groupForm.name.trim()) return;
    this.svc.createGroup(this.groupForm.name.trim());
    this.groupForm.name = '';
  }

  startRenameGroup(g: FamilyGroup) { this.editingGroupId = g.id; this.groupForm.name = g.name; }

  saveRenameGroup() {
    if (this.editingGroupId && this.groupForm.name.trim()) {
      this.svc.renameGroup(this.editingGroupId, this.groupForm.name.trim());
    }
    this.editingGroupId = ''; this.groupForm.name = '';
  }

  deleteGroup(g: FamilyGroup) {
    if (this.tree.groups.length <= 1) return;
    if (confirm(`Delete group "${g.name}"? All members in this group will be removed.`)) {
      this.svc.deleteGroup(g.id);
    }
  }

  // ── Cross-group connect ────────────────────────────────────────────────────

  openCrossConnect() {
    this.crossConnForm = {
      fromGroupId: this.tree.activeGroupId,
      fromId: this.selectedMember?.id ?? '',
      toGroupId: this.tree.groups.find(g => g.id !== this.tree.activeGroupId)?.id ?? '',
      toId: '',
      type: 'spouse'
    };
    this.showCrossConn = true;
  }

  saveCrossConnect() {
    if (!this.crossConnForm.fromId || !this.crossConnForm.toId) return;
    this.svc.connectMembers(this.crossConnForm.fromId, this.crossConnForm.toId, this.crossConnForm.type, undefined, true);
    this.showCrossConn = false;
  }

  crossConnFromMembers(): FamilyMember[] {
    return this.tree.members.filter(m => m.groupId === this.crossConnForm.fromGroupId);
  }

  crossConnToMembers(): FamilyMember[] {
    return this.tree.members.filter(m => m.groupId === this.crossConnForm.toGroupId);
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  onSearch() { this.applySearch(); }

  private applySearch() {
    this.filteredMembers = this.searchQuery.trim()
      ? this.svc.search(this.searchQuery)
      : this.tree.members;
  }

  highlightMember(id: string) {
    const m = this.svc.getMember(id);
    if (!m) return;
    this.svc.setActiveGroup(m.groupId);
    this.selectedMember = m;
    const minX = Math.min(...this.tree.members.map(x => x.x));
    const minY = Math.min(...this.tree.members.map(x => x.y));
    this.canvasOffset.x = -(m.x - minX);
    this.canvasOffset.y = -(m.y - minY);
    this.searchQuery = '';
  }

  // ── Drag / Zoom ────────────────────────────────────────────────────────────

  onDragStart(e: MouseEvent, id: string) {
    const m = this.getMember(id);
    if (!m) return;
    this.dragging = { id, ox: e.clientX - m.x, oy: e.clientY - m.y };
    e.preventDefault();
  }

  onDragMove(e: MouseEvent) {
    if (!this.dragging) return;
    const m = this.getMember(this.dragging.id);
    if (m) { m.x = e.clientX - this.dragging.ox; m.y = e.clientY - this.dragging.oy; }
  }

  onDragEnd() { if (this.dragging) { this.svc.save(); this.dragging = null; } }

  onWheel(e: WheelEvent) {
    e.preventDefault();
    this.zoom = Math.max(0.3, Math.min(2, this.zoom - e.deltaY * 0.001));
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  openAdd() {
    this.editingMember = null; this.quickAddContext = null;
    this.form = this.emptyForm();
    this.form.groupId = this.tree.activeGroupId;
    if (this.selectedMember) this.form.relatedMemberId = this.selectedMember.id;
    this.showForm = true;
  }

  openAddRelative(member: FamilyMember, rel: RelationshipType) {
    this.editingMember = null;
    this.quickAddContext = { member, rel };
    this.form = this.emptyForm();
    this.form.groupId          = member.groupId;
    this.form.relatedMemberId  = member.id;
    this.form.relationshipType = rel;
    this.form.generation = this.svc.deriveGeneration(member.id, rel);
    this.showForm = true;
  }

  openEdit(m: FamilyMember) {
    this.editingMember = m;
    let hasParents = m.parentIds && m.parentIds.length > 0;
    if (!hasParents && m.spouseId) {
      const spouse = this.svc.getMember(m.spouseId);
      if (spouse && spouse.parentIds && spouse.parentIds.length > 0) {
        hasParents = true;
      }
    }
    this.form = {
      ...m,
      relationshipType: 'child',
      relatedMemberId: '',
      genMode: hasParents ? 'auto' : 'manual'
    };
    this.showForm = true;
  }

  saveForm() {
    if (!this.form.name?.trim()) return;
    if (this.editingMember) {
      // Never change generation when editing — extract it so Object.assign doesn't overwrite it
      const { generation, genMode, relationshipType, relatedMemberId, ...patch } = this.form as any;
      this.svc.updateMember(this.editingMember.id, patch, true);
    } else {
      const nm = this.svc.addMember(this.form);
      if (this.form.relatedMemberId && this.form.relationshipType) {
        // Pass the manually/auto derived generation so connectMembers uses it
        const rel = this.form.relationshipType;
        const isChild = rel === 'child' || rel === 'son' || rel === 'daughter';
        this.svc.connectMembers(
          nm.id,
          this.form.relatedMemberId,
          rel,
          isChild ? this.form.generation : undefined
        );
      }
    }
    this.showForm = false; this.quickAddContext = null;
  }

  confirmDelete(m: FamilyMember) {
    if (confirm(`Delete "${m.name}"? All connections will be removed.`)) {
      this.svc.deleteMember(m.id);
      if (this.selectedMember?.id === m.id) this.selectedMember = null;
    }
  }

  selectMember(m: FamilyMember) {
    if (this.multiSelectMode) {
      if (this.selectedMembers.has(m.id)) {
        this.selectedMembers.delete(m.id);
      } else {
        this.selectedMembers.add(m.id);
      }
    } else {
      this.selectedMember = this.selectedMember?.id === m.id ? null : m;
    }
  }

  toggleMultiSelectMode() {
    this.multiSelectMode = !this.multiSelectMode;
    if (!this.multiSelectMode) {
      this.selectedMembers.clear();
      this.showBulkEdit = false;
    }
  }

  clearSelection() { this.selectedMembers.clear(); }

  openBulkEdit() {
    this.bulkForm = this.emptyBulkForm();
    this.showBulkEdit = true;
  }

  saveBulkEdit() {
    const patch: any = {};
    if (this.bulkForm.applyGroup)      patch.groupId    = this.bulkForm.groupId;
    if (this.bulkForm.applyGeneration) patch.generation = this.bulkForm.generation;
    if (this.bulkForm.applyGender)     patch.gender     = this.bulkForm.gender;
    if (this.bulkForm.applyNotes)      patch.notes      = this.bulkForm.notes;
    if (!Object.keys(patch).length) return;
    for (const id of this.selectedMembers) {
      // preserveGeneration=true so manual generation is not recalculated
      this.svc.updateMember(id, patch, true);
    }
    this.showBulkEdit = false;
    this.selectedMembers.clear();
    this.multiSelectMode = false;
  }

  private emptyBulkForm() {
    return {
      applyGroup: false,      groupId: this.tree.activeGroupId,
      applyGeneration: false, generation: 0,
      applyGender: false,     gender: 'male',
      applyNotes: false,      notes: ''
    };
  }

  // ── Same-group connect ─────────────────────────────────────────────────────

  openConnect() {
    this.connectForm = { fromId: this.selectedMember?.id ?? '', toId: '', type: 'child' };
    this.showConnect = true;
  }

  saveConnect() {
    if (!this.connectForm.fromId || !this.connectForm.toId) return;
    this.svc.connectMembers(this.connectForm.fromId, this.connectForm.toId, this.connectForm.type, undefined, true);
    this.showConnect = false;
  }

  // ── Form helpers ───────────────────────────────────────────────────────────

  onRelationshipFormChange() {
    if (this.form.genMode === 'auto' && this.form.relatedMemberId && this.form.relationshipType) {
      this.form.generation = this.svc.deriveGeneration(this.form.relatedMemberId, this.form.relationshipType);
    }
  }

  onGenerationAutoClick() {
    if (this.editingMember) {
      const derived = this.svc.autoDeriveGeneration(this.editingMember.id);
      this.form.generation = derived !== null ? derived : 0;
    } else {
      this.onRelationshipFormChange();
    }
  }

  resetGenerationToAuto() {
    this.form.genMode = 'auto';
    this.onGenerationAutoClick();
  }

  addCustomField()            { (this.form.customFields = this.form.customFields || []).push({ key: '', value: '' }); }
  removeCustomField(i: number){ this.form.customFields!.splice(i, 1); }

  onPhotoChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { this.form.photo = ev.target?.result as string; this.cdr.markForCheck(); };
    reader.readAsDataURL(file);
  }

  /** Called when the date-of-birth picker changes: recalculate age. */
  onDobChange() {
    if (!this.form.dob) {
      return; // no DOB entered, leave age as-is
    }
    const today = new Date();
    const birth = new Date(this.form.dob as string);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    this.form.age = age >= 0 ? age : null;
    this.cdr.markForCheck();
  }

  /** Called when age is typed directly: clear DOB so they don't conflict. */
  onAgeChange() {
    this.form.dob = null;
  }

  // ── PDF ────────────────────────────────────────────────────────────────────

  async exportPdf() {
    await this.pdfSvc.export(this.tree, this.pdfOpts, this.treeCanvas?.nativeElement ?? null);
    this.showPdfOpts = false;
  }

  // ── Import/Export ──────────────────────────────────────────────────────────

  exportJson() {
    const blob = new Blob([this.svc.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `family-tree-${Date.now()}.json`;
    a.click();
  }

  doImport() { this.svc.importJSON(this.importJson); this.showImport = false; this.importJson = ''; }

  clearAll() { if (confirm('Clear all family data?')) this.svc.clearAll(); }

  onResetAllGenerations() {
    if (confirm('Reset all generations? This will recalculate every member\'s generation based on parent-child relationships (roots = 0, children = parent + 1).')) {
      this.svc.resetAllGenerations();
    }
  }

  applyAlign() {
    this.svc.alignLayout(this.layoutOpts);
    this.canvasOffset = { x: 0, y: 0 };
    this.showLayoutPanel = false;
  }

  private emptyForm(): any {
    return {
      name: '', age: null, dob: null, gender: 'male', photo: null, notes: '',
      generation: 0, customFields: [], relationshipType: 'child', relatedMemberId: '',
      spouseId: null, parentIds: [], childIds: [], siblingIds: [],
      groupId: this.tree.activeGroupId,
      genMode: 'auto'
    };
  }
}
