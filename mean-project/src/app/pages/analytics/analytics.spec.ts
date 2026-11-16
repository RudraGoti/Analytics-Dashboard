import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { DateService } from '../../services/date.service';
import { PdfReportService } from '../../services/pdf-report.service';
import { Analytics } from './analytics';

describe('Analytics', () => {
  let component: Analytics;
  let fixture: ComponentFixture<Analytics>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Analytics],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Analytics);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('seeds the running In Hand balance with the opening balance', () => {
    const range = component.selectedRange;
    const previousRange = new Date(Date.parse(`${range.from}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    http.expectOne((request) => request.url.endsWith('/expenses')
      && request.params.get('dateFrom') === range.from)
      .flush([{ date: range.from, counter: 100, expenses: [{ title: 'Stock', category: 'Other', amount: 25, mode: 'Cash', status: 'Paid', description: '' }] }]);
    http.expectOne((request) => request.url.endsWith('/expenses')
      && request.params.get('dateFrom') === previousRange).flush([]);
    http.expectOne((request) => request.url.endsWith('/expenses/balance')
      && request.params.get('before') === range.from)
      .flush({ before: range.from, totalCounter: 500, totalExpenses: 200, balance: 300 });
    http.expectOne((request) => request.url.endsWith('/expenses/balance')
      && request.params.get('before') === previousRange)
      .flush({ before: previousRange, totalCounter: 400, totalExpenses: 100, balance: 300 });

    expect(component.openingInHand).toBe(300);
    expect(component.chartRecords[0].inHand).toBe(375);
    expect(component.kpiChanges.counter).toBeNull();
  });

  it('still generates the PDF report when the chart element is unavailable', async () => {
    const range = component.selectedRange;
    const previousRange = new Date(Date.parse(`${range.from}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    http.expectOne((request) => request.url.endsWith('/expenses')
      && request.params.get('dateFrom') === range.from).flush([]);
    http.expectOne((request) => request.url.endsWith('/expenses')
      && request.params.get('dateFrom') === previousRange).flush([]);
    http.expectOne((request) => request.url.endsWith('/expenses/balance')
      && request.params.get('before') === range.from)
      .flush({ before: range.from, totalCounter: 0, totalExpenses: 0, balance: 0 });
    http.expectOne((request) => request.url.endsWith('/expenses/balance')
      && request.params.get('before') === previousRange)
      .flush({ before: previousRange, totalCounter: 0, totalExpenses: 0, balance: 0 });

    component.trendChart = undefined;
    const report = vi.spyOn(TestBed.inject(PdfReportService), 'generateReport').mockResolvedValue();
    await component.downloadReport();

    expect(report).toHaveBeenCalledOnce();
    expect(report.mock.calls[0][0].trendChartImage).toBeUndefined();
  });

  it('fetches a previous range with the same number of days', () => {
    const initialRange = component.selectedRange;
    const initialPreviousDate = new Date(Date.parse(`${initialRange.from}T00:00:00Z`) - 86_400_000)
      .toISOString().slice(0, 10);
    http.expectOne((request) => request.url.endsWith('/expenses')
      && request.params.get('dateFrom') === initialRange.from).flush([]);
    http.expectOne((request) => request.url.endsWith('/expenses')
      && request.params.get('dateFrom') === initialPreviousDate).flush([]);
    http.expectOne((request) => request.url.endsWith('/expenses/balance')
      && request.params.get('before') === initialRange.from)
      .flush({ before: initialRange.from, totalCounter: 0, totalExpenses: 0, balance: 0 });
    http.expectOne((request) => request.url.endsWith('/expenses/balance')
      && request.params.get('before') === initialPreviousDate)
      .flush({ before: initialPreviousDate, totalCounter: 0, totalExpenses: 0, balance: 0 });

    TestBed.inject(DateService).setDateRange('2026-03-10', '2026-03-12');

    const currentRequest = http.expectOne((request) => request.url.endsWith('/expenses')
      && request.params.get('dateFrom') === '2026-03-10');
    expect(currentRequest.request.params.get('dateTo')).toBe('2026-03-12');
    const previousRequest = http.expectOne((request) => request.url.endsWith('/expenses')
      && request.params.get('dateFrom') === '2026-03-07');
    expect(previousRequest.request.params.get('dateTo')).toBe('2026-03-09');
    currentRequest.flush([]);
    previousRequest.flush([]);
    http.expectOne((request) => request.url.endsWith('/expenses/balance')
      && request.params.get('before') === '2026-03-10')
      .flush({ before: '2026-03-10', totalCounter: 0, totalExpenses: 0, balance: 0 });
    http.expectOne((request) => request.url.endsWith('/expenses/balance')
      && request.params.get('before') === '2026-03-07')
      .flush({ before: '2026-03-07', totalCounter: 0, totalExpenses: 0, balance: 0 });
  });
});
