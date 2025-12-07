import { Component } from '@angular/core';

declare const window: any;

@Component({
  selector: 'app-color-action',
  template: `
    <button (click)="runColorCoding()">Color Code Folders</button>
    <button (click)="resetIcons()">Reset to Default</button>
  `
})
export class ColorActionComponent {
  runColorCoding() {
    window.electron.invoke('run-color-coding');
  }
  resetIcons() {
    window.electron.invoke('run-reset-icon');
  }
}
