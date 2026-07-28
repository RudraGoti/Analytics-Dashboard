import { Component, Input, OnInit, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { DateRange, DateService } from '../../services/date.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent implements OnInit, AfterViewInit, OnDestroy {

  @Input() isSidebarCollapsed = false;

  pageTitle = 'Dashboard';
  currentDate: string;
  selectedDate: string = '';
  selectedRange: DateRange = { from: '', to: '' };
  fromDate: string = '';
  toDate: string = '';
  showCalendar: boolean = false;
  isRangeMode: boolean = false;
  currentMonth: Date = new Date();
  calendarDates: Date[] = [];
  weekDays: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  private dateSubscription = new Subscription();
  private rangeSubscription = new Subscription();

  constructor(private router: Router, private dateService: DateService) {
    const today = new Date();

    this.currentDate = today.toLocaleDateString(
      'en-GB',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }
    );

    const initialRange = this.dateService.selectedDateRange$.getValue();
    this.selectedRange = initialRange;
    this.fromDate = initialRange.from;
    this.toDate = initialRange.to;
    this.selectedDate = this.dateService.selectedDate$.getValue();
  }

  ngOnInit(): void {
    this.rangeSubscription = this.dateService.selectedDateRange$.subscribe((range) => {
      this.selectedRange = range;
      this.fromDate = range.from;
      this.toDate = range.to;
    });

    this.dateSubscription = this.dateService.selectedDate$.subscribe((date) => {
      this.selectedDate = date;
    });

    this.updateTitle(this.router.url);

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.updateTitle(event.urlAfterRedirects);
      });
  }

  toggleCalendar(): void {
    this.showCalendar = !this.showCalendar;
    if (this.showCalendar) {
      this.generateCalendarDates();
      setTimeout(() => this.updateCalendarPosition(), 0);
    }
  }

  applyDateRange(): void {
    this.dateService.setDateRange(this.fromDate, this.toDate);
    this.showCalendar = false;
  }

  setSingleDate(value: string): void {
    this.dateService.setSingleDate(value);
    this.showCalendar = false;
  }

  formatRangeLabel(range: DateRange): string {
    if (!range.from || !range.to) {
      return 'Select a date range';
    }

    const fromLabel = new Date(range.from).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short'
    });
    const toLabel = new Date(range.to).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    return range.from === range.to ? toLabel : `${fromLabel} — ${toLabel}`;
  }

  generateCalendarDates(): void {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    this.calendarDates = [];

    // Previous month dates
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      this.calendarDates.push(new Date(year, month - 1, prevMonthLastDay - i));
    }

    // Current month dates
    for (let i = 1; i <= daysInMonth; i++) {
      this.calendarDates.push(new Date(year, month, i));
    }

    // Next month dates
    const remainingDays = 42 - this.calendarDates.length;
    for (let i = 1; i <= remainingDays; i++) {
      this.calendarDates.push(new Date(year, month + 1, i));
    }
  }

  previousMonth(): void {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1);
    this.generateCalendarDates();
  }

  nextMonth(): void {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1);
    this.generateCalendarDates();
  }

  selectDate(date: Date): void {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    console.log('Header: selecting date', dateString);

    if (this.isRangeMode) {
      this.fromDate = dateString;
      this.toDate = dateString;
      this.applyDateRange();
    } else {
      this.setSingleDate(dateString);
    }
  }

  isCurrentMonth(date: Date): boolean {
    return date.getMonth() === this.currentMonth.getMonth();
  }

  isSelectedDate(date: Date): boolean {
    const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (this.isRangeMode) {
      if (!this.selectedRange.from || !this.selectedRange.to) return false;
      const selectedFrom = new Date(this.selectedRange.from);
      const selectedTo = new Date(this.selectedRange.to);
      return current >= selectedFrom && current <= selectedTo;
    }

    if (!this.selectedDate) return false;
    const selected = new Date(this.selectedDate);
    return current.getTime() === new Date(selected.getFullYear(), selected.getMonth(), selected.getDate()).getTime();
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  @HostListener('document:click', ['$event'])
  closeCalendarOnClickOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const datePickerContainer = document.querySelector('.date-picker-container');
    if (datePickerContainer && !datePickerContainer.contains(target)) {
      this.showCalendar = false;
    }
  }

  ngAfterViewInit(): void {
    this.updateCalendarPosition();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (this.showCalendar) {
      this.updateCalendarPosition();
    }
  }

  ngOnDestroy(): void {
    this.rangeSubscription.unsubscribe();
    this.dateSubscription.unsubscribe();
  }

  private updateCalendarPosition(): void {
    const header = document.querySelector('.header');
    const popup = document.querySelector('.calendar-popup');
    if (header && popup) {
      const headerRect = header.getBoundingClientRect();
      (popup as HTMLElement).style.top = (headerRect.bottom + 12) + 'px';
    }
  }

  updateTitle(url: string) {

    const route = url.split('/')[1];
    this.isRangeMode = route === 'analytics';

    switch(route) {

      case 'dashboard':
        this.pageTitle = 'Dashboard';
        break;

      case 'calendar':
        this.pageTitle = 'Calendar';
        break;

      case 'notifications':
        this.pageTitle = 'Notifications';
        break;

      case 'Reports':
        this.pageTitle = 'Reports';
        break;

      case 'analytics':
        this.pageTitle = 'Analytics';
        break;

      case 'AddExpense':
        this.pageTitle = 'Add Expense';
        break;

      case 'settings':
        this.pageTitle = 'Settings';
        break;

      default:
        this.pageTitle = 'Dashboard';
    }
  }

}