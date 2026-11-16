import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseService, Expense } from '../../services/expense.service';
import { DateService, DateRange } from '../../services/date.service';
import { PdfReportService, PdfReportPayload } from '../../services/pdf-report.service';
import {
  ANALYTICS_CATEGORIES,
  ANALYTICS_MODES,
  CATEGORY_COLORS,
  AnalyticsCalculation,
  AnalyticsCalculatorService,
  ExpenseFilters,
} from '../../services/analytics-calculator.service';
import {
  AreaChartGeometry,
  AreaChartPoint,
  ChartGeometryService,
} from '../../services/chart-geometry.service';
import html2canvas from 'html2canvas';
import { catchError, forkJoin, of, Subscription } from 'rxjs';

interface DailyRecord {
  date: string;
  counter?: number;
  expenses: Expense[];
}

interface AnalyticsSummary {
  totalCounter: number;
  totalExpenses: number;
  totalTransactions: number;
  totalCategories: number;
}

interface KpiChange {
  percentage: number;
  direction: 'up' | 'down';
  tone: 'positive' | 'negative' | 'neutral';
  isNew: boolean;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analytics.html',
  styleUrls: ['./analytics.css', './analytics-details.css'],
})
export class Analytics implements OnInit, OnDestroy {
  @ViewChild('trendChart', { static: false }) trendChart?: ElementRef<HTMLElement>;

  selectedDate: string = '';
  selectedRange: DateRange = { from: '', to: '' };

  summary: AnalyticsSummary = {
    totalCounter: 0,
    totalExpenses: 0,
    totalTransactions: 0,
    totalCategories: 0,
  };

  areaChart!: AreaChartGeometry;

  chartRecords: Array<{
    date: string;
    counter: number;
    expense: number;
    inHand: number;
    expenses: Expense[];
  }> = [];

  categorySummary: Array<{ category: string; amount: number; percentage: number; color: string }> = [];
  topTransactions: Array<{ date: string; title: string; category: string; amount: number; description: string; time: string; notes: string }> = [];
  readonly categories = ANALYTICS_CATEGORIES;
  readonly modes = ANALYTICS_MODES;
  readonly statuses = ['Paid', 'Pending'];
  filters: ExpenseFilters = { category: '', status: '', mode: '', search: '' };
  analyticsData: AnalyticsCalculation;
  donutSegments: ReturnType<ChartGeometryService['buildDonut']> = [];
  gaugeGeometry!: ReturnType<ChartGeometryService['buildGauge']>;
  statusBars: Array<{ label: string; amount: number; count: number; height: number; tone: string }> = [];
  paymentModeBars: Array<AnalyticsCalculation['modeSummary'][number] & { barPercentage: number }> = [];
  kpiChanges: { counter: KpiChange | null; expenses: KpiChange | null; inHand: KpiChange | null; pending: KpiChange | null } = {
    counter: null,
    expenses: null,
    inHand: null,
    pending: null,
  };
  private analyticsRecords: DailyRecord[] = [];
  private previousRecords: DailyRecord[] = [];
  private previousRange: DateRange = { from: '', to: '' };
  private previousOpeningInHand = 0;
  hasRangeData = false;
  hasPreviousData = false;
  comparisonErrorMessage = '';
  isLoading = true;
  isGeneratingPdf = false;
  pdfMessage = '';
  errorMessage = '';
  openingInHand = 0;
  private loadVersion = 0;
  private rangeSubscription = new Subscription();

  tooltip = {
    visible: false,
    x: 0,
    y: 0,
    date: '',
    counter: '',
    expense: '',
    inHand: '',
  };

  constructor(
    private expenseService: ExpenseService,
    private dateService: DateService,
    private pdfReportService: PdfReportService,
    private analyticsCalculator: AnalyticsCalculatorService,
    private chartGeometryService: ChartGeometryService,
    private cd: ChangeDetectorRef,
  ) {
    this.analyticsData = this.analyticsCalculator.calculate([], this.filters, this.selectedRange);
    this.areaChart = this.chartGeometryService.buildAreaChart([]);
    this.gaugeGeometry = this.chartGeometryService.buildGauge(0);
  }

