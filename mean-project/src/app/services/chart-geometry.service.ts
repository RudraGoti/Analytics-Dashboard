import { Injectable } from '@angular/core';

export interface ChartRecord {
  date: string;
  counter: number;
  expense: number;
  inHand: number;
}

export interface AreaChartPoint extends ChartRecord {
  x: number;
  counterY: number;
  expenseY: number;
}

export interface AreaSeriesGeometry {
  linePath: string;
  areaPath: string;
  points: Array<{ x: number; y: number; record: AreaChartPoint }>;
}

export interface AreaChartGeometry {
  counter: AreaSeriesGeometry;
  expense: AreaSeriesGeometry;
  points: AreaChartPoint[];
  ticks: Array<{ y: number; value: number; label: string }>;
  labels: Array<{ x: number; label: string }>;
  viewBox: string;
  plotBottom: number;
}

export interface DonutEntry {
  category: string;
  amount: number;
  color: string;
}

@Injectable({ providedIn: 'root' })
export class ChartGeometryService {
  buildAreaChart(records: ChartRecord[]): AreaChartGeometry {
    const width = 800;
    const height = 360;
    const plot = { left: 62, right: 24, top: 24, bottom: 42 };
    const plotWidth = width - plot.left - plot.right;
    const plotHeight = height - plot.top - plot.bottom;
    const maxValue = this.niceMaximum(Math.max(1, ...records.flatMap((record) => [record.counter, record.expense])));
    const xStep = records.length > 1 ? plotWidth / (records.length - 1) : 0;

    const points = records.map((record, index) => {
      const x = records.length > 1 ? plot.left + index * xStep : plot.left + plotWidth / 2;
      return {
        ...record,
        x,
        counterY: plot.top + plotHeight * (1 - record.counter / maxValue),
        expenseY: plot.top + plotHeight * (1 - record.expense / maxValue),
      };
    });

    const counterPoints = points.map((point) => ({ x: point.x, y: point.counterY, record: point }));
    const expensePoints = points.map((point) => ({ x: point.x, y: point.expenseY, record: point }));
    const ticks = Array.from({ length: 5 }, (_, index) => {
      const value = maxValue * (1 - index / 4);
      return {
        y: plot.top + (plotHeight * index) / 4,
        value,
        label: this.formatAxisValue(value),
      };
    });

    return {
      counter: this.buildAreaSeries(counterPoints, plot.top + plotHeight),
      expense: this.buildAreaSeries(expensePoints, plot.top + plotHeight),
      points,
      ticks,
      labels: this.buildXLabels(points),
      viewBox: `0 0 ${width} ${height}`,
      plotBottom: plot.top + plotHeight,
    };
  }

  buildGauge(percentage: number): {
    trackPath: string;
    progressPath: string;
    displayPercentage: number;
    progressPercentage: number;
    progressLength: number;
    circumference: number;
    color: string;
  } {
    const progressPercentage = Math.min(100, Math.max(0, percentage));
    const radius = 78;
    const centerX = 100;
    const centerY = 92;
    const trackPath = `M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`;
    const circumference = Math.PI * radius;

    return {
      trackPath,
      progressPath: trackPath,
      displayPercentage: Math.max(0, percentage),
      progressPercentage,
      progressLength: circumference * progressPercentage / 100,
      circumference,
      color: percentage < 60 ? 'var(--analytics-green)' : percentage <= 85 ? 'var(--analytics-orange)' : 'var(--analytics-red)',
    };
  }

