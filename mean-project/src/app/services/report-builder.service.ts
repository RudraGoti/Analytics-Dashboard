import { Injectable } from '@angular/core';
import { Expense } from './expense.service';
import { PdfReportPayload } from './pdf-report.service';
import {
  ANALYTICS_CATEGORIES,
  ANALYTICS_MODES,
  CATEGORY_COLORS,
} from './analytics-calculator.service';

export interface ReportRecord {
  date: string;
  counter?: number;
  expenses?: Expense[];
}

export interface ReportDay {
  date: string;
  counter: number;
  expenses: Expense[];
  totalExpense: number;
  transactionCount: number;
}

@Injectable({ providedIn: 'root' })
export class ReportBuilderService {
  fillRange(records: ReportRecord[], from: string, to: string): ReportDay[] {
    const recordMap = new Map(records.map((record) => [record.date, record]));
    const days: ReportDay[] = [];
    const current = this.parseDate(from);
    const last = this.parseDate(to);

    while (current <= last) {
      const date = this.formatDate(current);
      const record = recordMap.get(date);
      const expenses = record?.expenses || [];
      days.push({
        date,
        counter: Number(record?.counter || 0),
        expenses,
        totalExpense: expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
        transactionCount: expenses.length,
      });
      current.setDate(current.getDate() + 1);
    }
    return days;
  }

  totals(days: ReportDay[], openingInHand: number) {
    const totalCounter = days.reduce((sum, day) => sum + day.counter, 0);
    const totalExpenses = days.reduce((sum, day) => sum + day.totalExpense, 0);
    const transactions = days.reduce((sum, day) => sum + day.transactionCount, 0);
    const categories = new Set(days.flatMap((day) => day.expenses.map((expense) => expense.category || 'Other'))).size;
    return {
      openingInHand,
      totalCounter,
      totalExpenses,
      closingInHand: openingInHand + totalCounter - totalExpenses,
      transactions,
      categories,
    };
  }

  buildPayload(
    days: ReportDay[],
    selectedRange: { from: string; to: string },
    openingInHand: number,
    businessName: string,
  ): PdfReportPayload {
    const summary = this.totals(days, openingInHand);
    const categoryTotals = new Map<string, number>();
    days.forEach((day) => day.expenses.forEach((expense) => {
      const category = expense.category || 'Other';
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + Number(expense.amount || 0));
    }));
    const categorySummary = Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: summary.totalExpenses ? Number(((amount / summary.totalExpenses) * 100).toFixed(1)) : 0,
        color: CATEGORY_COLORS[category] || '#64748b',
      }));
    const expenses = days.flatMap((day) => day.expenses.map((expense) => ({
      ...expense,
      category: expense.category || 'Other',
      amount: Number(expense.amount || 0),
      status: expense.status || 'Pending',
      mode: expense.status === 'Paid' ? expense.mode || '' : '',
    })));
    const paidAmount = expenses
      .filter((expense) => expense.status === 'Paid')
      .reduce((sum, expense) => sum + expense.amount, 0);
    const pendingAmount = expenses
      .filter((expense) => expense.status === 'Pending')
      .reduce((sum, expense) => sum + expense.amount, 0);
    const paymentModeSummary = ANALYTICS_MODES.map((mode) => {
      const modeExpenses = expenses.filter((expense) => expense.status === 'Paid' && expense.mode === mode);
      const amount = modeExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      return {
        mode,
        transactions: modeExpenses.length,
        amount,
        percentage: paidAmount ? (amount / paidAmount) * 100 : 0,
      };
    });
    const categoryStatusSummary = ANALYTICS_CATEGORIES.map((category) => {
      const categoryExpenses = expenses.filter((expense) => expense.category === category);
      const paid = categoryExpenses.filter((expense) => expense.status === 'Paid')
        .reduce((sum, expense) => sum + expense.amount, 0);
      const pending = categoryExpenses.filter((expense) => expense.status === 'Pending')
        .reduce((sum, expense) => sum + expense.amount, 0);
      return { category, paidAmount: paid, pendingAmount: pending, total: paid + pending };
    });

    let runningInHand = openingInHand;
    const dateWiseSummary = days.map((day) => {
      runningInHand += day.counter - day.totalExpense;
      return {
        date: this.formatLongDate(day.date),
        counter: day.counter,
        expense: day.totalExpense,
        runningInHand,
        notes: day.expenses.length ? day.expenses.map((expense) => expense.description || expense.title).filter(Boolean).join('; ') : 'No transactions',
      };
    });

    let previousInHand = openingInHand;
    const detailedRecords = days.map((day) => {
      const closingInHand = previousInHand + day.counter - day.totalExpense;
      const detail = {
        date: this.formatLongDate(day.date),
        previousInHand,
        counter: day.counter,
        expenses: day.expenses.map((expense) => ({
          title: expense.title,
          category: expense.category || 'Other',
          amount: Number(expense.amount || 0),
          description: expense.description || '',
          time: '--',
          notes: expense.description || '',
        })),
        totalExpense: day.totalExpense,
        closingInHand,
      };
      previousInHand = closingInHand;
      return detail;
    });
    const topTransactions = days.flatMap((day) => day.expenses.map((expense) => ({
      date: this.formatLongDate(day.date),
      title: expense.title,
      category: expense.category || 'Other',
      amount: Number(expense.amount || 0),
      description: expense.description || '',
      time: '--',
      notes: expense.description || '',
    }))).sort((a, b) => b.amount - a.amount).slice(0, 8);

    return {
      fileName: `Expense_Report_${selectedRange.from}_to_${selectedRange.to}.pdf`,
      reportTitle: `${businessName || 'Business'} Expense Report`,
      businessName: businessName || 'Business',
      selectedRange,
      generationDate: this.formatLongDate(this.formatDate(new Date())),
      openingInHand,
      totalCounter: summary.totalCounter,
      totalExpense: summary.totalExpenses,
      closingInHand: summary.closingInHand,
      categorySummary,
      topTransactions,
      dateWiseSummary,
      detailedRecords,
      paidPendingSummary: {
        paidAmount,
        paidCount: expenses.filter((expense) => expense.status === 'Paid').length,
        pendingAmount,
        paidPercentage: summary.totalExpenses ? (paidAmount / summary.totalExpenses) * 100 : 0,
        pendingPercentage: summary.totalExpenses ? (pendingAmount / summary.totalExpenses) * 100 : 0,
        pendingCount: expenses.filter((expense) => expense.status === 'Pending').length,
      },
      paymentModeSummary,
      categoryStatusSummary,
    };
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private formatLongDate(value: string): string {
    return this.parseDate(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
