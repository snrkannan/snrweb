import { Component } from '@angular/core';

@Component({
  selector: 'app-date-converter',
  templateUrl: './date-converter.component.html',
  styleUrls: ['./date-converter.component.scss']
})
export class DateConverterComponent {
  dateInput: string = this.getDefaultDateTime(); // With default time
  milliseconds: number | null = null;
  millisInput: string = '';
  convertedDate: string = '';

  // Set default time to 09:00 AM today
  getDefaultDateTime(): string {
    const now = new Date();
    now.setHours(9, 0, 0, 0); // 09:00 AM
    const offset = now.getTimezoneOffset() * 60000;
    const localTime = new Date(now.getTime() - offset);
    return localTime.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
  }

  convertDateToMillis(): void {
    const date = new Date(this.dateInput);
    if (!isNaN(date.getTime())) {
      this.milliseconds = date.getTime();
    } else {
      this.milliseconds = null;
    }
  }

  convertMillisToDate(): void {
    const millis = parseInt(this.millisInput, 10);
    if (!isNaN(millis)) {
      const date = new Date(millis);
      const offset = date.getTimezoneOffset() * 60000;
      const local = new Date(date.getTime() - offset);
      this.convertedDate = local.toISOString().slice(0, 16);
    } else {
      this.convertedDate = '';
    }
  }
}
