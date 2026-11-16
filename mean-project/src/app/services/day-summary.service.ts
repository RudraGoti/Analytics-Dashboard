import { Injectable } from '@angular/core';

export const DAY_CATEGORIES = [
  'Product Purchase',
  'Rent',
  'Light Bill',
  'Maintenance',
  'Petrol',
  'Other',
] as const;

export const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer'] as const;

export const DAY_CATEGORY_COLORS: Record<string, string> = {
  'Product Purchase': '#4f46e5',
  Rent: '#2563eb',
  'Light Bill': '#d97706',
  Maintenance: '#059669',
  Petrol: '#dc2626',
  Other: '#64748b',
};

const CATEGORY_ICONS: Record<string, string> = {
  'Product Purchase': '🛒',
  Rent: '🏠',
  'Light Bill': '💡',
  Maintenance: '🛠️',
  Petrol: '⛽',
  Other: '📦',
};

export interface DayExpense {
  title: string;
  category: string;
  categoryIcon: string;
  amount: number;
  status: 'Paid' | 'Pending';
  mode: (typeof PAYMENT_MODES)[number];
  description: string;
}

export interface DailyExpenseRecord {
  counter?: unknown;
  expenses?: unknown;
}

export interface CategorySummary {
  name: string;
  icon: string;
  color: string;
  count: number;
  amount: number;
  percentage: number;
}

export interface ModeSummary {
  name: (typeof PAYMENT_MODES)[number];
  amount: number;
  count: number;
  percentage: number;
}

export interface DaySummary {
  counter: number;
  totalExpenses: number;
  expenseCount: number;
  netPosition: number;
  paidTotal: number;
  paidCount: number;
  pendingTotal: number;
  pendingCount: number;
  categoryCount: number;
  expenses: DayExpense[];
  categories: CategorySummary[];
  modes: ModeSummary[];
  pieGradient: string;
  paidPercentage: number;
  pendingPercentage: number;
  largestExpense: DayExpense | null;
  cashAmount: number;
  digitalAmount: number;
  cashPercentage: number;
  digitalPercentage: number;
  expenseCounterRatio: number;
  expenseCounterProgress: number;
  expenseCounterTone: 'green' | 'orange' | 'red';
}

export interface MonthSummary {
  counter: number;
  totalExpenses: number;
  netPosition: number;
}

export interface DayComparisonValue {
  percentage: number;
  direction: 'up' | 'down';
  tone: 'positive' | 'negative' | 'neutral';
  isNew: boolean;
}

export interface DayComparison {
  counter: DayComparisonValue;
  totalExpenses: DayComparisonValue;
  netPosition: DayComparisonValue;
  pendingTotal: DayComparisonValue;
  categoryCount: DayComparisonValue;
}

@Injectable({ providedIn: 'root' })
export class DaySummaryService {
  summarize(record: DailyExpenseRecord | null): DaySummary {
    const expenses = this.normalizeExpenses(record?.expenses);
    const counter = this.toAmount(record?.counter);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const paidExpenses = expenses.filter((expense) => expense.status === 'Paid');
    const pendingExpenses = expenses.filter((expense) => expense.status === 'Pending');
    const paidTotal = this.sumAmounts(paidExpenses);
    const pendingTotal = this.sumAmounts(pendingExpenses);
    const categories = this.buildCategories(expenses, totalExpenses);
    const modes = this.buildModes(expenses, totalExpenses);
    const cashAmount = modes.find((mode) => mode.name === 'Cash')?.amount || 0;
    const digitalAmount = totalExpenses - cashAmount;
    const expenseCounterRatio = counter > 0
      ? (totalExpenses / counter) * 100
      : totalExpenses > 0 ? 100 : 0;

    return {
      counter,
      totalExpenses,
      expenseCount: expenses.length,
      netPosition: counter - totalExpenses,
      paidTotal,
      paidCount: paidExpenses.length,
      pendingTotal,
      pendingCount: pendingExpenses.length,
      categoryCount: categories.length,
      expenses,
      categories,
      modes,
      pieGradient: this.buildPieGradient(categories),
      paidPercentage: totalExpenses ? (paidTotal / totalExpenses) * 100 : 0,
      pendingPercentage: totalExpenses ? (pendingTotal / totalExpenses) * 100 : 0,
      largestExpense: expenses.reduce<DayExpense | null>(
        (largest, expense) => !largest || expense.amount > largest.amount ? expense : largest,
        null,
      ),
      cashAmount,
      digitalAmount,
      cashPercentage: totalExpenses ? (cashAmount / totalExpenses) * 100 : 0,
      digitalPercentage: totalExpenses ? (digitalAmount / totalExpenses) * 100 : 0,
      expenseCounterRatio,
      expenseCounterProgress: Math.min(expenseCounterRatio, 100),
      expenseCounterTone: expenseCounterRatio < 60 ? 'green' : expenseCounterRatio <= 85 ? 'orange' : 'red',
    };
  }

