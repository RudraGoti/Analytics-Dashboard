import { TestBed } from '@angular/core/testing';
import { DaySummaryService } from './day-summary.service';

describe('DaySummaryService', () => {
  let service: DaySummaryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DaySummaryService);
  });

  it('calculates category and paid/pending totals without assigning modes to pending expenses', () => {
    const summary = service.summarize({
      date: '2026-03-10',
      counter: '1000',
      expenses: [
        { title: 'Stock', category: 'Product Purchase', amount: '300', status: 'Paid', mode: 'UPI' },
        { title: 'Fuel', category: 'Petrol', amount: 200, status: 'Pending', mode: 'Cash' },
        { title: 'Other', amount: 100, status: 'Paid', mode: 'Card' },
      ],
    });

    expect(summary.totalExpenses).toBe(600);
    expect(summary.netPosition).toBe(400);
    expect(summary.paidTotal).toBe(400);
    expect(summary.paidCount).toBe(2);
    expect(summary.pendingTotal).toBe(200);
    expect(summary.pendingCount).toBe(1);
    expect(summary.categoryCount).toBe(3);
    expect(summary.expenses[1]).toMatchObject({ status: 'Pending', mode: null, paidDate: null });
    expect(summary.expenses[0].paidDate).toBe('2026-03-10');
    expect(summary.categories[0]).toMatchObject({
      name: 'Product Purchase',
      count: 1,
      amount: 300,
      percentage: 50,
    });
    expect(summary.modes.map(({ name, amount }) => [name, amount])).toEqual([
      ['Cash', 0],
      ['UPI', 300],
      ['Card', 100],
      ['Bank Transfer', 0],
    ]);
    expect(summary.cashAmount).toBe(0);
    expect(summary.digitalAmount).toBe(400);
  });

  it('defaults missing expense fields and builds an amount-based donut', () => {
    const summary = service.summarize({
      expenses: [
        { title: 'Missing details', amount: 75 },
        { title: 'Rent', category: 'Rent', amount: 25, status: 'Paid', mode: 'Bank Transfer' },
      ],
    });

    expect(summary.expenses[0]).toMatchObject({
      category: 'Other',
      categoryIcon: '📦',
      status: 'Pending',
      mode: null,
    });
    expect(summary.pieGradient).toContain('#64748b 0% 75%');
    expect(summary.pieGradient).toContain('#2563eb 75% 100%');
    expect(summary.cashPercentage).toBe(0);
    expect(summary.digitalPercentage).toBe(100);
    expect(summary.expenseCounterTone).toBe('red');
  });

  it('calculates month totals and previous-day comparisons', () => {
    const current = service.summarize({
      counter: 120,
      expenses: [{ amount: 60, status: 'Pending' }],
    });
    const previous = service.summarize({
      counter: 100,
      expenses: [{ amount: 40, status: 'Pending' }],
    });

    expect(service.summarizeMonth([
      { counter: 120, expenses: [{ amount: 60 }] },
      { counter: 80, expenses: [{ amount: 20 }] },
    ])).toEqual({ counter: 200, totalExpenses: 80, netPosition: 120 });
    expect(service.compare(current, previous)).toMatchObject({
      counter: { percentage: 20, direction: 'up', tone: 'positive' },
      totalExpenses: { percentage: 50, direction: 'up', tone: 'negative' },
      pendingTotal: { percentage: 50, direction: 'up', tone: 'negative' },
    });
  });

  it('filters and sorts all expenses, returning the filtered total', () => {
    const expenses = service.summarize({
      expenses: [
        { title: 'Small paid', amount: 10, status: 'Paid', mode: 'Cash' },
        { title: 'Large paid', amount: 80, status: 'Paid', mode: 'UPI' },
        { title: 'Pending', amount: 30, status: 'Pending', mode: 'UPI' },
      ],
    }).expenses;

    expect(service.filterExpenses(expenses, 'Paid', 'UPI', 'desc')).toEqual({
      expenses: [expect.objectContaining({ title: 'Large paid' })],
      total: 80,
    });
    expect(service.filterExpenses(expenses, '', '', 'asc').expenses.map((expense) => expense.amount))
      .toEqual([10, 30, 80]);
  });

  it('returns a complete zero summary for an empty day', () => {
    const summary = service.summarize(null);

    expect(summary).toMatchObject({
      counter: 0,
      totalExpenses: 0,
      expenseCount: 0,
      netPosition: 0,
      categoryCount: 0,
      paidPercentage: 0,
      pendingPercentage: 0,
      largestExpense: null,
      cashAmount: 0,
      digitalAmount: 0,
      expenseCounterRatio: 0,
      expenseCounterTone: 'green',
    });
    expect(summary.modes).toHaveLength(4);
    expect(summary.categories).toEqual([]);
    expect(service.summarizeMonth(null)).toEqual({ counter: 0, totalExpenses: 0, netPosition: 0 });
  });
});
