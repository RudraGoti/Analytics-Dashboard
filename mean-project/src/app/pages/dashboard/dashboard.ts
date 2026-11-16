import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { DateService } from '../../services/date.service';
import { DayComparison, DaySummary, DaySummaryService, MonthSummary } from '../../services/day-summary.service';
import { ExpenseService } from '../../services/expense.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css', './dashboard-details.css'],
})
export class Dashboard implements OnInit, OnDestroy {
  selectedDate = '';
  selectedDateDisplay = '';
  selectedMonthDisplay = '';
  summary!: DaySummary;
  monthSummary: MonthSummary = { counter: 0, totalExpenses: 0, netPosition: 0 };
  comparison: DayComparison | null = null;
  hasPreviousRecord = false;
  recordFound = false;
  isLoading = true;
  errorMessage = '';
  statusFilter = '';
  modeFilter = '';
  amountSort: 'asc' | 'desc' = 'desc';
  filteredExpenses: DaySummary['expenses'] = [];
  filteredExpenseTotal = 0;

  readonly statuses = ['Paid', 'Pending'];
  readonly modes = ['Cash', 'UPI', 'Card', 'Bank Transfer'];
  readonly loadingCards = [1, 2, 3, 4];
  private dateSubscription = new Subscription();
  private loadVersion = 0;

  constructor(
    private cd: ChangeDetectorRef,
    private expenseService: ExpenseService,
    private dateService: DateService,
    private daySummaryService: DaySummaryService,
  ) {
    this.summary = this.daySummaryService.summarize(null);
  }

  ngOnInit(): void {
    this.dateSubscription = this.dateService.selectedDate$.subscribe((date) => {
      this.selectedDate = date;
      this.selectedDateDisplay = this.formatDateLabel(date);
      this.selectedMonthDisplay = date
        ? new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
        : '';
      this.loadRecord(date);
    });
  }

  ngOnDestroy(): void {
    this.dateSubscription.unsubscribe();
  }

  loadRecord(date = this.selectedDate): void {
    if (!date) {
      this.errorMessage = 'Could not load data';
      this.isLoading = false;
      this.cd.markForCheck();
      return;
    }

    const requestVersion = ++this.loadVersion;
    const previousDate = this.shiftDate(date, -1);
    const firstOfMonth = `${date.slice(0, 7)}-01`;
    this.isLoading = true;
    this.errorMessage = '';
    this.cd.markForCheck();

    forkJoin({
      current: this.expenseService.getExpenseByDate(date),
      previous: this.expenseService.getExpenseByDate(previousDate),
      month: this.expenseService.getExpensesByDateRange(firstOfMonth, date),
    }).subscribe({
      next: ({ current, previous, month }) => {
        if (requestVersion !== this.loadVersion || this.selectedDate !== date) {
          return;
        }

        this.recordFound = current !== null && current !== undefined;
        this.summary = this.daySummaryService.summarize(current);
        this.hasPreviousRecord = previous !== null && previous !== undefined;
        this.comparison = this.hasPreviousRecord
          ? this.daySummaryService.compare(this.summary, this.daySummaryService.summarize(previous))
          : null;
        this.monthSummary = this.daySummaryService.summarizeMonth(month);
        this.applyExpenseFilters();
        this.isLoading = false;
        this.cd.markForCheck();
      },
      error: (error) => {
        if (requestVersion !== this.loadVersion || this.selectedDate !== date) {
          return;
        }
        console.error('Failed to load dashboard day summary', error);
        this.errorMessage = 'Could not load data';
        this.isLoading = false;
        this.cd.markForCheck();
      },
    });
  }

  retryLoad(): void {
    this.loadRecord();
  }

  applyExpenseFilters(): void {
    const result = this.daySummaryService.filterExpenses(
      this.summary.expenses,
      this.statusFilter,
      this.modeFilter,
      this.amountSort,
    );
    this.filteredExpenses = result.expenses;
    this.filteredExpenseTotal = result.total;
  }

  toggleAmountSort(): void {
    this.amountSort = this.amountSort === 'desc' ? 'asc' : 'desc';
    this.applyExpenseFilters();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  formatDateLabel(date: string): string {
    if (!date) {
      return 'Selected date';
    }
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  formatPercentage(value: number): string {
    return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}%`;
  }

  getComparison(key: keyof DayComparison): DayComparison[keyof DayComparison] | null {
    return this.comparison?.[key] || null;
  }

  private shiftDate(date: string, days: number): string {
    const [year, month, day] = date.split('-').map(Number);
    const shifted = new Date(year, month - 1, day + days);
    const nextYear = shifted.getFullYear();
    const nextMonth = String(shifted.getMonth() + 1).padStart(2, '0');
    const nextDay = String(shifted.getDate()).padStart(2, '0');
    return `${nextYear}-${nextMonth}-${nextDay}`;
  }
}
