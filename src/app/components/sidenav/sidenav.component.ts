import { Component, Input, ViewChildren, QueryList } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
import { MatExpansionPanel } from '@angular/material/expansion';

@Component({
  selector: 'app-sidenav',
  templateUrl: './sidenav.component.html',
  styleUrls: ['./sidenav.component.scss']
})
export class SidenavComponent {
  @Input() sidenav: MatSidenav | undefined;
  @ViewChildren(MatExpansionPanel) expansionPanels!: QueryList<MatExpansionPanel>;

  closeMenu() {
    if (this.sidenav && !this.sidenav.disableClose) {
      this.sidenav.close();
    }
  }

  onPanelOpened(openedPanel: MatExpansionPanel) {
    // Close all other panels when one opens
    this.expansionPanels.forEach(panel => {
      if (panel !== openedPanel) {
        panel.close();
      }
    });
  }
}
