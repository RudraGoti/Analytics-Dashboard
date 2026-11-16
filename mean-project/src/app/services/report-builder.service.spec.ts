import { ReportBuilderService } from './report-builder.service';

describe('ReportBuilderService', () => {
  let service: ReportBuilderService;

  beforeEach(() => service = new ReportBuilderService());

  it('fills missing dates with zero-valued days', () => {
    const days = service.fillRange([
      { date: '2024-01-02', counter: 50, expenses: [{ title: 'Supplies', category: 'Other', amount: 10, status: 'Paid', mode: 'Cash', description: '' }] },
    ], '2024-01-01', '2024-01-03');

    expect(days.map((day) => day.date)).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
    expect(days[0].counter).toBe(0);
    expect(days[0].totalExpense).toBe(0);
    expect(days[1].totalExpense).toBe(10);
  });

  it('includes the opening balance in the closing total and daily running balance', () => {
    const days = service.fillRange([
      { date: '2024-01-01', counter: 100, expenses: [{ title: 'Supplies', category: 'Other', amount: 25, status: 'Paid', mode: 'Cash', description: '' }] },
    ], '2024-01-01', '2024-01-01');

    expect(service.totals(days, 300).closingInHand).toBe(375);
    expect(service.buildPayload(days, { from: '2024-01-01', to: '2024-01-01' }, 300, 'Shop').dateWiseSummary[0].runningInHand).toBe(375);
    expect(service.buildPayload(days, { from: '2024-01-01', to: '2024-01-01' }, 300, 'Shop').detailedRecords[0].previousInHand).toBe(300);
  });
});
