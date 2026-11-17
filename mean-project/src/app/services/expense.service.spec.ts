import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ExpenseService } from './expense.service';

describe('ExpenseService', () => {
  let service: ExpenseService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ExpenseService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('stores bill attachments and clears mode from pending expenses', async () => {
    const file = new File(['bill contents'], 'receipt.png', { type: 'image/png' });
    const result = firstValueFrom(service.saveExpenses({
      date: '2025-03-10',
      counter: 100,
      expenses: [{
        title: 'Supplies',
        category: 'Other',
        amount: 25,
        status: 'Pending',
        mode: 'Cash',
        paidDate: '2025-03-09',
        description: 'Office receipt',
        billFile: file,
      }],
    }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = http.expectOne((req) => req.method === 'POST' && req.url.endsWith('/expenses'));
    expect(request.request.body.expenses[0]).toMatchObject({
      status: 'Pending',
      mode: '',
      paidDate: '',
      billData: 'YmlsbCBjb250ZW50cw==',
      billContentType: 'image/png',
      billFileName: 'receipt.png',
    });
    request.flush({ success: true });
    await result;
  });
});
