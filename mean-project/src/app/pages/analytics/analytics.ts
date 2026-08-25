import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpenseService, Expense } from '../../services/expense.service';
import { DateService, DateRange } from '../../services/date.service';
import { PdfReportService, PdfReportPayload } from '../../services/pdf-report.service';
import html2canvas from 'html2canvas';

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

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics.html',
  styleUrl: './analytics.css',
})
export class Analytics implements OnInit {
  @ViewChild('trendChart', { static: false }) trendChart?: ElementRef<HTMLElement>;

  selectedDate: string = '';
  selectedRange: DateRange = { from: '', to: '' };

  summary: AnalyticsSummary = {
    totalCounter: 0,
    totalExpenses: 0,
    totalTransactions: 0,
    totalCategories: 0,
  };

  chartSeries: Array<{
    key: 'counter' | 'expense' | 'inHand';
    label: string;
    color: string;
    path: string;
    points: Array<{ x: number; y: number; value: number; date: string; label: string; series: string }>;
  }> = [];

  chartRecords: Array<{
    date: string;
    dayLabel: string;
    monthLabel: string;
    x: number;
    counter: number;
    expense: number;
    inHand: number;
    expenses: Expense[];
  }> = [];

  chartMonthGroups: Array<{ monthLabel: string; startX: number; endX: number; centerX: number; dividerX?: number }> = [];
  categorySummary: Array<{ category: string; amount: number; percentage: number; color: string }> = [];
  topTransactions: Array<{ date: string; title: string; category: string; amount: number; description: string; time: string; notes: string }> = [];
  isLoading = true;
  isGeneratingPdf = false;
  errorMessage = '';

  tooltip = {
    visible: false,
    x: 0,
    y: 0,
    series: '',
    date: '',
    value: '',
  };

  constructor(
    private expenseService: ExpenseService,
    private dateService: DateService,
    private pdfReportService: PdfReportService
  ) {}

  ngOnInit(): void {
    this.dateService.selectedDateRange$.subscribe((range) => {
      this.selectedRange = range;
      this.loadAnalytics(range);
    });
  }

  loadAnalytics(range: DateRange): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.expenseService.getExpensesByDateRange(range.from, range.to).subscribe({
      next: (records: DailyRecord[]) => {
        const orderedRecords = this.normalizeRecords(records || [], range);
        this.summary = this.calculateAnalytics(orderedRecords);
        this.categorySummary = this.buildCategorySummary(orderedRecords);
        this.topTransactions = this.buildTopTransactions(orderedRecords);
        this.buildChartData(orderedRecords);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Failed to load analytics', error);
        this.errorMessage = 'Unable to load analytics right now.';
        this.summary = this.calculateAnalytics([]);
        this.chartSeries = [];
        this.chartRecords = [];
        this.isLoading = false;
      },
    });
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
    const expenses = records.flatMap((record) =>
      (record.expenses || []).map((expense) => ({
        ...expense,
        date: record.date,
      }))
    );

    const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const totalTransactions = expenses.length;
    const totalCounter = records.reduce((sum, record) => sum + (record.counter || 0), 0);

    const categoryCount = new Set(expenses.map((expense) => expense.category || 'Other')).size;