  buildDonut(entries: DonutEntry[], total: number): Array<{
    category: string;
    color: string;
    percentage: number;
    path: string;
    leaderPath: string;
    labelX: number;
    labelY: number;
    textAnchor: 'start' | 'end';
    label: string;
  }> {
    const center = { x: 160, y: 140 };
    const radius = 82;
    const ringRadius = 70;
    const filled = entries
      .map((entry) => ({ ...entry, percentage: total > 0 ? (entry.amount / total) * 100 : 0 }))
      .filter((entry) => entry.percentage > 0);

    let angle = -Math.PI / 2;
    const raw = filled.map((entry) => {
      const span = (entry.percentage / 100) * Math.PI * 2;
      const gap = Math.min(0.035, span * 0.12);
      const start = angle + gap / 2;
      const end = angle + span - gap / 2;
      const middle = angle + span / 2;
      angle += span;

      const startPoint = this.polar(center.x, center.y, ringRadius, start);
      const endPoint = this.polar(center.x, center.y, ringRadius, end);
      const middlePoint = this.polar(center.x, center.y, radius + 3, middle);
      const largeArc = end - start > Math.PI ? 1 : 0;
      const path = entry.percentage > 99.999
        ? `M ${center.x} ${center.y - ringRadius} A ${ringRadius} ${ringRadius} 0 1 1 ${center.x} ${center.y + ringRadius} A ${ringRadius} ${ringRadius} 0 1 1 ${center.x} ${center.y - ringRadius}`
        : `M ${startPoint.x.toFixed(2)} ${startPoint.y.toFixed(2)} A ${ringRadius} ${ringRadius} 0 ${largeArc} 1 ${endPoint.x.toFixed(2)} ${endPoint.y.toFixed(2)}`;

      return { ...entry, path, middlePoint, isRight: middlePoint.x >= center.x };
    });

    const right = raw.filter((entry) => entry.isRight);
    const left = raw.filter((entry) => !entry.isRight);

    return raw.map((entry) => {
      const side = entry.isRight ? right : left;
      const sideIndex = side.indexOf(entry);
      const labelY = (sideIndex + 1) * (280 / (side.length + 1));
      const labelX = entry.isRight ? 312 : 8;
      const elbowX = entry.isRight ? 245 : 75;
      const anchorX = entry.isRight ? 238 : 82;
      return {
        category: entry.category,
        color: entry.color,
        percentage: entry.percentage,
        path: entry.path,
        leaderPath: `M ${entry.middlePoint.x.toFixed(2)} ${entry.middlePoint.y.toFixed(2)} L ${elbowX} ${entry.middlePoint.y.toFixed(2)} L ${anchorX} ${labelY.toFixed(2)}`,
        labelX,
        labelY,
        textAnchor: entry.isRight ? 'start' : 'end',
        label: `${entry.category} ${entry.percentage.toFixed(0)}%`,
      };
    });
  }

  buildColumnHeights(values: number[]): number[] {
    const maxValue = Math.max(0, ...values);
    return values.map((value) => maxValue > 0 ? Math.max(0, (value / maxValue) * 100) : 0);
  }

  getPercentage(value: number, total: number): number {
    return total > 0 ? (value / total) * 100 : 0;
  }

  getPercentChange(current: number, previous: number): { percentage: number; isNew: boolean } {
    if (previous === 0) {
      return { percentage: 0, isNew: current !== 0 };
    }
    return { percentage: ((current - previous) / Math.abs(previous)) * 100, isNew: false };
  }

  formatAxisValue(value: number): string {
    const absolute = Math.abs(value);
    if (absolute >= 100_000) {
      const lakhs = value / 100_000;
      return `${Number.isInteger(lakhs) ? lakhs : lakhs.toFixed(1)}L`;
    }
    if (absolute >= 1_000) {
      return `${Math.round(value / 1_000)}K`;
    }
    return String(Math.round(value));
  }

  private buildAreaSeries(
    points: Array<{ x: number; y: number; record: AreaChartPoint }>,
    baseline: number,
  ): AreaSeriesGeometry {
    const linePath = this.buildSmoothPath(points);
    const areaPath = points.length
      ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${baseline} L ${points[0].x.toFixed(2)} ${baseline} Z`
      : '';
    return { linePath, areaPath, points };
  }

  private buildSmoothPath(points: Array<{ x: number; y: number }>): string {
    if (!points.length) {
      return '';
    }
    if (points.length === 1) {
      return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    }

    return points.reduce((path, point, index) => {
      if (index === 0) {
        return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      }
      const previous = points[index - 1];
      const beforePrevious = points[index - 2] || previous;
      const next = points[index + 1] || point;
      const control1 = {
        x: previous.x + (point.x - beforePrevious.x) / 6,
        y: previous.y + (point.y - beforePrevious.y) / 6,
      };
      const control2 = {
        x: point.x - (next.x - previous.x) / 6,
        y: point.y - (next.y - previous.y) / 6,
      };
      return `${path} C ${control1.x.toFixed(2)} ${control1.y.toFixed(2)}, ${control2.x.toFixed(2)} ${control2.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }, '');
  }

  private buildXLabels(points: AreaChartPoint[]): Array<{ x: number; label: string }> {
    if (!points.length) {
      return [];
    }
    const stride = Math.max(1, Math.ceil(points.length / 10));
    const selected = points.filter((_, index) => index % stride === 0 || index === points.length - 1);
    return selected.map((point) => ({
      x: point.x,
      label: new Date(`${point.date}T00:00:00`).getDate().toString(),
    }));
  }

  private niceMaximum(value: number): number {
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const normalized = value / magnitude;
    const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return nice * magnitude;
  }

  private polar(cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  }
}
