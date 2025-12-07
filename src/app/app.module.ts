import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

// Material Modules
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';

// Components
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { SidenavComponent } from './components/sidenav/sidenav.component';
import { LayoutComponent } from './components/layout/layout.component';
import { AboutComponent } from './pages/about/about.component';
import { PdfSplitterComponent } from './pages/pdf-splitter/pdf-splitter.component';
import { FormsModule } from '@angular/forms';
import { PdfMergerComponent } from './pages/pdf-merger/pdf-merger.component';
import { MatExpansionModule } from '@angular/material/expansion';
import { CrosswordPuzzleComponent } from './pages/crossword-puzzle/crossword-puzzle.component';
import { DateConverterComponent } from './pages/date-converter/date-converter.component';
import { ExpenseTrackerComponent } from './pages/expense-tracker/expense-tracker.component';
import { FolderTreeComponent } from './pages/folder-tree/folder-tree.component';
import { CdkTreeModule } from '@angular/cdk/tree';
import { MatTreeModule } from '@angular/material/tree';
import { FileSizePipe } from './file-size.pipe';
import { FileExplorerComponent } from './pages/file-explorer/file-explorer.component';
import { ColorActionComponent } from './components/color-action/color-action.component';
import { CursiveWriteComponent } from './components/cursive-write/cursive-write.component';

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    FooterComponent,
    SidenavComponent,
    LayoutComponent,
    AboutComponent, 
    PdfSplitterComponent,
    PdfMergerComponent,
    CrosswordPuzzleComponent,
    DateConverterComponent,
    ExpenseTrackerComponent,
    FolderTreeComponent,
    FileSizePipe,
    FileExplorerComponent,
    ColorActionComponent,
    CursiveWriteComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    FormsModule,
    MatToolbarModule,
    MatIconModule,
    MatSidenavModule,
    MatListModule,
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
    CdkTreeModule,
     MatTreeModule,
     MatTreeModule,
    MatIconModule,
    MatButtonModule,
    MatToolbarModule,
       ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
