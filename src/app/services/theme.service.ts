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
    azure:  { name: 'Azure (DevOps)', primary: '#0078d4', primaryDark: '#106ebe', primaryRgb: '0,120,212'   },
    purple: { name: 'Purple',         primary: '#8764b8', primaryDark: '#744da9', primaryRgb: '135,100,184' },
    blue:   { name: 'Blue',           primary: '#0d6efd', primaryDark: '#0a58ca', primaryRgb: '13,110,253'  },
    green:  { name: 'Green',          primary: '#107c10', primaryDark: '#0d6a0d', primaryRgb: '16,124,16'   },
    teal:   { name: 'Teal',           primary: '#038387', primaryDark: '#026a6e', primaryRgb: '3,131,135'   },
    orange: { name: 'Orange',         primary: '#da3b01', primaryDark: '#b83201', primaryRgb: '218,59,1'    },
    red:    { name: 'Red',            primary: '#d13438', primaryDark: '#a4262c', primaryRgb: '209,52,56'   },
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
    return localStorage.getItem('app-theme') || 'azure';
  }

  private applyTheme(themeName: string): void {
    const theme = this.themes[themeName];
    if (!theme) return;
    const root = document.documentElement;
    root.style.setProperty('--snr-primary',            theme.primary);
    root.style.setProperty('--snr-primary-dark',        theme.primaryDark);
    root.style.setProperty('--snr-primary-rgb',         theme.primaryRgb);
    root.style.setProperty('--snr-primary-light',       `rgba(${theme.primaryRgb}, 0.12)`);
    root.style.setProperty('--snr-primary-light-hover', `rgba(${theme.primaryRgb}, 0.18)`);
    // Sidebar derives a dark tint from the primary for gradient consistency
    root.style.setProperty('--snr-sidebar-from', this.darkenHex(theme.primary, 60));
    root.style.setProperty('--snr-sidebar-mid',  this.darkenHex(theme.primary, 45));
    root.style.setProperty('--snr-sidebar-to',   '#0f172a');
  }

  /** Darken a hex color by reducing its lightness by `amount` percent points. */
  private darkenHex(hex: string, lightnessTarget: number): string {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    // Convert RGB → HSL, clamp lightness, convert back
    const rn = r/255, gn = g/255, bn = b/255;
    const max = Math.max(rn,gn,bn), min = Math.min(rn,gn,bn);
    let h=0, s=0, l=(max+min)/2;
    if (max !== min) {
      const d = max-min;
      s = l > 0.5 ? d/(2-max-min) : d/(max+min);
      switch(max){
        case rn: h=((gn-bn)/d+(gn<bn?6:0))/6; break;
        case gn: h=((bn-rn)/d+2)/6; break;
        case bn: h=((rn-gn)/d+4)/6; break;
      }
    }
    l = lightnessTarget/100;
    // HSL → RGB
    const hue2rgb = (p:number,q:number,t:number)=>{
      if(t<0)t+=1; if(t>1)t-=1;
      if(t<1/6)return p+(q-p)*6*t;
      if(t<1/2)return q;
      if(t<2/3)return p+(q-p)*(2/3-t)*6;
      return p;
    };
    let nr:number,ng:number,nb:number;
    if(s===0){ nr=ng=nb=l; } else {
      const q2=l<0.5?l*(1+s):l+s-l*s, p2=2*l-q2;
      nr=hue2rgb(p2,q2,h+1/3);
      ng=hue2rgb(p2,q2,h);
      nb=hue2rgb(p2,q2,h-1/3);
    }
    const toHex=(x:number)=>Math.round(x*255).toString(16).padStart(2,'0');
    return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
  }
}
