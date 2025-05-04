import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AboutComponent } from './pages/about/about.component';
import { PdfSplitterComponent } from './pages/pdf-splitter/pdf-splitter.component';
import { PdfMergerComponent } from './pages/pdf-merger/pdf-merger.component';
import { CrosswordPuzzleComponent } from './pages/crossword-puzzle/crossword-puzzle.component';

const routes: Routes = [
  { path: 'about', component: AboutComponent },
  { path: 'pdf-splitter', component: PdfSplitterComponent },
  { path: 'pdf-merger', component: PdfMergerComponent },  // Add this line
  { path: 'crossword-puzzle', component: CrosswordPuzzleComponent },  // Added
  { path: '', redirectTo: 'about', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