  ngOnInit(): void {
    this.rangeSubscription = this.dateService.selectedDateRange$.subscribe((range) => {
      this.selectedRange = range;
      this.loadAnalytics(range);
    });
  }

  ngOnDestroy(): void {
    this.rangeSubscription.unsubscribe();
  }

  loadAnalytics(range: DateRange): void {
    const requestVersion = ++this.loadVersion;
    const requestRange = { ...range };
    const previousRange = this.getPreviousRange(range);
    this.previousRange = previousRange;
    this.isLoading = true;
    this.errorMessage = '';
    this.comparisonErrorMessage = '';
    this.pdfMessage = '';
    this.cd.markForCheck();

    const previousPeriod = forkJoin({
      records: this.expenseService.getExpensesByDateRange(previousRange.from, previousRange.to),
      balance: this.expenseService.getBalanceBefore(previousRange.from),
    }).pipe(catchError((error) => {
      console.error('Failed to load previous-period analytics', error);
      if (requestVersion === this.loadVersion) {
        this.comparisonErrorMessage = 'Previous-period comparison is unavailable.';
      }
      return of(null);
    }));

    forkJoin({
      records: this.expenseService.getExpensesByDateRange(range.from, range.to),
      balance: this.expenseService.getBalanceBefore(range.from),
      previous: previousPeriod,
    }).subscribe({
      next: ({ records, balance, previous }) => {
        if (requestVersion !== this.loadVersion
          || this.selectedRange.from !== requestRange.from || this.selectedRange.to !== requestRange.to) {
          return;
        }
        const orderedRecords = this.normalizeRecords(records || [], range);
        this.analyticsRecords = orderedRecords;
        this.hasRangeData = Boolean(records?.length);
        this.openingInHand = balance.balance;
        this.summary = this.calculateAnalytics(orderedRecords);
        this.categorySummary = this.buildCategorySummary(orderedRecords);
        this.topTransactions = this.buildTopTransactions(orderedRecords);
        this.previousRecords = previous?.records?.length
          ? this.normalizeRecords(previous.records, previousRange)
          : [];
        this.hasPreviousData = Boolean(previous?.records?.length);
        this.previousOpeningInHand = previous?.balance.balance || 0;
        this.applyFilters();
        this.buildChartData(orderedRecords);
        this.isLoading = false;
        this.cd.markForCheck();
      },
      error: (error) => {
        if (requestVersion !== this.loadVersion
          || this.selectedRange.from !== requestRange.from || this.selectedRange.to !== requestRange.to) {
          return;
        }
        console.error('Failed to load analytics', error);
        this.errorMessage = 'Unable to load analytics right now.';
        this.summary = this.calculateAnalytics([]);
        this.analyticsRecords = [];
        this.previousRecords = [];
        this.hasRangeData = false;
        this.hasPreviousData = false;
        this.openingInHand = 0;
        this.applyFilters();
        this.areaChart = this.chartGeometryService.buildAreaChart([]);
        this.chartRecords = [];
        this.isLoading = false;
        this.cd.markForCheck();
      },
    });
  }

