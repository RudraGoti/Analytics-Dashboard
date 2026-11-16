import { Injectable } from '@angular/core';

export const ANALYTICS_CATEGORIES = [
  'Product Purchase',
  'Rent',
  'Light Bill',
  'Maintenance',
  'Petrol',
  'Other',
] as const;

export const ANALYTICS_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer'] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  'Product Purchase': '#4f46e5',
  Rent: '#2563eb',
  'Light Bill': '#d97706',
  Maintenance: '#059669',
  Petrol: '#dc2626',
  Other: '#64748b',
};

export const CATEGORY_CSS_COLORS: Record<string, string> = {
  'Product Purchase': 'var(--category-product-purchase)',
  Rent: 'var(--category-rent)',
  'Light Bill': 'var(--category-light-bill)',
  Maintenance: 'var(--category-maintenance)',
  Petrol: 'var(--category-petrol)',
  Other: 'var(--category-other)',
};

export type ExpenseFilters = {
  category: string;
  status: string;
  mode: string;
  search: string;
};

export interface AnalyticsExpense {
  date: string;
  title: string;
  category: string;
  amount: number;
  status: string;
  mode: string;
  description: string;
}

export interface AnalyticsCalculation {
  matchedExpenses: AnalyticsExpense[];
  totalExpense: number;
  rangeTotalExpense: number;
  totalCounter: number;
  closingBalance: number;
  averageDailyCounter: number;
  categoryCount: number;
  paidTotal: number;
  paidCount: number;
  pendingTotal: number;
  pendingCount: number;
  averageDailyExpense: number;
  largestExpense: AnalyticsExpense | null;
  categorySummary: Array<{
    category: string;
    transactions: number;
    amount: number;
    percentage: number;
    color: string;
  }>;
  donutGradient: string;
  paidPercentage: number;
  pendingPercentage: number;
  pendingExpenses: AnalyticsExpense[];
  modeSummary: Array<{
    mode: string;
    transactions: number;
    amount: number;
    percentage: number;
  }>;
  categoryStatusSummary: Array<{
    category: string;
    paidAmount: number;
    pendingAmount: number;
    total: number;
  }>;
  categoryStatusTotals: { paidAmount: number; pendingAmount: number; total: number };
  topExpenses: AnalyticsExpense[];
}

export interface DailyTrendValue {
  date: string;
  counter: number;
  expense: number;
  inHand: number;
}

interface ExpenseInput {
  title?: unknown;
  category?: unknown;
  amount?: unknown;
  status?: unknown;
  mode?: unknown;
  description?: unknown;
}

