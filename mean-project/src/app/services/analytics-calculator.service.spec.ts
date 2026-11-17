import { TestBed } from '@angular/core/testing';
import { AnalyticsCalculatorService } from './analytics-calculator.service';

describe('AnalyticsCalculatorService', () => {
  let calculator: AnalyticsCalculatorService;

  beforeEach(() => {
    calculator = TestBed.inject(AnalyticsCalculatorService);
  });

  it('calculates category totals, transaction counts, percentages, and consistent colors', () => {
    const result = calculator.calculate([
      { date: '2026-01-01', expenses: [
        { title: 'Stock', category: 'Product Purchase', amount: '300', status: 'Paid', mode: 'UPI' },
        { title: 'Fuel', category: 'Petrol', amount: 100, status: 'Pending', mode: 'Cash' },
      ] },
    ], { category: '', status: '', mode: '', search: '' }, { from: '2026-01-01', to: '2026-01-01' });

    expect(result.categorySummary[0]).toMatchObject({
      category: 'Product Purchase', transactions: 1, amount: 300, percentage: 75,
      color: 'var(--category-product-purchase)',
    });
    expect(result.categorySummary.find((row) => row.category === 'Petrol')).toMatchObject({
      transactions: 1, amount: 100, percentage: 25,
    });
    expect(result.paidTotal).toBe(300);
    expect(result.paidCount).toBe(1);
    expect(result.pendingTotal).toBe(100);
    expect(result.modeSummary.find((row) => row.mode === 'UPI')).toMatchObject({
      amount: 300, transactions: 1, percentage: 100,
    });
    expect(result.categoryStatusSummary.find((row) => row.category === 'Product Purchase')).toMatchObject({
      paidAmount: 300, pendingAmount: 0, total: 300,
    });
  });

  it('applies status and mode totals, missing-field defaults, and title/description filters', () => {
    const result = calculator.calculate([
      { date: '2026-01-01', expenses: [
        { title: 'Office supplies', description: 'Paper order', amount: 90, status: 'Paid', mode: 'UPI' },
        { title: 'Rent', category: 'Rent', description: 'Office', amount: 500, status: 'Pending', mode: 'Cash' },
        { title: 'Other', description: 'Small cash item', amount: 10 },
      ] },
    ], { category: 'Rent', status: 'Pending', mode: '', search: 'office' },
    { from: '2026-01-01', to: '2026-01-02' });
    expect(result.matchedExpenses).toHaveLength(1);
    expect(result.matchedExpenses[0]).toMatchObject({ category: 'Rent', status: 'Pending', mode: '' });
    expect(result.pendingTotal).toBe(500);
    expect(result.pendingCount).toBe(1);
    expect(result.averageDailyExpense).toBe(250);
    expect(result.modeSummary.find((row) => row.mode === 'Cash')).toMatchObject({
      amount: 0, transactions: 0, percentage: 0,
    });

    const defaults = calculator.calculate([
      { date: '2026-01-01', expenses: [{ title: 'Other', description: 'Small cash item', amount: 10 }] },
    ], { category: '', status: '', mode: '', search: 'small cash item' },
    { from: '2026-01-01', to: '2026-01-01' });
    expect(defaults.matchedExpenses[0]).toMatchObject({ category: 'Other', status: 'Pending', mode: '' });
  });

  it('preserves bill attachment fields for analytics expenses', () => {
    const result = calculator.calculate([
      { date: '2026-01-01', expenses: [{
        title: 'Office supplies',
        amount: 90,
        status: 'Paid',
        billData: 'aGVsbG8=',
        billContentType: 'image/png',
        billFileName: 'receipt.png',
      }] },
    ], { category: '', status: '', mode: '', search: '' }, { from: '2026-01-01', to: '2026-01-01' });

    expect(result.matchedExpenses[0]).toMatchObject({
      billData: 'aGVsbG8=',
      billContentType: 'image/png',
      billFileName: 'receipt.png',
    });
  });

  it('returns zeroed category, mode, and category-status tables for empty data', () => {
    const result = calculator.calculate([], { category: '', status: '', mode: '', search: '' },
      { from: '2026-01-01', to: '2026-01-01' });

    expect(result.matchedExpenses).toEqual([]);
    expect(result.paidTotal).toBe(0);
    expect(result.pendingTotal).toBe(0);
    expect(result.largestExpense).toBeNull();
    expect(result.categorySummary.every((row) => row.amount === 0 && row.percentage === 0)).toBe(true);
    expect(result.modeSummary).toHaveLength(4);
    expect(result.modeSummary.every((row) => row.amount === 0 && row.transactions === 0)).toBe(true);
    expect(result.categoryStatusSummary.every((row) => row.total === 0)).toBe(true);
  });
});
