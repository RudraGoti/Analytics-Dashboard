import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of, Subscription } from 'rxjs';
import { ExpenseService } from '../../services/expense.service';
import { DateRange } from '../../services/date.service';
import { PdfReportService } from '../../services/pdf-report.service';
import { ReportBuilderService, ReportDay } from '../../services/report-builder.service';
import { SettingsService } from '../../services/settings.service';

type Preset = 'this-month' | 'last-month' | 'last-30-days' | 'custom';

@Component({
  selector: 'app-Reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './Reports.html',
  styleUrl: './Reports.css',
})
export class Reports implements OnInit, OnDestroy {
  preset: Preset = 'this-month';
  range: DateRange = { from: '', to: '' };
  days: ReportDay[] = [];
  openingInHand = 0;
  businessName = 'Business';
  isLoading = false;
  isDownloading = false;
  errorMessage = '';
  private readonly settingsSubscription = new Subscription();

  constructor(
    private expenseService: ExpenseService,
    private reportBuilder: ReportBuilderService,
    private pdfReport: PdfReportService,
    private settingsService: SettingsService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.settingsSubscription.add(this.settingsService.settings$.subscribe((settings) => this.businessName = settings.businessName));
    this.applyPreset();
  }

  ngOnDestroy(): void {
    this.settingsSubscription.unsubscribe();
  }

  get totals() {
    return this.reportBuilder.totals(this.days, this.openingInHand);
  }

  applyPreset(): void {
    if (this.preset === 'custom') return;
    const today = new Date();
    let from: Date;
    let to: Date;
    if (this.preset === 'this-month') {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = today;
    } else if (this.preset === 'last-month') {
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      to = new Date(today.getFullYear(), today.getMonth(), 0);
    } else {
      to = today;
      from = new Date(today);
      from.setDate(today.getDate() - 29);
    }
    this.range = { from: this.toIsoDate(from), to: this.toIsoDate(to) };
    this.loadReport();
  }

  loadReport(): void {
    if (!this.range.from || !this.range.to) return;
    if (this.range.from > this.range.to) {
      this.errorMessage = 'The start date must be on or before the end date.';
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    forkJoin({
      records: this.expenseService.getExpensesByDateRange(this.range.from, this.range.to),
      balance: this.expenseService.getBalanceBefore(this.range.from).pipe(
        catchError(() => of({ before: this.range.from, totalCounter: 0, totalExpenses: 0, balance: 0 })),
      ),
    }).subscribe({
      next: ({ records, balance }) => {
        this.openingInHand = balance.balance;
        this.days = this.reportBuilder.fillRange(records || [], this.range.from, this.range.to);
        this.isLoading = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.errorMessage = 'Unable to load report data.';
        this.days = [];
        this.openingInHand = 0;
        this.isLoading = false;
        this.cd.markForCheck();
      },
    });
  }

  async downloadPdf(): Promise<void> {
    if (this.isDownloading || !this.days.length) return;
    this.isDownloading = true;
    try {
      const payload = this.reportBuilder.buildPayload(this.days, this.range, this.openingInHand, this.businessName);
      await this.pdfReport.generateReport(payload);
    } catch (error) {
      this.errorMessage = 'Unable to generate the PDF report.';
      console.error('Failed to generate report PDF', error);
    } finally {
      this.isDownloading = false;
      this.cd.markForCheck();
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
  }

  closingBalance(index: number): number {
    return this.openingInHand + this.days.slice(0, index + 1)
      .reduce((balance, day) => balance + day.counter - day.totalExpense, 0);
  }

  private toIsoDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
