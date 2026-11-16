import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DateService } from '../../services/date.service';
import { DaySummaryService } from '../../services/day-summary.service';
import { Dashboard } from './dashboard';
import { vi } from 'vitest';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(DateService).setSingleDate('2025-03-10');
    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.match((request) => request.url.endsWith('/expenses'))
      .forEach((request) => request.flush(request.request.params.has('date') ? null : []));
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('should create', () => expect(component).toBeTruthy());

  it('shows four zero-valued KPIs and an empty expense table when there is no entry', () => {
    expect(component.summary.counter).toBe(0);
    expect(component.summary.totalExpenses).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.summary-grid .dash-card')).toHaveLength(4);
    expect(fixture.nativeElement.textContent).toContain('All expenses of the day');
    expect(fixture.nativeElement.textContent).toContain('No expenses recorded for this date.');
    expect(fixture.nativeElement.textContent).not.toContain('Add entry for this date');
  });

  it('shows four summary cards without the categories-used card', () => {
    const summaryCards = fixture.nativeElement.querySelectorAll('.summary-grid .dash-card:not(.skeleton-card)');

    expect(summaryCards).toHaveLength(4);
    expect(fixture.nativeElement.textContent).not.toContain('Categories used');
    expect(fixture.nativeElement.textContent).not.toContain('Daily overview');
    expect(fixture.nativeElement.querySelector('.dashboard-heading')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.expenses-panel')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).not.toContain('Paid vs Pending');
    expect(fixture.nativeElement.textContent).not.toContain('Expenses by category');
    expect(fixture.nativeElement.textContent).not.toContain('Payment modes');
    expect(fixture.nativeElement.textContent).not.toContain('Highlights');
    expect(fixture.nativeElement.textContent).not.toContain('Month to date');
    expect(component.loadingCards).toHaveLength(4);
  });

  it('ignores a late response for the previously selected date', () => {
    const dateService = TestBed.inject(DateService);
    dateService.setSingleDate('2025-03-11');
    const previousDateRequests = http.match((request) => request.url.endsWith('/expenses'));

    dateService.setSingleDate('2025-03-12');
    const selectedDateRequests = http.match((request) => request.url.endsWith('/expenses'));
    selectedDateRequests.forEach((request) => {
      const { params } = request.request;
      if (params.get('date') === '2025-03-12') {
        request.flush({ counter: 200, expenses: [{ amount: 40, status: 'Paid' }] });
      } else if (params.has('date')) {
        request.flush({ counter: 100, expenses: [] });
      } else {
        request.flush([]);
      }
    });

    previousDateRequests.forEach((request) => {
      if (request.request.params.has('date')) {
        request.flush({ counter: 500, expenses: [] });
      } else {
        request.flush([]);
      }
    });
    fixture.detectChanges();

    expect(component.selectedDate).toBe('2025-03-12');
    expect(component.summary.counter).toBe(200);
  });

  it('records a payment mode and an explicitly selected paid date', () => {
    const expenseId = '65f000000000000000000001';
    component.summary = TestBed.inject(DaySummaryService).summarize({
      date: '2025-03-10',
      expenses: [{ _id: expenseId, title: 'Rent', category: 'Rent', amount: 100, status: 'Pending', mode: 'Cash' }],
    });
    component.applyExpenseFilters();
    const expense = component.summary.expenses[0];
    component.openPaymentForm(expense);
    component.paymentDate = '2025-03-12';
    component.paymentMode = 'UPI';
    component.confirmPayment(expense);

    const paymentRequest = http.expectOne((request) =>
      request.method === 'PATCH' && request.url.endsWith(`/2025-03-10/expenses/${expenseId}/payment`));
    expect(paymentRequest.request.body).toEqual({ paidDate: '2025-03-12', mode: 'UPI' });
    paymentRequest.flush({ success: true });

    http.match((request) => request.url.endsWith('/expenses'))
      .forEach((request) => request.flush(request.request.params.get('date') === '2025-03-10'
        ? { date: '2025-03-10', expenses: [{ _id: expenseId, title: 'Rent', category: 'Rent', amount: 100, status: 'Paid', mode: 'UPI', paidDate: '2025-03-12' }] }
        : null));
    fixture.detectChanges();

    expect(component.summary.expenses[0]).toMatchObject({ status: 'Paid', mode: 'UPI', paidDate: '2025-03-12' });
  });

  it('opens an attached bill in the side preview with its description', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:bill-preview');
    component.summary = TestBed.inject(DaySummaryService).summarize({
      expenses: [{
        title: 'Supplies',
        category: 'Other',
        amount: 50,
        status: 'Paid',
        mode: 'Card',
        billData: 'aGVsbG8=',
        billContentType: 'image/png',
        billFileName: 'receipt.png',
        description: 'Office supplies receipt',
      }],
    });
    component.openBillPreview(component.summary.expenses[0]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.bill-preview-panel')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.bill-preview-document img').getAttribute('src'))
      .toBe('blob:bill-preview');
    expect(fixture.nativeElement.querySelector('.bill-preview-description').textContent)
      .toContain('Office supplies receipt');
    expect(fixture.nativeElement.querySelector('.expenses-workspace').classList)
      .toContain('has-bill-preview');

    fixture.nativeElement.querySelector('.close-preview-button').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.bill-preview-panel')).toBeNull();
    expect(fixture.nativeElement.querySelector('.expenses-workspace').classList)
      .not.toContain('has-bill-preview');
  });
});
