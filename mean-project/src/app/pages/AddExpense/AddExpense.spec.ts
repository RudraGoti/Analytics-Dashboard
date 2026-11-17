import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AddExpense } from './AddExpense';

describe('AddExpense', () => {
  let component: AddExpense;
  let fixture: ComponentFixture<AddExpense>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddExpense],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AddExpense);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith('/expenses') && request.params.has('date')).flush(null);
  });

  afterEach(() => http.verify());

  it('should create with an empty row and zero counter when no record exists', () => {
    expect(component).toBeTruthy();
    expect(component.counter).toBe(0);
    expect(component.expenses.length).toBe(1);
    expect(component.expenses[0].isOldEntry).toBe(false);
  });

  it('requires a payment mode before saving a paid expense', () => {
    component.expenses = [{
      title: 'Test expense',
      category: 'Rent',
      amount: 10,
      status: 'paid',
      mode: '',
      description: '',
    }];

    component.saveExpenses();

    expect(component.syncError).toBe(true);
    expect(component.syncErrorMessage).toContain('payment mode');
    http.expectNone((req) => req.method === 'POST' && req.url.endsWith('/expenses'));
  });

  it('removes payment mode and paid date when an expense is pending', () => {
    component.expenses = [{
      title: 'Test expense',
      category: 'Rent',
      amount: 10,
      status: 'Paid',
      mode: 'Cash',
      paidDate: '2025-03-10',
      description: '',
    }];
    component.selectStatus(0, 'Pending');

    expect(component.expenses[0].mode).toBe('');
    expect(component.expenses[0].paidDate).toBe('');
  });

  it('starts new pending expenses without a payment mode', () => {
    expect(component.expenses[0].status).toBe('Pending');
    expect(component.expenses[0].mode).toBe('');
  });

  it('sets the entry date when marking a bill paid and leaves the mode unselected', () => {
    component.selectStatus(0, 'Paid');
    fixture.detectChanges();

    expect(component.expenses[0].paidDate).toBe(component.selectedDate);
    expect(component.expenses[0].mode).toBe('');
    expect(fixture.nativeElement.querySelector('.paid-date-input')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.no-payment-mode')).toBeNull();
  });

  it('surfaces save errors from the server', () => {
    component.expenses = [{
      title: 'Test expense',
      category: 'Rent',
      amount: 10,
      status: 'Paid',
      mode: 'Cash',
      paidDate: '2025-03-10',
      description: '',
    }];

    component.saveExpenses();
    const request = http.expectOne((req) => req.method === 'POST' && req.url.endsWith('/expenses'));
    request.flush({ success: false, error: 'Test response' }, { status: 400, statusText: 'Bad Request' });
    expect(component.syncError).toBe(true);
    expect(component.syncErrorMessage).toBe('Test response');
  });

  it('explains that MongoDB is unavailable when the save endpoint returns 503', () => {
    component.expenses = [{
      title: 'Test expense',
      category: 'Rent',
      amount: 10,
      status: 'Pending',
      mode: '',
      description: '',
    }];

    component.saveExpenses();
    const request = http.expectOne((req) => req.method === 'POST' && req.url.endsWith('/expenses'));
    request.flush(
      { success: false, error: 'Database is unavailable.' },
      { status: 503, statusText: 'Service Unavailable' },
    );

    expect(component.syncErrorMessage).toContain('MongoDB connection');
  });
});
