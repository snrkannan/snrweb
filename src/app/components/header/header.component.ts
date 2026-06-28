import { Component, Input, OnInit, HostListener } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
import { ThemeService, Theme } from '../../services/theme.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  @Input() sidenav!: MatSidenav;

  themes: Theme[] = [];
  themeNames: string[] = [];
  currentTheme = 0;
  themeMenuOpen = false;

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    this.themes = this.themeService.getThemes();
    this.themeNames = this.themeService.getThemeNames();
    this.currentTheme = this.themeNames.indexOf(this.themeService.getCurrentTheme());
  }

  toggleThemeMenu(): void {
    this.themeMenuOpen = !this.themeMenuOpen;
  }

  changeTheme(index: number): void {
    if (this.themeNames[index]) {
      this.themeService.setTheme(this.themeNames[index]);
      this.currentTheme = index;
      this.themeMenuOpen = false;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.snr-navbar')) {
      this.themeMenuOpen = false;
    }
  }
}
