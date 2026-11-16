import { ChartGeometryService } from './chart-geometry.service';

describe('ChartGeometryService', () => {
  let geometry: ChartGeometryService;

  beforeEach(() => {
    geometry = new ChartGeometryService();
  });

  it('builds smooth area paths, axes, and date labels for the trend chart', () => {
    const chart = geometry.buildAreaChart([
      { date: '2026-03-01', counter: 70_000, expense: 25_000, inHand: 45_000 },
      { date: '2026-03-02', counter: 90_000, expense: 30_000, inHand: 105_000 },
    ]);

    expect(chart.counter.linePath).toContain('C');
    expect(chart.expense.areaPath).toContain('Z');
    expect(chart.ticks[0].label).toBe('1L');
    expect(chart.labels.map((label) => label.label)).toEqual(['1', '2']);
  });

  it('builds a clamped, threshold-colored gauge and handles empty/zero values', () => {
    expect(geometry.buildGauge(50)).toMatchObject({
      displayPercentage: 50, progressPercentage: 50, color: 'var(--analytics-green)',
    });
    expect(geometry.buildGauge(72).color).toBe('var(--analytics-orange)');
    expect(geometry.buildGauge(90).color).toBe('var(--analytics-red)');
    expect(geometry.buildGauge(130).progressPercentage).toBe(100);
    expect(geometry.buildAreaChart([]).counter.linePath).toBe('');
  });

  it('creates rounded donut segments, proportional bars, and percentage changes', () => {
    const segments = geometry.buildDonut([
      { category: 'Rent', amount: 75, color: 'var(--category-rent)' },
      { category: 'Other', amount: 25, color: 'var(--category-other)' },
    ], 100);

    expect(segments).toHaveLength(2);
    expect(segments[0].percentage).toBe(75);
    expect(segments[0].path).toContain('A');
    expect(geometry.buildColumnHeights([20, 10, 40])).toEqual([50, 25, 100]);
    expect(geometry.getPercentage(25, 100)).toBe(25);
    expect(geometry.getPercentChange(125, 100)).toEqual({ percentage: 25, isNew: false });
    expect(geometry.getPercentChange(50, 0)).toEqual({ percentage: 0, isNew: true });
  });
});