    return {
      totalCounter,
      totalExpenses,
      totalTransactions,
      totalCategories: categoryCount,
    };
  }

  private buildChartData(records: DailyRecord[]): void {
    let runningInHand = 0;
    const chartHeight = 360;
    const margin = { left: 56, right: 56, top: 40, bottom: 82 };
    const stepX = records.length > 1 ? (720 - margin.left - margin.right) / (records.length - 1) : 0;

    this.chartRecords = records.map((record, index) => {
      const expense = (record.expenses || []).reduce(
        (sum, expenseItem) => sum + Number(expenseItem.amount || 0),
        0
      );
      const counter = record.counter || 0;
      runningInHand += counter - expense;

      const dateObj = this.parseDate(record.date);
      const monthLabel = dateObj.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      const dayLabel = String(dateObj.getDate());
      const x = margin.left + index * stepX;

      return {
        date: record.date,
        dayLabel,
        monthLabel,
        x,
        counter,
        expense,
        inHand: runningInHand,
        expenses: record.expenses || [],
      };
    });

    this.chartSeries = this.buildSeries(this.chartRecords, margin, chartHeight);
    this.chartMonthGroups = this.buildMonthGroups(this.chartRecords, stepX, margin.left);
  }

  private buildSeries(
    records: Array<{ date: string; dayLabel: string; monthLabel: string; x: number; counter: number; expense: number; inHand: number }>,
    margin: { left: number; right: number; top: number; bottom: number },
    chartHeight: number
  ) {
    if (!records.length) {
      return [];
    }

    const seriesDefinition = [
      { key: 'counter', label: 'Counter', color: '#2563eb' },
      { key: 'expense', label: 'Expense', color: '#f97316' },
      { key: 'inHand', label: 'In Hand', color: '#10b981' },
    ] as const;

    const allValues = records.flatMap((record) => [record.counter, record.expense, record.inHand]);
    const maxValue = Math.max(...allValues, 1);
    const minValue = Math.min(...allValues, 0);
    const padding = Math.max((maxValue - minValue) * 0.12, 10);
    const innerHeight = chartHeight - margin.top - margin.bottom;
    const valueRange = Math.max(maxValue + padding - (minValue - padding), 1);

    return seriesDefinition.map((series) => {
      const points = records.map((record) => {
        const value = record[series.key];
        const x = record.x;
        const y = margin.top + ((maxValue + padding - value) / valueRange) * innerHeight;

        return {
          x,
          y,
          value,
          date: record.date,
          label: record.dayLabel,
          series: series.label,
        };
      });

      const path = points
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(' ');

      return {
        key: series.key,
        label: series.label,
        color: series.color,
        path,
        points,
      };
    });
  }

  private buildMonthGroups(
    records: Array<{ date: string; dayLabel: string; monthLabel: string; x: number; counter: number; expense: number; inHand: number; expenses: Expense[] }>,
    stepX: number,
    leftMargin: number
  ) {
    const groups: Array<{ monthLabel: string; startX: number; endX: number }> = [];
    let currentGroup: { monthLabel: string; startX: number; endX: number } | null = null;

    records.forEach((record, index) => {
      if (!currentGroup || currentGroup.monthLabel !== record.monthLabel) {
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = {
          monthLabel: record.monthLabel,
          startX: record.x,
          endX: record.x,
        };
      } else {
        currentGroup.endX = record.x;
      }
    });

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups.map((group, index) => ({
      monthLabel: group.monthLabel,
      startX: group.startX,
      endX: group.endX,
      centerX: (group.startX + group.endX) / 2,
      dividerX: index > 0 ? group.startX - stepX / 2 : undefined,
    }));
  }

  async downloadReport(): Promise<void> {
    if (this.isGeneratingPdf) {
      return;
    }

    this.isGeneratingPdf = true;
    try {
      const chartImage = await this.captureTrendChart();
      const payload: PdfReportPayload = this.preparePdfReportPayload(chartImage);
      await this.pdfReportService.generateReport(payload);
    } catch (error) {
      console.error('Failed to generate PDF report', error);
    } finally {
      this.isGeneratingPdf = false;
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

    const openingInHand = 0;
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
    const colors = ['#2563eb', '#f97316', '#10b981', '#7c3aed', '#0ea5e9', '#f59e0b'];

    return Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount], index) => ({
        category,
        amount,
        percentage: Number(((amount / total) * 100).toFixed(1)),
        color: colors[index % colors.length],
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
    let previousInHand = 0;

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

  showTooltip(point: { x: number; y: number; value: number; date: string; label: string; series: string }, event: MouseEvent): void {
    this.tooltip.visible = true;
    this.tooltip.series = point.series;
    this.tooltip.date = new Date(point.date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    this.tooltip.value = point.series === 'Expense' || point.series === 'In Hand'
      ? this.formatCurrency(point.value)
      : this.formatNumber(point.value);

    const svgRect = (event.currentTarget as HTMLElement).closest('svg')?.getBoundingClientRect();
    if (svgRect) {
      this.tooltip.x = event.clientX - svgRect.left + 12;
      this.tooltip.y = event.clientY - svgRect.top - 42;
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
