import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { forkJoin, Subscription } from 'rxjs';
import { DateService } from '../../services/date.service';
import { DayComparison, DaySummary, DaySummaryService } from '../../services/day-summary.service';
import { ExpenseService } from '../../services/expense.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css', './dashboard-details.css'],
})
export class Dashboard implements OnInit, OnDestroy {
  selectedDate = '';
  summary!: DaySummary;
  comparison: DayComparison | null = null;
  isLoading = true;
  errorMessage = '';
  statusFilter = '';
  modeFilter = '';
  amountSort: 'asc' | 'desc' = 'desc';
  filteredExpenses: DaySummary['expenses'] = [];
  filteredExpenseTotal = 0;
  paymentExpenseId: string | null = null;
  paymentDate = '';
  paymentMode = '';
  paymentError = '';
  isUpdatingPayment = false;
  billPreview: DaySummary['expenses'][number] | null = null;
  billPreviewUrl: string | null = null;
  billPreviewResourceUrl: SafeResourceUrl | null = null;
  billPreviewError = '';

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
    private sanitizer: DomSanitizer,
  ) {
    this.summary = this.daySummaryService.summarize(null);
  }

  ngOnInit(): void {
    this.dateSubscription = this.dateService.selectedDate$.subscribe((date) => {
      this.selectedDate = date;
      this.paymentExpenseId = null;
      this.closeBillPreview();
      this.loadRecord(date);
    });
  }

  ngOnDestroy(): void {
    this.dateSubscription.unsubscribe();
    this.revokeBillPreviewUrl();
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
    this.isLoading = true;
    this.errorMessage = '';
    this.cd.markForCheck();

    forkJoin({
      current: this.expenseService.getExpenseByDate(date),
      previous: this.expenseService.getExpenseByDate(previousDate),
    }).subscribe({
      next: ({ current, previous }) => {
        if (requestVersion !== this.loadVersion || this.selectedDate !== date) {
          return;
        }

        this.summary = this.daySummaryService.summarize(current);
        this.comparison = previous !== null && previous !== undefined
          ? this.daySummaryService.compare(this.summary, this.daySummaryService.summarize(previous))
          : null;
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

  getComparison(key: keyof DayComparison): DayComparison[keyof DayComparison] | null {
    return this.comparison?.[key] || null;
  }

  formatPaidDate(date: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  openPaymentForm(expense: DaySummary['expenses'][number]): void {
    if (!expense.id) return;
    this.paymentExpenseId = expense.id;
    this.paymentDate = this.todayDate();
    this.paymentMode = '';
    this.paymentError = '';
  }

  cancelPayment(): void {
    this.paymentExpenseId = null;
    this.paymentError = '';
  }

  confirmPayment(expense: DaySummary['expenses'][number]): void {
    if (!expense.id || expense.id !== this.paymentExpenseId) return;
    if (!this.paymentDate || !this.paymentMode) {
      this.paymentError = 'Choose the paid date and payment mode.';
      return;
    }

    this.isUpdatingPayment = true;
    this.paymentError = '';
    this.expenseService.markExpensePaid(this.selectedDate, expense.id, {
      paidDate: this.paymentDate,
      mode: this.paymentMode,
    }).subscribe({
      next: () => {
        this.isUpdatingPayment = false;
        this.paymentExpenseId = null;
        this.loadRecord();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Failed to update expense payment', error);
        this.isUpdatingPayment = false;
        this.paymentError = typeof error.error?.error === 'string'
          ? error.error.error
          : 'Unable to update this payment. Please try again.';
        this.cd.markForCheck();
      },
    });
  }

  openBillPreview(expense: DaySummary['expenses'][number]): void {
    this.closeBillPreview();
    this.billPreview = expense;
    try {
      if (!expense.billData || !expense.billContentType) {
        throw new Error('This bill attachment is unavailable.');
      }
      const binary = atob(expense.billData);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: expense.billContentType }));
      this.billPreviewUrl = url;
      if (expense.billContentType === 'application/pdf') {
        this.billPreviewResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
      }
    } catch (error) {
      console.error('Failed to open bill attachment', error);
      this.billPreviewError = 'Unable to display this bill attachment.';
    }
  }

  closeBillPreview(): void {
    this.revokeBillPreviewUrl();
    this.billPreview = null;
    this.billPreviewError = '';
  }

  private todayDate(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  private revokeBillPreviewUrl(): void {
    if (this.billPreviewUrl) {
      URL.revokeObjectURL(this.billPreviewUrl);
    }
    this.billPreviewUrl = null;
    this.billPreviewResourceUrl = null;
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
