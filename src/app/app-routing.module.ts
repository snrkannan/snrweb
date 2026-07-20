import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AboutComponent } from './pages/about/about.component';
import { PdfSplitterComponent } from './pages/pdf-splitter/pdf-splitter.component';
import { PdfMergerComponent } from './pages/pdf-merger/pdf-merger.component';
import { CrosswordPuzzleComponent } from './pages/crossword-puzzle/crossword-puzzle.component';
import { DateConverterComponent } from './pages/date-converter/date-converter.component';
import { CursiveWriteComponent } from './components/cursive-write/cursive-write.component';
import { SudokuComponent } from './components/sudoku/sudoku.component';
import { FamilyTreeComponent } from './pages/family-tree/family-tree.component';
import { KidsPlannerComponent } from './pages/kids-planner/kids-planner.component';
import { LoginComponent } from './pages/login/login.component';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  // ── Public ────────────────────────────────────────────────────────────────
  { path: 'login', component: LoginComponent },

  // ── Protected (whole app requires login) ──────────────────────────────────
  { path: 'about',            component: AboutComponent,           canActivate: [AuthGuard] },
  { path: 'pdf-splitter',     component: PdfSplitterComponent,     canActivate: [AuthGuard] },
  { path: 'pdf-merger',       component: PdfMergerComponent,       canActivate: [AuthGuard] },
  { path: 'cursive-write',    component: CursiveWriteComponent,    canActivate: [AuthGuard] },
  { path: 'crossword-puzzle', component: CrosswordPuzzleComponent, canActivate: [AuthGuard] },
  { path: 'sudoku',           component: SudokuComponent,          canActivate: [AuthGuard] },
  { path: 'date-Converter',   component: DateConverterComponent,   canActivate: [AuthGuard] },
  { path: 'family-tree',      component: FamilyTreeComponent,      canActivate: [AuthGuard] },
  { path: 'kids-planner',     component: KidsPlannerComponent,     canActivate: [AuthGuard] },

  { path: '', redirectTo: 'about', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
