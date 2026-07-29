import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { FamilyMember, FamilyTree, FamilyLink, FamilyGroup,
         RelationshipType, RELATIONSHIP_TYPES, PdfOptions, DEFAULT_PDF_OPTIONS } from './family-tree.models';
import { FamilyTreeService } from './family-tree.service';
import { FamilyTreePdfService } from './family-tree-pdf.service';

/** One SVG path segment produced by the comb renderer. */
interface SvgPath {
  d: string;
  isSpouse: boolean;
  isCross: boolean;
  hasArrow: boolean;
  color: string;
  label: string;
  /** Unique key for this path (link id or synthetic key for comb branches). */
  pathKey: string;
  /** IDs of the two members this path visually connects. */
  fromId: string;
  toId: string;
}

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

  // ── Line selection (canvas) ─────────────────────────────────────────────────
  /** Key of the currently-clicked SVG path, or null. */
  selectedPathKey: string | null = null;
  /** IDs of members that should be highlighted because of the selected line. */
  highlightedMemberIds: Set<string> = new Set();

  // ── Row selection (list view) ────────────────────────────────────────────────
  /** ID of the member whose list row was last clicked. */
  selectedListMemberId: string | null = null;

  /** The selected member + all directly-connected members (for list highlight). */
  get listHighlightedIds(): Set<string> {
    if (!this.selectedListMemberId) return new Set();
    const m = this.getMember(this.selectedListMemberId);
    if (!m) return new Set();
    const ids = new Set<string>();
    // spouse
    if (m.spouseId) ids.add(m.spouseId);
    // parents
    (m.parentIds ?? []).forEach(id => ids.add(id));
    // children
    (m.childIds ?? []).forEach(id => ids.add(id));
    // siblings
    (m.siblingIds ?? []).forEach(id => ids.add(id));
    return ids;
  }

  /** Selects a list row (toggle). */
  selectListRow(m: FamilyMember, event: MouseEvent) {
    // don't trigger when clicking action buttons
    if ((event.target as HTMLElement).closest('.ft-list-actions-cell')) return;
    this.selectedListMemberId = this.selectedListMemberId === m.id ? null : m.id;
  }

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
  groupForm = { name: '', color: '' };
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

  /** Returns the group color for a link — drives the SVG stroke coloring. */
  linkGroupColor(link: FamilyLink): string {
    const from = this.getMember(link.fromId);
    return from ? this.groupColor(from.groupId) : '#94a3b8';
  }

  /** Updates a group's accent color live. */
  changeGroupColor(groupId: string, color: string) {
    this.svc.changeGroupColor(groupId, color);
  }

  /** Returns a random vibrant color from an extended palette. */
  randomGroupColor(): string {
    const palette = [
      '#6f42c1','#0d6efd','#198754','#0d9488','#fd7e14','#dc3545',
      '#e91e63','#795548','#00897b','#3949ab','#f57c00','#c62828',
      '#ad1457','#00838f','#558b2f','#6d4c41','#5e35b1','#1565c0'
    ];
    return palette[Math.floor(Math.random() * palette.length)];
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

    const CW = 200, CH = 120;
    const fromCx = from.x + CW / 2;
    const fromCy = from.y + CH / 2;
    const toCx   = to.x   + CW / 2;
    const toCy   = to.y   + CH / 2;
    const dx = toCx - fromCx;
    const dy = toCy - fromCy;

    // ── Spouse: smooth S-curve between side edges (handles height diff) ───────
    if (link.type === 'spouse') {
      const [x1, y1, x2, y2] = from.x <= to.x
        ? [from.x + CW, fromCy, to.x, toCy]
        : [from.x, fromCy, to.x + CW, toCy];
      const mx = (x1 + x2) / 2;
      // S-curve: first CP pulls horizontally from x1, second from x2
      return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
    }

    // ── Parent-child: tension bezier from card edge to card edge ─────────────
    let x1: number, y1: number, x2: number, y2: number;
    let cpx1: number, cpy1: number, cpx2: number, cpy2: number;

    // Choose exit/entry edges based on dominant axis
    if (Math.abs(dy) >= Math.abs(dx)) {
      if (dy >= 0) {
        x1 = fromCx;  y1 = from.y + CH;   // bottom of parent
        x2 = toCx;    y2 = to.y;           // top of child
      } else {
        x1 = fromCx;  y1 = from.y;         // top of parent
        x2 = toCx;    y2 = to.y + CH;      // bottom of child
      }
      // Pull control points proportionally along Y (tension = half the gap)
      const tension = Math.min(Math.abs(y2 - y1) * 0.45, 90);
      const sign = dy >= 0 ? 1 : -1;
      cpx1 = x1; cpy1 = y1 + sign * tension;
      cpx2 = x2; cpy2 = y2 - sign * tension;
    } else {
      if (dx >= 0) {
        x1 = from.x + CW;  y1 = fromCy;   // right of parent
        x2 = to.x;          y2 = toCy;     // left of child
      } else {
        x1 = from.x;        y1 = fromCy;   // left of parent
        x2 = to.x + CW;     y2 = toCy;     // right of child
      }
      const tension = Math.min(Math.abs(x2 - x1) * 0.45, 90);
      const sign = dx >= 0 ? 1 : -1;
      cpx1 = x1 + sign * tension; cpy1 = y1;
      cpx2 = x2 - sign * tension; cpy2 = y2;
    }

    return `M${x1},${y1} C${cpx1},${cpy1} ${cpx2},${cpy2} ${x2},${y2}`;
  }

  linkLabelPos(link: FamilyLink): { x: number; y: number } {
    const from = this.getMember(link.fromId);
    const to   = this.getMember(link.toId);
    if (!from || !to) return { x: 0, y: 0 };
    const CW = 200, CH = 120;
    return {
      x: (from.x + to.x) / 2 + CW / 2,
      y: (from.y + to.y) / 2 + CH / 2
    };
  }

  // ── Genealogy comb renderer ────────────────────────────────────────────────
  //
  // Instead of two separate lines (father→child, mother→child) we draw:
  //   1. The spouse line   (unchanged)
  //   2. A vertical TRUNK  from the midpoint of the spouse line down to a
  //      junction row
  //   3. A horizontal BAR  at the junction spanning all shared children
  //   4. Vertical DROPS    from the bar down to each child's top edge
  //
  // Father→child and mother→child links that are absorbed into a comb are
  // suppressed so they don't render on top of the comb.

  get svgPaths(): SvgPath[] {
    const CW = 200, CH = 120;
    const paths: SvgPath[] = [];
    const absorbedIds = new Set<string>();

    // ── Step 1: parent-link lookup per child ──────────────────────────────────
    const parentLinksOf = new Map<string, FamilyLink[]>();
    for (const lnk of this.tree.links) {
      if (lnk.type === 'spouse') continue;
      const arr = parentLinksOf.get(lnk.toId) ?? [];
      arr.push(lnk);
      parentLinksOf.set(lnk.toId, arr);
    }

    // ── Step 2: spouse pairs — draw comb with smooth beziers ─────────────────
    for (const sLink of this.tree.links.filter(l => l.type === 'spouse')) {
      const p1 = this.getMember(sLink.fromId);
      const p2 = this.getMember(sLink.toId);
      if (!p1 || !p2) continue;

      const sharedIds = p1.childIds.filter(id => p2.childIds.includes(id));
      if (!sharedIds.length) continue;

      const children = sharedIds.map(id => this.getMember(id)).filter(Boolean) as FamilyMember[];

      // Midpoint of the spouse connector line (side-edge based)
      const left  = p1.x <= p2.x ? p1 : p2;
      const right = p1.x <= p2.x ? p2 : p1;
      const sx1 = left.x + CW,  sy1 = left.y  + CH / 2;
      const sx2 = right.x,       sy2 = right.y + CH / 2;
      const midX = (sx1 + sx2) / 2;
      const midY = (sy1 + sy2) / 2;

      const color   = this.groupColor(p1.groupId);
      const isCross = !!sLink.crossGroup;

      // One smooth bezier per child: starts at couple midpoint, curves to child top
      for (const child of children) {
        const cx       = child.x + CW / 2;   // child top-center X
        const childTop = child.y;             // child top Y

        // Control points create a smooth "drain" shape:
        //   CP1 = directly below midpoint (push down first)
        //   CP2 = directly above the child top-center (arrive from above)
        const dy      = childTop - midY;
        const tension = Math.min(Math.abs(dy) * 0.45, 90);
        const cp1x = midX,  cp1y = midY + tension;
        const cp2x = cx,    cp2y = childTop - tension;

        // The comb branch represents p1 (or p2) → child; use a synthetic key
        const pathKey = `comb-${sLink.id}-${child.id}`;
        paths.push({
          d: `M${midX},${midY} C${cp1x},${cp1y} ${cp2x},${cp2y} ${cx},${childTop}`,
          isSpouse: false, isCross, hasArrow: true, color, label: 'child',
          pathKey,
          fromId: p1.id,   // parent 1 (the "from" of the spouse link)
          toId: child.id
        });

        // Absorb individual parent→child links for this couple
        for (const pl of parentLinksOf.get(child.id) ?? []) {
          if (pl.fromId === p1.id || pl.fromId === p2.id) {
            absorbedIds.add(pl.id);
          }
        }
      }
    }

    // ── Step 3: remaining links (single-parent, cross-group, etc.) ─────────────
    for (const lnk of this.tree.links) {
      if (absorbedIds.has(lnk.id)) continue;
      paths.push({
        d: this.linkPath(lnk),
        isSpouse: lnk.type === 'spouse',
        isCross:  !!lnk.crossGroup,
        hasArrow: lnk.type !== 'spouse',
        color: this.linkGroupColor(lnk),
        label: lnk.type !== 'spouse' ? lnk.type : '',
        pathKey: lnk.id,
        fromId: lnk.fromId,
        toId: lnk.toId
      });
    }

    return paths;
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

  openGroupMgr() { this.groupForm = { name: '', color: this.randomGroupColor() }; this.editingGroupId = ''; this.showGroupMgr = true; }

  createGroup() {
    if (!this.groupForm.name.trim()) return;
    this.svc.createGroup(this.groupForm.name.trim(), this.groupForm.color);
    this.groupForm.name = '';
    this.groupForm.color = this.randomGroupColor();
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

  onDragEnd() {
    if (this.dragging) {
      this.tree.layoutMode = 'custom';
      this.svc.resolveOverlapsAndSave();
      this.dragging = null;
    }
  }

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
    this.editConnectForm = { toId: '', type: 'child' };
    this.showForm = true;
  }

  editConnectForm = { toId: '', type: 'child' as RelationshipType };

  get availableMembersForEditConnect(): FamilyMember[] {
    if (!this.editingMember) return [];
    const connectedIds = new Set<string>([
      this.editingMember.id,
      this.editingMember.spouseId || '',
      ...(this.editingMember.parentIds ?? []),
      ...(this.editingMember.childIds ?? []),
      ...(this.editingMember.siblingIds ?? [])
    ]);
    return this.tree.members.filter(m => !connectedIds.has(m.id));
  }

  connectExistingInEdit() {
    if (!this.editingMember || !this.editConnectForm.toId) return;
    this.svc.connectMembers(this.editingMember.id, this.editConnectForm.toId, this.editConnectForm.type, undefined, true);
    
    const updated = this.getMember(this.editingMember.id);
    if (updated) {
      this.editingMember = updated;
      this.form = {
        ...updated,
        relationshipType: 'child',
        relatedMemberId: '',
        genMode: (updated.parentIds && updated.parentIds.length > 0) ? 'auto' : 'manual'
      };
    }
    this.editConnectForm.toId = '';
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
    // Clicking a card clears any active line selection
    this.clearLinkSelection();
  }

  /** Called when a connecting line is clicked. Highlights the line and its two endpoint members. */
  selectLink(path: SvgPath, event: MouseEvent) {
    event.stopPropagation();
    if (this.selectedPathKey === path.pathKey) {
      // Toggle off
      this.clearLinkSelection();
    } else {
      this.selectedPathKey = path.pathKey;
      this.highlightedMemberIds = new Set([path.fromId, path.toId]);
      // Also deselect the single-member selection
      this.selectedMember = null;
    }
  }

  /** Clears the line selection state. */
  clearLinkSelection() {
    this.selectedPathKey = null;
    this.highlightedMemberIds = new Set();
  }

  get selectedLinkFrom(): FamilyMember | undefined {
    if (!this.selectedPathKey) return undefined;
    const path = this.svgPaths.find(p => p.pathKey === this.selectedPathKey);
    return path ? this.getMember(path.fromId) : undefined;
  }

  get selectedLinkTo(): FamilyMember | undefined {
    if (!this.selectedPathKey) return undefined;
    const path = this.svgPaths.find(p => p.pathKey === this.selectedPathKey);
    return path ? this.getMember(path.toId) : undefined;
  }

  get selectedLinkPos(): { x: number; y: number } {
    if (!this.selectedPathKey) return { x: 0, y: 0 };
    const path = this.svgPaths.find(p => p.pathKey === this.selectedPathKey);
    if (!path) return { x: 0, y: 0 };
    const from = this.getMember(path.fromId);
    const to = this.getMember(path.toId);
    if (!from || !to) return { x: 0, y: 0 };
    const CW = 200, CH = 120;
    return {
      x: (from.x + to.x) / 2 + CW / 2,
      y: (from.y + to.y) / 2 + CH / 2
    };
  }

  disconnectRelation(id1: string, id2: string) {
    const m1 = this.getMember(id1);
    const m2 = this.getMember(id2);
    if (!m1 || !m2) return;
    if (confirm(`Are you sure you want to sever the connection between ${m1.name} and ${m2.name}?`)) {
      this.svc.disconnectRelation(id1, id2);
      this.clearLinkSelection();
      if (this.editingMember && (this.editingMember.id === id1 || this.editingMember.id === id2)) {
        const updated = this.getMember(this.editingMember.id);
        if (updated) {
          this.editingMember = updated;
          this.form = {
            ...updated,
            relationshipType: 'child',
            relatedMemberId: '',
            genMode: (updated.parentIds && updated.parentIds.length > 0) ? 'auto' : 'manual'
          };
        }
      }
    }
  }

  disconnectSelectedLink(event: MouseEvent) {
    event.stopPropagation();
    const from = this.selectedLinkFrom;
    const to = this.selectedLinkTo;
    if (from && to) {
      this.disconnectRelation(from.id, to.id);
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