  applyFilters(): void {
    this.analyticsData = this.analyticsCalculator.calculate(
      this.analyticsRecords, this.filters, this.selectedRange, this.openingInHand,
    );
    const previousAnalytics = this.hasPreviousData
      ? this.analyticsCalculator.calculate(
        this.previousRecords, this.filters, this.previousRange, this.previousOpeningInHand,
      )
      : null;
    this.kpiChanges = {
      counter: previousAnalytics ? this.createKpiChange(this.analyticsData.totalCounter, previousAnalytics.totalCounter, true) : null,
      expenses: previousAnalytics ? this.createKpiChange(this.analyticsData.totalExpense, previousAnalytics.totalExpense, false) : null,
      inHand: previousAnalytics ? this.createKpiChange(this.analyticsData.closingBalance, previousAnalytics.closingBalance, true) : null,
      pending: previousAnalytics ? this.createKpiChange(this.analyticsData.pendingTotal, previousAnalytics.pendingTotal, false) : null,
    };
    const expenseRatio = this.analyticsData.totalCounter > 0
      ? this.analyticsData.totalExpense / this.analyticsData.totalCounter * 100
      : this.analyticsData.totalExpense > 0 ? 100 : 0;
    this.gaugeGeometry = this.chartGeometryService.buildGauge(expenseRatio);
    this.donutSegments = this.chartGeometryService.buildDonut(
      this.analyticsData.categorySummary,
      this.analyticsData.totalExpense,
    );
    const statusAmounts = [
      this.analyticsData.paidTotal,
      this.analyticsData.pendingTotal,
      this.analyticsData.totalExpense,
    ];
    const statusHeights = this.chartGeometryService.buildColumnHeights(statusAmounts);
    this.statusBars = [
      { label: 'Paid', amount: this.analyticsData.paidTotal, count: this.analyticsData.paidCount, height: statusHeights[0], tone: 'paid' },
      { label: 'Pending', amount: this.analyticsData.pendingTotal, count: this.analyticsData.pendingCount, height: statusHeights[1], tone: 'pending' },
      { label: 'Total', amount: this.analyticsData.totalExpense, count: this.analyticsData.matchedExpenses.length, height: statusHeights[2], tone: 'total' },
    ];
    const maxModeAmount = Math.max(0, ...this.analyticsData.modeSummary.map((mode) => mode.amount));
    this.paymentModeBars = this.analyticsData.modeSummary.map((mode) => ({
      ...mode,
      barPercentage: this.chartGeometryService.getPercentage(mode.amount, maxModeAmount),
    }));
  }

  clearFilters(): void {
    this.filters = { category: '', status: '', mode: '', search: '' };
    this.applyFilters();
  }

