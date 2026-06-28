import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FamilyMember, FamilyLink, FamilyTree, FamilyGroup,
         RelationshipType, Gender, GROUP_COLORS } from './family-tree.models';

const STORAGE_KEY = 'snr_family_tree_v2';
const CARD_W = 160, CARD_H = 90, H_GAP = 40, V_GAP = 80, GROUP_GAP = 120;

@Injectable({ providedIn: 'root' })
export class FamilyTreeService {

  private tree: FamilyTree = { groups: [], members: [], links: [], activeGroupId: '' };
  tree$ = new BehaviorSubject<FamilyTree>(this.tree);

  constructor() { this.load(); }

  // ── Persistence ────────────────────────────────────────────────────────────

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tree));
    this.tree$.next({
      ...this.tree,
      groups:  [...this.tree.groups],
      members: [...this.tree.members],
      links:   [...this.tree.links]
    });
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.tree = JSON.parse(raw);
        // migrate old data without groups
        if (!this.tree.groups) {
          const g = this.makeGroup('My Family');
          this.tree.groups = [g];
          this.tree.activeGroupId = g.id;
          this.tree.members.forEach(m => m.groupId = m.groupId || g.id);
        }
        this.layoutAll();
      } else {
        this.seedDemo();
      }
    } catch { this.seedDemo(); }
    this.tree$.next(this.tree);
  }

  // ── Seed demo ──────────────────────────────────────────────────────────────

  private seedDemo() {
    const g1 = this.makeGroup('Smith Family');
    const g2 = this.makeGroup('Jones Family');
    this.tree.groups = [g1, g2];
    this.tree.activeGroupId = g1.id;

    // Group 1
    const gf = this.makeMember('George Sr.', 72, 'male', -1, g1.id);
    const gm = this.makeMember('Margaret',   70, 'female', -1, g1.id);
    const fa = this.makeMember('Robert',     48, 'male',    0, g1.id);
    const mo = this.makeMember('Susan',      46, 'female',  0, g1.id);
    const s1 = this.makeMember('James',      22, 'male',    1, g1.id);

    gf.spouseId = gm.id; gm.spouseId = gf.id;
    fa.parentIds = [gf.id, gm.id]; gf.childIds.push(fa.id); gm.childIds.push(fa.id);
    fa.spouseId = mo.id; mo.spouseId = fa.id;
    s1.parentIds = [fa.id, mo.id]; fa.childIds.push(s1.id); mo.childIds.push(s1.id);

    // Group 2
    const j1 = this.makeMember('William',   74, 'male',   -1, g2.id);
    const j2 = this.makeMember('Elizabeth', 71, 'female', -1, g2.id);
    const j3 = this.makeMember('Emily',     45, 'female',  0, g2.id);

    j1.spouseId = j2.id; j2.spouseId = j1.id;
    j3.parentIds = [j1.id, j2.id]; j1.childIds.push(j3.id); j2.childIds.push(j3.id);

    this.tree.members = [gf, gm, fa, mo, s1, j1, j2, j3];
    this.buildLinks();
    this.layoutAll();
    this.save();
  }

  private makeGroup(name: string): FamilyGroup {
    const idx = this.tree.groups?.length ?? 0;
    return { id: this.uid(), name, color: GROUP_COLORS[idx % GROUP_COLORS.length] };
  }

  private makeMember(name: string, age: number | null, gender: Gender, generation: number, groupId: string): FamilyMember {
    return {
      id: this.uid(), groupId, name, age, gender, photo: null, notes: '',
      customFields: [], generation,
      spouseId: null, parentIds: [], childIds: [], siblingIds: [],
      x: 0, y: 0
    };
  }

  // ── Group management ───────────────────────────────────────────────────────

  createGroup(name: string): FamilyGroup {
    const g = this.makeGroup(name);
    this.tree.groups.push(g);
    this.tree.activeGroupId = g.id;
    this.save();
    return g;
  }

  renameGroup(id: string, name: string) {
    const g = this.tree.groups.find(g => g.id === id);
    if (g) { g.name = name; this.save(); }
  }

  deleteGroup(id: string) {
    if (this.tree.groups.length <= 1) return; // keep at least one
    this.tree.members = this.tree.members.filter(m => m.groupId !== id);
    this.tree.links   = this.tree.links.filter(l => {
      const from = this.getMember(l.fromId);
      const to   = this.getMember(l.toId);
      return from && to; // remove links to deleted members
    });
    this.tree.groups  = this.tree.groups.filter(g => g.id !== id);
    if (this.tree.activeGroupId === id) this.tree.activeGroupId = this.tree.groups[0].id;
    this.layoutAll();
    this.save();
  }

  setActiveGroup(id: string) {
    this.tree.activeGroupId = id;
    this.save();
  }

  getActiveGroup(): FamilyGroup | undefined {
    return this.tree.groups.find(g => g.id === this.tree.activeGroupId);
  }

  getGroup(id: string): FamilyGroup | undefined {
    return this.tree.groups.find(g => g.id === id);
  }

  getMembersInGroup(groupId: string): FamilyMember[] {
    return this.tree.members.filter(m => m.groupId === groupId);
  }

  // Move a member from one group to another
  moveMemberToGroup(memberId: string, targetGroupId: string) {
    const m = this.getMember(memberId);
    if (m) { m.groupId = targetGroupId; this.layoutAll(); this.save(); }
  }

  // ── Links ──────────────────────────────────────────────────────────────────

  private buildLinks() {
    this.tree.links = [];
    const seen = new Set<string>();
    for (const m of this.tree.members) {
      if (m.spouseId) {
        const key = [m.id, m.spouseId].sort().join('-');
        if (!seen.has(key)) {
          seen.add(key);
          const crossGroup = this.getMember(m.spouseId)?.groupId !== m.groupId;
          this.tree.links.push({ id: this.uid(), fromId: m.id, toId: m.spouseId, type: 'spouse', crossGroup });
        }
      }
      for (const pid of m.parentIds) {
        const parent = this.getMember(pid);
        if (!parent) continue;
        const type: RelationshipType = parent.gender === 'female' ? 'mother' : 'father';
        const key = `${pid}->${m.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          const crossGroup = parent.groupId !== m.groupId;
          this.tree.links.push({ id: this.uid(), fromId: pid, toId: m.id, type, crossGroup });
        }
      }
    }
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  addMember(data: Partial<FamilyMember>): FamilyMember {
    const m: FamilyMember = {
      id: this.uid(),
      groupId: data.groupId || this.tree.activeGroupId,
      name: data.name || 'New Member',
      age: data.age ?? null,
      gender: data.gender || 'male',
      photo: data.photo || null,
      notes: data.notes || '',
      customFields: data.customFields || [],
      generation: data.generation ?? 0,
      spouseId: null, parentIds: [], childIds: [], siblingIds: [],
      x: 0, y: 0
    };
    this.tree.members.push(m);
    this.applyRelationships(m, data);
    this.buildLinks();
    this.layoutAll();
    this.save();
    return m;
  }

  updateMember(id: string, data: Partial<FamilyMember>) {
    const m = this.getMember(id);
    if (!m) return;
    Object.assign(m, data);
    this.buildLinks();
    this.layoutAll();
    this.save();
  }

  deleteMember(id: string) {
    for (const m of this.tree.members) {
      if (m.spouseId  === id) m.spouseId = null;
      m.parentIds  = m.parentIds.filter(x => x !== id);
      m.childIds   = m.childIds.filter(x => x !== id);
      m.siblingIds = m.siblingIds.filter(x => x !== id);
    }
    this.tree.members = this.tree.members.filter(m => m.id !== id);
    this.tree.links   = this.tree.links.filter(l => l.fromId !== id && l.toId !== id);
    this.layoutAll();
    this.save();
  }

  connectMembers(fromId: string, toId: string, type: RelationshipType, childGen?: number) {
    const from = this.getMember(fromId);
    const to   = this.getMember(toId);
    if (!from || !to) return;

    switch (type) {
      case 'spouse':
        from.spouseId = toId; to.spouseId = fromId;
        to.generation = from.generation;
        break;
      case 'father': case 'mother':
        if (!to.parentIds.includes(fromId)) to.parentIds.push(fromId);
        if (!from.childIds.includes(toId))  from.childIds.push(toId);
        // parent is always one generation above the child
        from.generation = to.generation - 1;
        if (from.spouseId) {
          const spouse = this.getMember(from.spouseId);
          if (spouse) {
            spouse.generation = from.generation;
            if (!to.parentIds.includes(from.spouseId)) to.parentIds.push(from.spouseId);
            if (!spouse.childIds.includes(toId)) spouse.childIds.push(toId);
          }
        }
        break;
      case 'son': case 'daughter': case 'child':
        if (!from.childIds.includes(toId))  from.childIds.push(toId);
        if (!to.parentIds.includes(fromId)) to.parentIds.push(fromId);
        // use provided generation if given, otherwise derive from parent
        to.generation = childGen !== undefined ? childGen : from.generation + 1;
        if (from.spouseId) {
          const spouse = this.getMember(from.spouseId);
          if (spouse) {
            if (!to.parentIds.includes(from.spouseId)) to.parentIds.push(from.spouseId);
            if (!spouse.childIds.includes(toId)) spouse.childIds.push(toId);
          }
        }
        break;
      case 'grandfather': case 'grandmother':
        from.generation = to.generation - 2;
        if (from.spouseId) {
          const spouse = this.getMember(from.spouseId);
          if (spouse) spouse.generation = from.generation;
        }
        if (!to.parentIds.some(pid => this.getMember(pid)?.parentIds.includes(fromId))) {
          from.childIds.push(this.ensureParentBridge(from, to));
        }
        break;
      case 'brother': case 'sister':
        if (!from.siblingIds.includes(toId)) from.siblingIds.push(toId);
        if (!to.siblingIds.includes(fromId)) to.siblingIds.push(fromId);
        to.generation = from.generation;
        break;
    }

    // Cascade: recalculate all descendants' generations based on their parents
    this.recalcDescendants();
    this.buildLinks();
    this.layoutAll();
    this.save();
  }

  // Recalculates generation for every member that has parents, bottom-up BFS
  private recalcDescendants() {
    const visited = new Set<string>();
    const queue: string[] = [];

    // Start from members with no parents (roots)
    for (const m of this.tree.members) {
      if (m.parentIds.length === 0) queue.push(m.id);
    }

    while (queue.length) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const m = this.getMember(id);
      if (!m) continue;

      // Update generation based on parents
      if (m.parentIds.length > 0) {
        const parentGens = m.parentIds
          .map(pid => this.getMember(pid)?.generation)
          .filter((g): g is number => g !== undefined);
        if (parentGens.length > 0) {
          m.generation = Math.max(...parentGens) + 1;
        }
      }

      // Sync spouse generation
      if (m.spouseId) {
        const spouse = this.getMember(m.spouseId);
        if (spouse && spouse.parentIds.length === 0) {
          spouse.generation = m.generation;
        }
      }

      // Enqueue children
      for (const cid of m.childIds) {
        if (!visited.has(cid)) queue.push(cid);
      }
    }
  }

  private ensureParentBridge(gp: FamilyMember, gc: FamilyMember): string {
    for (const cid of gp.childIds) {
      const c = this.getMember(cid);
      if (c && gc.parentIds.includes(cid)) return cid;
    }
    const bridge = this.makeMember('(Unknown)', null, 'male', gp.generation + 1, gp.groupId);
    this.tree.members.push(bridge);
    bridge.parentIds.push(gp.id);
    bridge.childIds.push(gc.id);
    gc.parentIds.push(bridge.id);
    return bridge.id;
  }

  private applyRelationships(m: FamilyMember, data: Partial<FamilyMember>) {
    if (data.spouseId) {
      m.spouseId = data.spouseId;
      const sp = this.getMember(data.spouseId);
      if (sp) sp.spouseId = m.id;
    }
    if (data.parentIds?.length) {
      m.parentIds = data.parentIds;
      for (const pid of data.parentIds) {
        const p = this.getMember(pid);
        if (p && !p.childIds.includes(m.id)) p.childIds.push(m.id);
      }
    }
    if (data.childIds?.length) {
      m.childIds = data.childIds;
      for (const cid of data.childIds) {
        const c = this.getMember(cid);
        if (c && !c.parentIds.includes(m.id)) c.parentIds.push(m.id);
      }
    }
  }

  // ── Layout ─────────────────────────────────────────────────────────────────

  layoutAll() {
    if (!this.tree.members.length) return;

    let xOffset = 0;
    for (const group of this.tree.groups) {
      const members = this.getMembersInGroup(group.id);
      if (!members.length) continue;
      const groupWidth = this.layoutGroup(members, xOffset);
      xOffset += groupWidth + GROUP_GAP;
    }
  }

  private layoutGroup(members: FamilyMember[], xOffset: number): number {
    const gens = new Map<number, FamilyMember[]>();
    for (const m of members) {
      if (!gens.has(m.generation)) gens.set(m.generation, []);
      gens.get(m.generation)!.push(m);
    }

    // Sort ascending so lowest generation (oldest ancestors) → top, highest (newest) → bottom
    const sortedGens = Array.from(gens.keys()).sort((a, b) => a - b);
    let maxWidth = 0;

    sortedGens.forEach((gen, rowIndex) => {
      const row = gens.get(gen)!;
      const ordered = this.orderRowBySpouse(row);
      const rowWidth = ordered.length * (CARD_W + H_GAP) - H_GAP;
      maxWidth = Math.max(maxWidth, rowWidth);

      ordered.forEach((m, ci) => {
        m.x = xOffset + ci * (CARD_W + H_GAP);
        m.y = rowIndex * (CARD_H + V_GAP);  // rowIndex 0 = top, increases downward
      });
    });

    return maxWidth;
  }

  private orderRowBySpouse(row: FamilyMember[]): FamilyMember[] {
    const result: FamilyMember[] = [];
    const visited = new Set<string>();
    for (const m of row) {
      if (visited.has(m.id)) continue;
      result.push(m); visited.add(m.id);
      if (m.spouseId) {
        const sp = row.find(r => r.id === m.spouseId);
        if (sp && !visited.has(sp.id)) { result.push(sp); visited.add(sp.id); }
      }
    }
    return result;
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  getMember(id: string): FamilyMember | undefined {
    return this.tree.members.find(m => m.id === id);
  }

  deriveGeneration(relatedId: string, rel: RelationshipType): number {
    const related = this.getMember(relatedId);
    if (!related) return 0;
    switch (rel) {
      case 'son': case 'daughter': case 'child':          return related.generation + 1;
      case 'father': case 'mother':                       return related.generation - 1;
      case 'grandfather': case 'grandmother':             return related.generation - 2;
      case 'spouse': case 'brother': case 'sister':       return related.generation;
      default: return related.generation;
    }
  }

  search(query: string): FamilyMember[] {
    const q = query.toLowerCase();
    return this.tree.members.filter(m =>
      m.name.toLowerCase().includes(q) || String(m.generation).includes(q));
  }

  exportJSON(): string { return JSON.stringify(this.tree, null, 2); }

  importJSON(json: string) {
    try { this.tree = JSON.parse(json); this.layoutAll(); this.save(); }
    catch (e) { console.error('Import failed', e); }
  }

  clearAll() {
    const g = this.makeGroup('My Family');
    this.tree = { groups: [g], members: [], links: [], activeGroupId: g.id };
    this.save();
  }

  private uid(): string { return Math.random().toString(36).slice(2, 10); }
}