interface DailyExpenseInput {
  date?: unknown;
  counter?: unknown;
  expenses?: ExpenseInput[] | null;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsCalculatorService {
  buildDailyTrend(
    records: DailyExpenseInput[],
    openingInHand: number,
  ): DailyTrendValue[] {
    let inHand = openingInHand;
    return records.map((record) => {
      const counterValue = Number(record.counter);
      const counter = Number.isFinite(counterValue) ? counterValue : 0;
      const expense = (record.expenses || []).reduce((sum, item) => {
        const amount = Number(item.amount);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
      inHand += counter - expense;
      return { date: String(record.date || ''), counter, expense, inHand };
    });
  }

  calculate(
    records: DailyExpenseInput[],
    filters: ExpenseFilters,
    range: { from: string; to: string },
    openingInHand = 0,
  ): AnalyticsCalculation {
    const allExpenses = records.flatMap((record) =>
      (record.expenses || []).map((expense) => this.normalizeExpense(expense, String(record.date || ''))),
    );
    const search = filters.search.trim().toLocaleLowerCase();
    const matchedExpenses = allExpenses.filter((expense) =>
      (!filters.category || expense.category === filters.category)
      && (!filters.status || expense.status === filters.status)
      && (!filters.mode || expense.mode === filters.mode)
      && (!search || `${expense.title} ${expense.description}`.toLocaleLowerCase().includes(search)),
    );

    const paidTotal = matchedExpenses
      .filter((expense) => expense.status === 'Paid')
      .reduce((sum, expense) => sum + expense.amount, 0);
    const pendingExpenses = matchedExpenses.filter((expense) => expense.status === 'Pending');
    const pendingTotal = pendingExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const total = matchedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const rangeTotalExpense = allExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalCounter = records.reduce((sum, record) => {
      const counter = Number(record.counter);
      return sum + (Number.isFinite(counter) ? counter : 0);
    }, 0);
    const daysInRange = this.countDays(range.from, range.to);
    const categories = new Set<string>([
      ...ANALYTICS_CATEGORIES,
      ...matchedExpenses.map((expense) => expense.category),
    ]);

    const categorySummary = [...categories]
      .map((category) => {
        const expenses = matchedExpenses.filter((expense) => expense.category === category);
        const amount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        return {
          category,
          transactions: expenses.length,
          amount,
          percentage: total ? (amount / total) * 100 : 0,
          color: CATEGORY_CSS_COLORS[category] || 'var(--analytics-muted)',
        };
      })
      .sort((a, b) => b.amount - a.amount || this.categoryOrder(a.category) - this.categoryOrder(b.category));

    const modeSummary = ANALYTICS_MODES.map((mode) => {
      const expenses = matchedExpenses.filter((expense) => expense.mode === mode);
      const amount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      return {
        mode,
        transactions: expenses.length,
        amount,
        percentage: total ? (amount / total) * 100 : 0,
      };
    });

    const categoryStatusSummary = [...categories]
      .map((category) => {
        const categoryExpenses = matchedExpenses.filter((expense) => expense.category === category);
        const paidAmount = categoryExpenses
          .filter((expense) => expense.status === 'Paid')
          .reduce((sum, expense) => sum + expense.amount, 0);
        const pendingAmount = categoryExpenses
          .filter((expense) => expense.status === 'Pending')
          .reduce((sum, expense) => sum + expense.amount, 0);
        return { category, paidAmount, pendingAmount, total: paidAmount + pendingAmount };
      })
      .sort((a, b) => this.categoryOrder(a.category) - this.categoryOrder(b.category));
    const categoryStatusTotals = categoryStatusSummary.reduce(
      (totals, row) => ({
        paidAmount: totals.paidAmount + row.paidAmount,
        pendingAmount: totals.pendingAmount + row.pendingAmount,
        total: totals.total + row.total,
      }),
      { paidAmount: 0, pendingAmount: 0, total: 0 },
    );
    let gradientPosition = 0;
    const gradientStops = categorySummary
      .filter((row) => row.percentage > 0)
      .map((row) => {
        const start = gradientPosition;
        gradientPosition += row.percentage;
        return `${row.color} ${start}% ${gradientPosition}%`;
      });

    const largestExpense = matchedExpenses.reduce<AnalyticsExpense | null>(
      (largest, expense) => !largest || expense.amount > largest.amount ? expense : largest,
      null,
    );

    return {
      matchedExpenses,
      totalExpense: total,
      rangeTotalExpense,
      totalCounter,
      closingBalance: openingInHand + totalCounter - rangeTotalExpense,
      averageDailyCounter: daysInRange ? totalCounter / daysInRange : 0,
      categoryCount: new Set(matchedExpenses.map((expense) => expense.category)).size,
      paidTotal,
      paidCount: matchedExpenses.filter((expense) => expense.status === 'Paid').length,
      pendingTotal,
      pendingCount: pendingExpenses.length,
      averageDailyExpense: daysInRange ? total / daysInRange : 0,
      largestExpense,
      categorySummary,
      donutGradient: gradientStops.length
        ? `conic-gradient(${gradientStops.join(', ')})`
        : 'conic-gradient(#e2e8f0 0% 100%)',
      paidPercentage: total ? (paidTotal / total) * 100 : 0,
      pendingPercentage: total ? (pendingTotal / total) * 100 : 0,
      pendingExpenses,
      modeSummary,
      categoryStatusSummary,
      categoryStatusTotals,
      topExpenses: [...matchedExpenses].sort((a, b) => b.amount - a.amount).slice(0, 10),
    };
  }

  private normalizeExpense(expense: ExpenseInput, date: string): AnalyticsExpense {
    const amount = Number(expense.amount);
    return {
      date,
      title: this.stringValue(expense.title) || 'Expense',
      category: this.stringValue(expense.category) || 'Other',
      amount: Number.isFinite(amount) ? amount : 0,
      status: this.stringValue(expense.status) || 'Pending',
      mode: this.stringValue(expense.mode) || 'Cash',
      description: this.stringValue(expense.description),
    };
  }

  private stringValue(value: unknown): string {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  private countDays(from: string, to: string): number {
    const start = Date.parse(`${from}T00:00:00Z`);
    const end = Date.parse(`${to}T00:00:00Z`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      return 0;
    }
    return Math.floor((end - start) / 86_400_000) + 1;
  }

  private categoryOrder(category: string): number {
    const index = ANALYTICS_CATEGORIES.indexOf(category as (typeof ANALYTICS_CATEGORIES)[number]);
    return index < 0 ? ANALYTICS_CATEGORIES.length : index;
  }
}
