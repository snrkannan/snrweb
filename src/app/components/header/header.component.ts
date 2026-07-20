import { Component, Input, OnInit, HostListener } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
import { ThemeService, Theme } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

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
  userMenuOpen = false;

  constructor(
    private themeService: ThemeService,
    public auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.themes = this.themeService.getThemes();
    this.themeNames = this.themeService.getThemeNames();
    this.currentTheme = this.themeNames.indexOf(this.themeService.getCurrentTheme());
  }

  toggleThemeMenu(): void {
    this.themeMenuOpen = !this.themeMenuOpen;
    this.userMenuOpen = false;
  }

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
    this.themeMenuOpen = false;
  }

  changeTheme(index: number): void {
    if (this.themeNames[index]) {
      this.themeService.setTheme(this.themeNames[index]);
      this.currentTheme = index;
      this.themeMenuOpen = false;
    }
  }

  async signOut(): Promise<void> {
    this.userMenuOpen = false;
    await this.auth.signOut();
    // After sign-out, login is required for the whole app
    this.router.navigate(['/login']);
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.snr-navbar') && !target.closest('.snr-header-dropdown') && !target.closest('.snr-user-dropdown')) {
      this.themeMenuOpen = false;
      this.userMenuOpen = false;
    }
  }
}
