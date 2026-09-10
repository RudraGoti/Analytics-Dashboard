import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseService, Expense } from '../../services/expense.service';
import { DateService, DateRange } from '../../services/date.service';
import { PdfReportService, PdfReportPayload } from '../../services/pdf-report.service';

interface DailyRecord {
  date: string;
  counter?: number;
  expenses: Expense[];
}

interface ReportHistoryItem {
  fileName: string;
  reportTitle: string;
  from: string;
  to: string;
  generatedAt: string;
  totalExpense: number;
  totalCounter: number;
}

type PresetKey = 'today' | 'week' | 'month' | 'lastMonth' | 'custom';

const HISTORY_KEY = 'ad_report_history';

@Component({
  selector: 'app-Reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './Reports.html',
  styleUrl: './Reports.css',
})
export class Reports implements OnInit {

  reportTitle = 'Expense Report';
  preset: PresetKey = 'month';
  fromDate = '';
  toDate = '';

  isLoading = false;
  isGenerating = false;
  errorMessage = '';

  summary = {
    totalCounter: 0,
    totalExpense: 0,
    net: 0,
    totalTransactions: 0,
    totalCategories: 0,
  };

  categorySummary: Array<{ category: string; amount: number; percentage: number; color: string }> = [];
  records: Array<{ date: string; counter: number; expense: number; net: number; entryCount: number }> = [];

  history: ReportHistoryItem[] = [];

  constructor(
    private expenseService: ExpenseService,
    private dateService: DateService,
    private pdfReportService: PdfReportService
  ) {}

  ngOnInit(): void {
    this.loadHistory();
    this.applyPreset('month');
  }

  applyPreset(preset: PresetKey): void {
    this.preset = preset;
    const today = new Date();

    if (preset === 'today') {
      const d = this.formatIsoDate(today);
      this.fromDate = d;
      this.toDate = d;
    } else if (preset === 'week') {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      this.fromDate = this.formatIsoDate(start);
      this.toDate = this.formatIsoDate(today);
    } else if (preset === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      this.fromDate = this.formatIsoDate(start);
      this.toDate = this.formatIsoDate(today);
    } else if (preset === 'lastMonth') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      this.fromDate = this.formatIsoDate(start);
      this.toDate = this.formatIsoDate(end);
    }
    // 'custom' leaves fromDate/toDate as whatever the user has picked