  summarizeMonth(records: readonly DailyExpenseRecord[] | null): MonthSummary {
    const totals = (records || []).reduce<MonthSummary>(
      (summary, record) => {
        const day = this.summarize(record);
        summary.counter += day.counter;
        summary.totalExpenses += day.totalExpenses;
        return summary;
      },
      { counter: 0, totalExpenses: 0, netPosition: 0 },
    );
    totals.netPosition = totals.counter - totals.totalExpenses;
    return totals;
  }

  compare(current: DaySummary, previous: DaySummary): DayComparison {
    return {
      counter: this.comparisonValue(current.counter, previous.counter, 'positive'),
      totalExpenses: this.comparisonValue(current.totalExpenses, previous.totalExpenses, 'negative'),
      netPosition: this.comparisonValue(current.netPosition, previous.netPosition, 'positive'),
      pendingTotal: this.comparisonValue(current.pendingTotal, previous.pendingTotal, 'negative'),
      categoryCount: this.comparisonValue(current.categoryCount, previous.categoryCount, 'neutral'),
    };
  }

  filterExpenses(
    expenses: readonly DayExpense[],
    status: string,
    mode: string,
    amountSort: 'asc' | 'desc',
  ): { expenses: DayExpense[]; total: number } {
    const filteredExpenses = expenses
      .filter((expense) => !status || expense.status === status)
      .filter((expense) => !mode || expense.mode === mode)
      .sort((left, right) => amountSort === 'asc'
        ? left.amount - right.amount
        : right.amount - left.amount);

    return {
      expenses: filteredExpenses,
      total: this.sumAmounts(filteredExpenses),
    };
  }

  private normalizeExpenses(value: unknown): DayExpense[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((expense) => {
        const category = this.normalizeCategory(expense['category']);
        const status = String(expense['status'] ?? '').toLowerCase() === 'paid' ? 'Paid' : 'Pending';
        const mode = this.normalizeMode(expense['mode']);

        return {
          title: typeof expense['title'] === 'string' ? expense['title'] : '',
          category,
          categoryIcon: CATEGORY_ICONS[category],
          amount: this.toAmount(expense['amount']),
          status,
          mode,
          description: typeof expense['description'] === 'string' ? expense['description'] : '',
        };
      });
  }

  private normalizeCategory(value: unknown): string {
    const category = typeof value === 'string' ? value.trim() : '';
    return Object.prototype.hasOwnProperty.call(DAY_CATEGORY_COLORS, category) ? category : 'Other';
  }

  private normalizeMode(value: unknown): (typeof PAYMENT_MODES)[number] {
    const mode = typeof value === 'string'
      ? PAYMENT_MODES.find((item) => item.toLowerCase() === value.trim().toLowerCase())
      : undefined;
    return mode || 'Cash';
  }

  private buildCategories(expenses: readonly DayExpense[], total: number): CategorySummary[] {
    const categories = new Map<string, CategorySummary>();
    for (const expense of expenses) {
      const summary = categories.get(expense.category) || {
        name: expense.category,
        icon: expense.categoryIcon,
        color: DAY_CATEGORY_COLORS[expense.category],
        count: 0,
        amount: 0,
        percentage: 0,
      };
      summary.count += 1;
      summary.amount += expense.amount;
      categories.set(expense.category, summary);
    }

    return [...categories.values()]
      .map((category) => ({
        ...category,
        percentage: total ? (category.amount / total) * 100 : 0,
      }))
      .sort((left, right) => right.amount - left.amount);
  }

  private buildModes(expenses: readonly DayExpense[], total: number): ModeSummary[] {
    return PAYMENT_MODES.map((name) => {
      const matching = expenses.filter((expense) => expense.mode === name);
      const amount = this.sumAmounts(matching);
      return {
        name,
        amount,
        count: matching.length,
        percentage: total ? (amount / total) * 100 : 0,
      };
    });
  }

  private buildPieGradient(categories: readonly CategorySummary[]): string {
    if (!categories.length) {
      return 'conic-gradient(#e5e7eb 0% 100%)';
    }

    let start = 0;
    const segments = categories.map((category) => {
      const end = start + category.percentage;
      const segment = `${category.color} ${start}% ${end}%`;
      start = end;
      return segment;
    });
    return `conic-gradient(${segments.join(', ')})`;
  }

  private comparisonValue(
    current: number,
    previous: number,
    increaseTone: 'positive' | 'negative' | 'neutral',
  ): DayComparisonValue {
    const delta = current - previous;
    const isNew = previous === 0 && current !== 0;
    const percentage = previous === 0 ? 0 : (Math.abs(delta) / Math.abs(previous)) * 100;
    const direction = delta < 0 ? 'down' : 'up';
    const tone = increaseTone === 'neutral'
      ? 'neutral'
      : delta === 0 ? 'neutral' : delta > 0 ? increaseTone : increaseTone === 'positive' ? 'negative' : 'positive';

    return { percentage, direction, tone, isNew };
  }

  private toAmount(value: unknown): number {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
  }

  private sumAmounts(expenses: readonly Pick<DayExpense, 'amount'>[]): number {
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  }
}