  formatRangeLabel(): string {
    const from = this.parseDate(this.selectedRange.from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const to = this.parseDate(this.selectedRange.to).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return this.selectedRange.from === this.selectedRange.to ? to : `${from} – ${to}`;
  }

  private getPreviousRange(range: DateRange): DateRange {
    const start = Date.parse(`${range.from}T00:00:00Z`);
    const end = Date.parse(`${range.to}T00:00:00Z`);
    const day = 86_400_000;
    const length = Math.max(1, Math.floor((end - start) / day) + 1);
    const previousEnd = start - day;
    const previousStart = previousEnd - (length - 1) * day;
    return {
      from: new Date(previousStart).toISOString().slice(0, 10),
      to: new Date(previousEnd).toISOString().slice(0, 10),
    };
  }

  private createKpiChange(current: number, previous: number, increaseIsGood: boolean): KpiChange {
    const change = this.chartGeometryService.getPercentChange(current, previous);
    const difference = current - previous;
    return {
      percentage: Math.abs(change.percentage),
      direction: difference >= 0 ? 'up' : 'down',
      tone: difference === 0
        ? 'neutral'
        : ((difference > 0) === increaseIsGood ? 'positive' : 'negative'),
      isNew: change.isNew,
    };
  }

  private normalizeRecords(records: DailyRecord[], range: DateRange): DailyRecord[] {
    const recordByDate = new Map(records.map((record) => [record.date, record]));
    const rangeDates = this.createDateRange(range.from, range.to);

    return rangeDates.map((date) => {
      const record = recordByDate.get(date);
      return record || { date, counter: 0, expenses: [] };
    });
  }

  private createDateRange(from: string, to: string): string[] {
    const startDate = this.parseDate(from);
    const endDate = this.parseDate(to);
    const dates: string[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      dates.push(this.formatIsoDate(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private formatIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private calculateAnalytics(records: DailyRecord[]): AnalyticsSummary {
    const result = this.analyticsCalculator.calculate(
      records,
      { category: '', status: '', mode: '', search: '' },
      this.selectedRange,
      this.openingInHand,
    );
    return {
      totalCounter: result.totalCounter,
      totalExpenses: result.rangeTotalExpense,
      totalTransactions: result.matchedExpenses.length,
      totalCategories: result.categoryCount,
    };
  }

  private buildChartData(records: DailyRecord[]): void {
    const dailyTrend = this.analyticsCalculator.buildDailyTrend(records, this.openingInHand);
    this.chartRecords = dailyTrend.map((record, index) => ({
      ...record,
      expenses: records[index].expenses || [],
    }));
    this.areaChart = this.chartGeometryService.buildAreaChart(dailyTrend);
  }

  async downloadReport(): Promise<void> {
    if (this.isGeneratingPdf) {
      return;
    }

    this.isGeneratingPdf = true;
    this.pdfMessage = '';
    let chartImage: string | undefined;
    try {
      chartImage = await this.captureTrendChart();
    } catch (error) {
      console.error('Failed to capture chart for PDF report', error);
      this.pdfMessage = 'Chart image unavailable; the report will be generated without it.';
    }

    try {
      const payload: PdfReportPayload = this.preparePdfReportPayload(chartImage);
      await this.pdfReportService.generateReport(payload);
    } catch (error) {
      console.error('Failed to generate PDF report', error);
      this.pdfMessage = 'Unable to generate the PDF report. Please try again.';
    } finally {
      this.isGeneratingPdf = false;
      this.cd.markForCheck();
    }
  }

  private async captureTrendChart(): Promise<string | undefined> {
    if (!this.trendChart?.nativeElement) {
      return undefined;
    }

    const canvas = await html2canvas(this.trendChart.nativeElement, {
      backgroundColor: '#ffffff',
      scale: 3,
      useCORS: true,
      logging: false,
    });

    return canvas.toDataURL('image/jpeg', 0.92);
  }

  private preparePdfReportPayload(chartImage?: string): PdfReportPayload {
    const reportTitle = 'Analytics Summary Report';
    const generationDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const openingInHand = this.openingInHand;
    const closingInHand = this.chartRecords.length ? this.chartRecords[this.chartRecords.length - 1].inHand : 0;

    return {
      fileName: `Analytics_Report_${this.selectedRange.from}_to_${this.selectedRange.to}.pdf`,
      reportTitle,
      selectedRange: this.selectedRange,
      generationDate,
      openingInHand,
      totalCounter: this.summary.totalCounter,
      totalExpense: this.summary.totalExpenses,
      closingInHand,
      categorySummary: this.categorySummary,
      topTransactions: this.buildTopTransactions(this.chartRecords),
      dateWiseSummary: this.buildDateWiseSummary(this.chartRecords),
      detailedRecords: this.buildDetailedRecords(this.chartRecords),
      paidPendingSummary: {
        paidAmount: this.analyticsData.paidTotal,
        paidCount: this.analyticsData.paidCount,
        pendingAmount: this.analyticsData.pendingTotal,
        paidPercentage: this.analyticsData.paidPercentage,
        pendingPercentage: this.analyticsData.pendingPercentage,
        pendingCount: this.analyticsData.pendingCount,
      },
      paymentModeSummary: this.analyticsData.modeSummary,
      categoryStatusSummary: this.analyticsData.categoryStatusSummary,
      trendChartImage: chartImage,
    };
  }

  private buildCategorySummary(records: DailyRecord[]) {
    const categoryTotals = new Map<string, number>();

    records.forEach((record) => {
      (record.expenses || []).forEach((expense) => {
        const category = this.sanitizeString(expense.category || 'Other');
        const amount = Number(expense.amount || 0);
        categoryTotals.set(category, (categoryTotals.get(category) || 0) + amount);
      });
    });

    const total = Array.from(categoryTotals.values()).reduce((sum, value) => sum + value, 0) || 1;
    return Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: Number(((amount / total) * 100).toFixed(1)),
        color: CATEGORY_COLORS[category] || '#64748b',
      }));
  }

  private buildTopTransactions(records: Array<{ date: string; expenses: Expense[] }>) {
    const transactions = records.flatMap((record) =>
      (record.expenses || []).map((expense) => ({
        date: this.sanitizeString(record.date),
        title: this.sanitizeString(expense.title || expense.category || 'Expense'),
        category: this.sanitizeString(expense.category || 'Other'),
        amount: Number(expense.amount || 0),
        description: this.sanitizeString(expense.description || ''),
        time: this.sanitizeString((expense as any).time || '--'),
        notes: this.sanitizeString(expense.description || '--'),
      }))
    );

    return transactions
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }

  private buildDateWiseSummary(records: Array<{ date: string; counter: number; expense: number; inHand: number; expenses: Expense[] }>) {
    return records.map((record) => ({
      date: this.formatLongDate(record.date),
      counter: record.counter,
      expense: record.expense,
      runningInHand: record.inHand,
      notes: this.sanitizeString(
        record.expenses && record.expenses.length
          ? record.expenses.map((exp) => exp.description || exp.category || 'Expense').join('; ')
          : 'No transactions'
      ),
    }));
  }

  private buildDetailedRecords(records: Array<{ date: string; counter: number; expense: number; inHand: number; expenses: Expense[] }>) {
    let previousInHand = this.openingInHand;

    return records.map((record) => {
      const totalExpense = record.expense;
      const closingInHand = previousInHand + record.counter - totalExpense;
      const detail = {
        date: this.formatLongDate(record.date),
        previousInHand,
        counter: record.counter,
        expenses: (record.expenses || []).map((expense) => ({
          title: this.sanitizeString(expense.title || expense.category || 'Expense'),
          category: this.sanitizeString(expense.category || 'Other'),
          amount: Number(expense.amount || 0),
          description: this.sanitizeString(expense.description || '--'),
          time: this.sanitizeString((expense as any).time || '--'),
          notes: this.sanitizeString(expense.description || '--'),
        })),
        totalExpense,
        closingInHand,
      };

      previousInHand = closingInHand;
      return detail;
    });
  }

  private formatLongDate(dateValue: string): string {
    const dateObj = this.parseDate(dateValue);
    return dateObj.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  showTooltip(point: AreaChartPoint, event: MouseEvent): void {
    this.tooltip.visible = true;
    this.tooltip.date = this.formatLongDate(point.date);
    this.tooltip.counter = this.formatCurrency(point.counter);
    this.tooltip.expense = this.formatCurrency(point.expense);
    this.tooltip.inHand = this.formatCurrency(point.inHand);

    const svgRect = (event.currentTarget as HTMLElement).closest('svg')?.getBoundingClientRect();
    if (svgRect) {
      this.tooltip.x = event.clientX - svgRect.left + 12;
      this.tooltip.y = event.clientY - svgRect.top - 24;
    }
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-IN').format(value);
  }

  private sanitizeString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    let text = String(value);
    text = text.replace(/\r?\n|\r/g, ' ');
    text = text.replace(/&nbsp;/gi, ' ');
    text = text.replace(/&amp;/gi, '&');
    text = text.replace(/&lt;/gi, '<');
    text = text.replace(/&gt;/gi, '>');
    text = text.replace(/&quot;/gi, '"');
    text = text.replace(/&#39;/gi, "'");
    text = text.replace(/&#x2F;/gi, '/');
    text = text.replace(/&[#A-Za-z0-9]+;/g, '');
    text = text.replace(/&/g, '');
    return text.trim();
  }
}