    if (this.fromDate && this.toDate) {
      this.loadPreview();
    }
  }

  onCustomDateChange(): void {
    this.preset = 'custom';
    if (this.fromDate && this.toDate) {
      this.loadPreview();
    }
  }

  private loadPreview(): void {
    if (!this.fromDate || !this.toDate) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.expenseService.getExpensesByDateRange(this.fromDate, this.toDate).subscribe({
      next: (records: DailyRecord[]) => {
        const ordered = this.normalizeRecords(records || [], this.fromDate, this.toDate);
        this.lastRawRecords = ordered;
        this.buildSummary(ordered);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Reports: failed to load preview', err);
        this.errorMessage = 'Unable to load data for this range.';
        this.lastRawRecords = [];
        this.buildSummary([]);
        this.isLoading = false;
      },
    });
  }

  private normalizeRecords(records: DailyRecord[], from: string, to: string): DailyRecord[] {
    const byDate = new Map(records.map((r) => [r.date, r]));
    const dates = this.createDateRange(from, to);
    return dates.map((date) => byDate.get(date) || { date, counter: 0, expenses: [] });
  }

  private createDateRange(from: string, to: string): string[] {
    const start = this.parseDate(from);
    const end = this.parseDate(to);
    const dates: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      dates.push(this.formatIsoDate(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  private buildSummary(records: DailyRecord[]): void {
    let runningCounter = 0;
    let runningExpense = 0;

    this.records = records.map((r) => {
      const expenseTotal = (r.expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const counter = r.counter || 0;
      runningCounter += counter;
      runningExpense += expenseTotal;
      return {
        date: r.date,
        counter,
        expense: expenseTotal,
        net: counter - expenseTotal,
        entryCount: (r.expenses || []).length,
      };
    });

    const allExpenses = records.flatMap((r) => r.expenses || []);
    const categoryCount = new Set(allExpenses.map((e) => e.category || 'Other')).size;

    this.summary = {
      totalCounter: runningCounter,
      totalExpense: runningExpense,
      net: runningCounter - runningExpense,
      totalTransactions: allExpenses.length,
      totalCategories: categoryCount,
    };

    this.categorySummary = this.buildCategorySummary(records);
  }

  private buildCategorySummary(records: DailyRecord[]) {
    const totals = new Map<string, number>();
    records.forEach((r) => {
      (r.expenses || []).forEach((e) => {
        const cat = e.category || 'Other';
        totals.set(cat, (totals.get(cat) || 0) + Number(e.amount || 0));
      });
    });

    const total = Array.from(totals.values()).reduce((s, v) => s + v, 0) || 1;
    const colors = ['#2563eb', '#f97316', '#10b981', '#7c3aed', '#0ea5e9', '#f59e0b'];

    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount], i) => ({
        category,
        amount,
        percentage: Number(((amount / total) * 100).toFixed(1)),
        color: colors[i % colors.length],
      }));
  }

  async generatePdf(): Promise<void> {
    if (this.isGenerating || !this.fromDate || !this.toDate) return;

    this.isGenerating = true;
    try {
      const payload = this.buildPdfPayload();
      await this.pdfReportService.generateReport(payload);
      this.saveHistoryItem(payload);
    } catch (err) {
      console.error('Reports: failed to generate PDF', err);
      this.errorMessage = 'Failed to generate the report. Please try again.';
    } finally {
      this.isGenerating = false;
    }
  }

  private buildPdfPayload(): PdfReportPayload {
    const generationDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const closingInHand = this.records.length ? this.records.reduce((sum, r) => sum + r.net, 0) : 0;

    return {
      fileName: `${this.reportTitle.replace(/\s+/g, '_')}_${this.fromDate}_to_${this.toDate}.pdf`,
      reportTitle: this.reportTitle,
      selectedRange: { from: this.fromDate, to: this.toDate },
      generationDate,
      openingInHand: 0,
      totalCounter: this.summary.totalCounter,
      totalExpense: this.summary.totalExpense,
      closingInHand,
      categorySummary: this.categorySummary,
      topTransactions: this.buildTopTransactions(),
      dateWiseSummary: this.buildDateWiseSummary(),
      detailedRecords: this.buildDetailedRecords(),
    };
  }

  private buildTopTransactions() {
    // Re-fetch is avoided; derive from last loaded records via detailedRecords cache
    return this.lastRawRecords
      .flatMap((r) =>
        (r.expenses || []).map((e) => ({
          date: r.date,
          title: e.title || e.category || 'Expense',
          category: e.category || 'Other',
          amount: Number(e.amount || 0),
          description: e.description || '',
          time: '--',
          notes: e.description || '--',
        }))
      )
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }

  private buildDateWiseSummary() {
    return this.records.map((r) => ({
      date: this.formatLongDate(r.date),
      counter: r.counter,
      expense: r.expense,
      runningInHand: r.net,
      notes: r.entryCount ? `${r.entryCount} entr${r.entryCount === 1 ? 'y' : 'ies'}` : 'No transactions',
    }));
  }

  private buildDetailedRecords() {
    let previousInHand = 0;
    return this.lastRawRecords.map((r) => {
      const expenseTotal = (r.expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const closingInHand = previousInHand + (r.counter || 0) - expenseTotal;
      const detail = {
        date: this.formatLongDate(r.date),
        previousInHand,
        counter: r.counter || 0,
        expenses: (r.expenses || []).map((e) => ({
          title: e.title || e.category || 'Expense',
          category: e.category || 'Other',
          amount: Number(e.amount || 0),
          description: e.description || '--',
          time: '--',
          notes: e.description || '--',
        })),
        totalExpense: expenseTotal,
        closingInHand,
      };
      previousInHand = closingInHand;
      return detail;
    });
  }

  // Cache of raw records for the current preview range (used to build PDF detail sections)
  private lastRawRecords: DailyRecord[] = [];

  private saveHistoryItem(payload: PdfReportPayload): void {
    const item: ReportHistoryItem = {
      fileName: payload.fileName,
      reportTitle: payload.reportTitle,
      from: payload.selectedRange.from,
      to: payload.selectedRange.to,
      generatedAt: new Date().toISOString(),
      totalExpense: payload.totalExpense,
      totalCounter: payload.totalCounter,
    };

    this.history = [item, ...this.history].slice(0, 10);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
    } catch (e) {
      console.warn('Reports: unable to persist history', e);
    }
  }

  private loadHistory(): void {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      this.history = raw ? JSON.parse(raw) : [];
    } catch (e) {
      this.history = [];
    }
  }

  regenerate(item: ReportHistoryItem): void {
    this.reportTitle = item.reportTitle;
    this.preset = 'custom';
    this.fromDate = item.from;
    this.toDate = item.to;
    this.loadPreview();
  }

  clearHistory(): void {
    this.history = [];
    try { localStorage.removeItem(HISTORY_KEY); } catch (e) {}
  }

  private parseDate(value: string): Date {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private formatIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private formatLongDate(value: string): string {
    return this.parseDate(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
  }
}
