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

  it('normalizes expense status and missing payment mode before saving', () => {
    component.expenses = [{
      title: 'Test expense',
      category: 'Rent',
      amount: 10,
      status: 'paid',
      mode: '',
      description: '',
    }];

    component.saveExpenses();

    const request = http.expectOne((req) => req.method === 'POST' && req.url.endsWith('/expenses'));
    expect(request.request.body.expenses[0]).toMatchObject({
      status: 'Paid',
      mode: 'Cash',
    });
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
      mode: 'Cash',
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
