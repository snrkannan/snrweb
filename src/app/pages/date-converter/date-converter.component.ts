import { Component, OnInit } from '@angular/core';

interface TimeDifference {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

type ConversionMode = 'dateToMillis' | 'millisToDate' | 'timeDiff' | 'timezone' | 'yearlyCalendar';

@Component({
  selector: 'app-date-converter',
  templateUrl: './date-converter.component.html',
  styleUrls: ['./date-converter.component.scss']
})
export class DateConverterComponent implements OnInit {
  selectedOption: ConversionMode = 'dateToMillis';

  dateInput: string = this.getDefaultDateTime();
  milliseconds: number | null = null;
  millisInput: string = '';
  convertedDate: string = '';

  // Date difference properties
  startDate: string = this.getDefaultDateTime();
  endDate: string = this.getDefaultDateTime();
  timeDifference: TimeDifference | null = null;

  // Timezone conversion properties
  dateToConvert: string = this.getDefaultDateTime();
  selectedTimezones: string[] = ['UTC'];
  convertedTimezones: { [key: string]: string } = {};

  // Yearly calendar properties
  selectedYear: number = new Date().getFullYear();
  yearlyCalendarData: { month: string; days: any[][] }[] = [];
  yearRange: number[] = [];

  // Holiday country selection
  selectedCountry: string = 'US';
  countries = [
    { label: 'United States', value: 'US' },
    { label: 'United Kingdom', value: 'UK' },
    { label: 'India', value: 'India' },
    { label: 'Japan', value: 'Japan' },
    { label: 'Australia', value: 'Australia' }
  ];

  timezones = [
    { label: 'UTC', value: 'UTC' },
    // Americas - North
    { label: 'EST (Eastern Standard)', value: 'America/New_York' },
    { label: 'CST (Central Standard)', value: 'America/Chicago' },
    { label: 'MST (Mountain Standard)', value: 'America/Denver' },
    { label: 'PST (Pacific Standard)', value: 'America/Los_Angeles' },
    { label: 'AKST (Alaska)', value: 'America/Anchorage' },
    { label: 'HST (Hawaii)', value: 'Pacific/Honolulu' },
    // Americas - Central & South
    { label: 'CDT (Central America)', value: 'America/Mexico_City' },
    { label: 'ECT (Ecuador/Colombia)', value: 'America/Bogota' },
    { label: 'ART (Argentina)', value: 'America/Argentina/Buenos_Aires' },
    { label: 'BRT (Brazil)', value: 'America/Sao_Paulo' },
    // Europe
    { label: 'GMT (London)', value: 'Europe/London' },
    { label: 'CET (Central Europe)', value: 'Europe/Paris' },
    { label: 'EET (Eastern Europe)', value: 'Europe/Istanbul' },
    { label: 'WET (Western Europe)', value: 'Europe/Lisbon' },
    { label: 'MSK (Moscow)', value: 'Europe/Moscow' },
    // Africa
    { label: 'CAT (Central Africa)', value: 'Africa/Johannesburg' },
    { label: 'EAT (East Africa)', value: 'Africa/Nairobi' },
    { label: 'WAT (West Africa)', value: 'Africa/Lagos' },
    { label: 'SAST (South Africa Standard)', value: 'Africa/Harare' },
    // Middle East & Western Asia
    { label: 'GST (Gulf Standard)', value: 'Asia/Dubai' },
    { label: 'IST (India Standard)', value: 'Asia/Kolkata' },
    { label: 'IRDT (Iran)', value: 'Asia/Tehran' },
    { label: 'PKT (Pakistan)', value: 'Asia/Karachi' },
    { label: 'AFT (Afghanistan)', value: 'Asia/Kabul' },
    // Central & East Asia
    { label: 'UZT (Uzbekistan)', value: 'Asia/Tashkent' },
    { label: 'JST (Japan)', value: 'Asia/Tokyo' },
    { label: 'KST (Korea)', value: 'Asia/Seoul' },
    { label: 'CST (China)', value: 'Asia/Shanghai' },
    { label: 'AWST (Western Australia)', value: 'Australia/Perth' },
    // Southeast Asia
    { label: 'MYT (Malaysia)', value: 'Asia/Kuala_Lumpur' },
    { label: 'SGT (Singapore)', value: 'Asia/Singapore' },
    { label: 'PHT (Philippines)', value: 'Asia/Manila' },
    { label: 'ICT (Thailand/Cambodia)', value: 'Asia/Bangkok' },
    { label: 'VNT (Vietnam)', value: 'Asia/Ho_Chi_Minh' },
    // Oceania
    { label: 'ACST (Central Australia)', value: 'Australia/Adelaide' },
    { label: 'AEST (Eastern Australia)', value: 'Australia/Sydney' },
    { label: 'AEDT (Eastern Australia DST)', value: 'Australia/Melbourne' },
    { label: 'NZST (New Zealand)', value: 'Pacific/Auckland' },
    { label: 'FJT (Fiji)', value: 'Pacific/Fiji' },
    { label: 'SBT (Solomon Islands)', value: 'Pacific/Guadalcanal' },
    // Pacific Islands
    { label: 'WST (Samoa)', value: 'Pacific/Apia' },
    { label: 'CHST (Guam/Chamorro)', value: 'Pacific/Guam' },
    { label: 'LINT (Line Islands)', value: 'Pacific/Kiritimati' }
  ];

