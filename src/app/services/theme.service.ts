import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Theme {
  name: string;
  primary: string;
  primaryDark: string;
  primaryRgb: string;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private themes: { [key: string]: Theme } = {
    purple: { name: 'Purple', primary: '#6f42c1', primaryDark: '#5a32a3', primaryRgb: '111,66,193'  },
    blue:   { name: 'Blue',   primary: '#0d6efd', primaryDark: '#0a58ca', primaryRgb: '13,110,253'  },
    green:  { name: 'Green',  primary: '#198754', primaryDark: '#146c43', primaryRgb: '25,135,84'   },
    teal:   { name: 'Teal',   primary: '#0d9488', primaryDark: '#0a7a70', primaryRgb: '13,148,136'  },
    orange: { name: 'Orange', primary: '#fd7e14', primaryDark: '#dc6a0a', primaryRgb: '253,126,20'  },
    red:    { name: 'Red',    primary: '#dc3545', primaryDark: '#b02a37', primaryRgb: '220,53,69'   },
  };

  private currentThemeSubject = new BehaviorSubject<string>(this.getStoredTheme());
  public currentTheme$: Observable<string> = this.currentThemeSubject.asObservable();

  constructor() {
    this.applyTheme(this.currentThemeSubject.value);
  }

  getThemes(): Theme[] { return Object.values(this.themes); }
  getThemeNames(): string[] { return Object.keys(this.themes); }
  getCurrentTheme(): string { return this.currentThemeSubject.value; }

  setTheme(themeName: string): void {
    if (this.themes[themeName]) {
      this.currentThemeSubject.next(themeName);
      localStorage.setItem('app-theme', themeName);
      this.applyTheme(themeName);
    }
  }

  private getStoredTheme(): string {
    return localStorage.getItem('app-theme') || 'purple';
  }

  private applyTheme(themeName: string): void {
    const theme = this.themes[themeName];
    if (!theme) return;
    const root = document.documentElement;
    root.style.setProperty('--snr-primary',       theme.primary);
    root.style.setProperty('--snr-primary-dark',   theme.primaryDark);
    root.style.setProperty('--snr-primary-rgb',    theme.primaryRgb);
    root.style.setProperty('--snr-primary-light',  `rgba(${theme.primaryRgb}, 0.12)`);
  }
}
