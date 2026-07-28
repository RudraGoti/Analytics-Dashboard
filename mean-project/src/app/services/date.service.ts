import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface DateRange {
  from: string;
  to: string;
}

@Injectable({
  providedIn: 'root'
})
export class DateService {
  selectedDate$ = new BehaviorSubject<string>(this.getToday());
  selectedDateRange$ = new BehaviorSubject<DateRange>(this.getTodayRange());

  setDateRange(from: string, to: string): void {
    const range = this.normalizeRange(from, to);
    this.selectedDateRange$.next(range);
    this.selectedDate$.next(range.from);
  }

  setSingleDate(date: string): void {
    this.selectedDate$.next(date);
    this.selectedDateRange$.next({ from: date, to: date });
  }

  private normalizeRange(from: string, to: string): DateRange {
    const start = from || to || this.getToday();
    const end = to || from || this.getToday();
    return start <= end ? { from: start, to: end } : { from: end, to: start };
  }

  private getToday(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getTodayRange(): DateRange {
    const today = this.getToday();
    return { from: today, to: today };
  }
}