  getDefaultDateTime(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localTime = new Date(now.getTime() - offset);
    return localTime.toISOString().slice(0, 16);
  }

  selectOption(option: ConversionMode): void {
    this.selectedOption = option;
  }

  ngOnInit(): void {
    // Initialize timezone conversion with default UTC selection
    this.convertToTimezone();
    // Initialize year range for calendar (past 5 years, current year, next 5 years)
    this.initializeYearRange();
    // Generate yearly calendar
    this.generateYearlyCalendar();
  }

  initializeYearRange(): void {
    const currentYear = new Date().getFullYear();
    this.yearRange = [];
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
      this.yearRange.push(i);
    }
  }

  generateYearlyCalendar(): void {
    this.yearlyCalendarData = [];
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const holidays = this.getHolidaysForYear(this.selectedYear, this.selectedCountry);

    for (let month = 0; month < 12; month++) {
      const firstDay = new Date(this.selectedYear, month, 1).getDay();
      const daysInMonth = new Date(this.selectedYear, month + 1, 0).getDate();
      
      const monthData: any[][] = [];
      let week: any[] = [];
      
      // Add empty cells for days before the first day
      for (let i = 0; i < firstDay; i++) {
        week.push(null);
      }
      
      // Add day numbers
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(this.selectedYear, month, day);
        const dateStr = this.getDateString(date);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const holiday = holidays[dateStr];

        week.push({
          day,
          date,
          isToday: this.isToday(date),
          isWeekend,
          holiday,
          dayOfWeek: date.getDay()
        });
        
        if (week.length === 7) {
          monthData.push([...week]);
          week = [];
        }
      }
      
      // Fill remaining cells
      if (week.length > 0) {
        while (week.length < 7) {
          week.push(null);
        }
        monthData.push(week);
      }

      this.yearlyCalendarData.push({
        month: months[month],
        days: monthData
      });
    }
  }

  getDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getHolidaysForYear(year: number, country: string): { [key: string]: string } {
    const holidays: { [key: string]: string } = {};

    if (country === 'US') {
      // US Federal Holidays
      holidays[`${year}-01-01`] = 'New Year\'s Day';
      holidays[`${year}-07-04`] = 'Independence Day';
      holidays[`${year}-11-11`] = 'Veterans Day';
      holidays[`${year}-12-25`] = 'Christmas';
      
      // US Holidays calculated
      const mlkDay = this.getNthDayOfMonth(year, 0, 1, 3); // 3rd Monday of January
      holidays[this.getDateString(mlkDay)] = 'MLK Jr. Day';
      
      const presidentDay = this.getNthDayOfMonth(year, 1, 1, 3); // 3rd Monday of February
      holidays[this.getDateString(presidentDay)] = 'Presidents Day';
      
      const memorialDay = this.getNthDayOfMonth(year, 4, 1, 999); // Last Monday of May
      holidays[this.getDateString(memorialDay)] = 'Memorial Day';
      
      const laborDay = this.getNthDayOfMonth(year, 8, 1, 1); // 1st Monday of September
      holidays[this.getDateString(laborDay)] = 'Labor Day';
      
      const thanksgiving = this.getNthDayOfMonth(year, 10, 4, 4); // 4th Thursday of November
      holidays[this.getDateString(thanksgiving)] = 'Thanksgiving';
    } 
    else if (country === 'UK') {
      // UK Bank Holidays
      holidays[`${year}-01-01`] = 'New Year\'s Day';
      holidays[`${year}-04-25`] = 'Early May Bank Holiday';
      holidays[`${year}-12-25`] = 'Christmas Day';
      holidays[`${year}-12-26`] = 'Boxing Day';
      
      // UK calculated holidays
      const easterMonday = this.getEasterMonday(year);
      holidays[this.getDateString(easterMonday)] = 'Easter Monday';
      
      const springBankHoliday = this.getNthDayOfMonth(year, 4, 1, 999); // Last Monday of May
      holidays[this.getDateString(springBankHoliday)] = 'Spring Bank Holiday';
      
      const summerBankHoliday = this.getNthDayOfMonth(year, 7, 1, 999); // Last Monday of August
      holidays[this.getDateString(summerBankHoliday)] = 'Summer Bank Holiday';
    } 
    else if (country === 'India') {
      // India National Holidays
      holidays[`${year}-01-26`] = 'Republic Day';
      holidays[`${year}-08-15`] = 'Independence Day';
      holidays[`${year}-10-02`] = 'Gandhi Jayanti';
      holidays[`${year}-12-25`] = 'Christmas';
      
      // India calculated holidays
      const holi = this.getIndiaHoli(year);
      if (holi) holidays[this.getDateString(holi)] = 'Holi';
      
      const diwaliStartDate = this.getIndiaDiwali(year);
      if (diwaliStartDate) holidays[this.getDateString(diwaliStartDate)] = 'Diwali';
    } 
    else if (country === 'Japan') {
      // Japan National Holidays
      holidays[`${year}-01-01`] = 'New Year\'s Day';
      holidays[`${year}-01-08`] = 'Coming of Age Day';
      holidays[`${year}-02-11`] = 'National Foundation Day';
      holidays[`${year}-02-23`] = 'Emperor\'s Birthday';
      holidays[`${year}-05-03`] = 'Constitution Memorial Day';
      holidays[`${year}-05-04`] = 'Greenery Day';
      holidays[`${year}-05-05`] = 'Children\'s Day';
      holidays[`${year}-07-15`] = 'Marine Day';
      holidays[`${year}-08-11`] = 'Mountain Day';
      holidays[`${year}-11-03`] = 'Culture Day';
      holidays[`${year}-11-23`] = 'Labor Thanksgiving Day';
      
      // Japan calculated holidays
      const respectForAgedDay = this.getNthDayOfMonth(year, 8, 1, 3); // 3rd Monday of September
      holidays[this.getDateString(respectForAgedDay)] = 'Respect for the Aged Day';
      
      const autumnalEquinox = this.getAutumnalEquinox(year);
      holidays[this.getDateString(autumnalEquinox)] = 'Autumnal Equinox Day';
      
      const sportsDay = this.getNthDayOfMonth(year, 9, 1, 2); // 2nd Monday of October
      holidays[this.getDateString(sportsDay)] = 'Sports Day';
    } 
    else if (country === 'Australia') {
      // Australia National Holidays
      holidays[`${year}-01-01`] = 'New Year\'s Day';
      holidays[`${year}-01-26`] = 'Australia Day';
      holidays[`${year}-04-25`] = 'ANZAC Day';
      holidays[`${year}-12-25`] = 'Christmas Day';
      holidays[`${year}-12-26`] = 'Boxing Day';
      
      // Australia calculated holidays
      const queensBirthday = this.getNthDayOfMonth(year, 5, 1, 2); // 2nd Monday of June
      holidays[this.getDateString(queensBirthday)] = 'Queen\'s Birthday';
    }

    return holidays;
  }

  getEasterMonday(year: number): Date {
    // Computus algorithm to calculate Easter
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    // Easter Monday is the day after Easter
    return new Date(year, month - 1, day + 1);
  }

  getIndiaHoli(year: number): Date | null {
    // Holi is celebrated on the full moon day in the Hindu month of Phalguna
    // Approximate date (varies each year by lunar calendar)
    if (year === 2026) return new Date(year, 2, 24); // March 24, 2026
    if (year === 2027) return new Date(year, 2, 13); // March 13, 2027
    return new Date(year, 2, 15); // Default approximate
  }

  getIndiaDiwali(year: number): Date | null {
    // Diwali is celebrated on the new moon day in the Hindu month of Kartik
    // Approximate date (varies each year by lunar calendar)
    if (year === 2026) return new Date(year, 9, 24); // October 24, 2026
    if (year === 2027) return new Date(year, 10, 13); // November 13, 2027
    return new Date(year, 10, 15); // Default approximate
  }

  getAutumnalEquinox(year: number): Date {
    // Autumnal Equinox typically falls on September 22-23
    return new Date(year, 8, 23);
  }

  getNthDayOfMonth(year: number, month: number, dayOfWeek: number, n: number): Date {
    const date = new Date(year, month, 1);
    let count = 0;
    
    // If n is 999, get the last occurrence
    if (n === 999) {
      date.setMonth(month + 1);
      date.setDate(0);
      while (date.getDay() !== dayOfWeek) {
        date.setDate(date.getDate() - 1);
      }
      return date;
    }
    
    while (date.getMonth() === month) {
      if (date.getDay() === dayOfWeek) {
        count++;
        if (count === n) {
          return new Date(date);
        }
      }
      date.setDate(date.getDate() + 1);
    }
    return date;
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  getDateTooltip(day: any): string {
    if (!day || !day.date) return '';
    
    const dateStr = day.date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    if (day.holiday) {
      return `${dateStr}\nHoliday: ${day.holiday}`;
    }

    return dateStr;
  }

  onYearChange(): void {
    this.generateYearlyCalendar();
  }

  onCountryChange(): void {
    this.generateYearlyCalendar();
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

  calculateTimeDifference(): void {
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      this.timeDifference = null;
      return;
    }

    const diffMs = Math.abs(end.getTime() - start.getTime());
    const totalSeconds = Math.floor(diffMs / 1000);

    const days = Math.floor(totalSeconds / (24 * 3600));
    const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    this.timeDifference = {
      days,
      hours,
      minutes,
      seconds,
      totalSeconds
    };
  }

  convertToTimezone(): void {
    try {
      const date = new Date(this.dateToConvert);
      if (isNaN(date.getTime())) {
        this.convertedTimezones = {};
        return;
      }

      this.convertedTimezones = {};
      
      // Only convert to selected timezones
      const selectedTzObjects = this.timezones.filter(tz => 
        this.selectedTimezones.includes(tz.value)
      );

      selectedTzObjects.forEach(tz => {
        try {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz.value,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });

          this.convertedTimezones[tz.label] = formatter.format(date);
        } catch (e) {
          this.convertedTimezones[tz.label] = 'Invalid timezone';
        }
      });
    } catch (error) {
      this.convertedTimezones = {};
    }
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    });
  }
}
