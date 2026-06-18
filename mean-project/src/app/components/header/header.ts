import { Component, Input, OnInit, AfterViewInit, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { DateService } from '../../services/date.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent implements OnInit, AfterViewInit {

  @Input() isSidebarCollapsed = false;

  pageTitle = 'Dashboard';
  currentDate: string;
  selectedDate: string;
  showCalendar: boolean = false;
  currentMonth: Date = new Date();
  calendarDates: Date[] = [];
  weekDays: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

    this.selectedDate = this.dateService.selectedDate$.getValue();
  }

  ngOnInit(): void {
    this.dateService.selectedDate$.subscribe((date) => {
      this.selectedDate = date;
    });

    this.updateTitle(this.router.url);

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.updateTitle(event.urlAfterRedirects);
      });
  }

  setSelectedDate(value: string): void {
    this.dateService.selectedDate$.next(value);
  }

  toggleCalendar(): void {
    this.showCalendar = !this.showCalendar;
    if (this.showCalendar) {
      this.generateCalendarDates();
      setTimeout(() => this.updateCalendarPosition(), 0);
    }
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
    this.dateService.selectedDate$.next(dateString);
    this.showCalendar = false;
  }

  isCurrentMonth(date: Date): boolean {
    return date.getMonth() === this.currentMonth.getMonth();
  }

  isSelectedDate(date: Date): boolean {
    if (!this.selectedDate) return false;
    const selected = new Date(this.selectedDate);
    return date.getDate() === selected.getDate() &&
           date.getMonth() === selected.getMonth() &&
           date.getFullYear() === selected.getFullYear();
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