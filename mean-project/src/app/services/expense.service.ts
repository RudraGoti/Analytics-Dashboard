import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { from, map, Observable, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Expense {
  title: string;
  category: string;
  amount: number;
  status: string;
  mode: string;
  paidDate?: string;
  description: string;
  billFile?: File | null;
  billFileName?: string;
  billData?: string | null;
  billContentType?: string | null;
  _id?: string;
  id?: string;
  isOldEntry?: boolean;
}

export interface DailyExpensePayload {
  date: string;
  counter: number;
  expenses: Expense[];
  action?: 'append' | 'replace';
}

@Injectable({
  providedIn: 'root'
})

export class ExpenseService {

  private readonly apiUrl = `${environment.apiUrl}/expenses`;

  constructor(private http: HttpClient) {}

  // Save expenses
  saveExpenses(data: DailyExpensePayload): Observable<any> {
    return this.cleanPayload(data).pipe(
      switchMap((payload) => this.http.post<any>(this.apiUrl, payload)),
    );
  }

  // Fetch expenses
  getExpenses(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getExpenseByDate(date: string): Observable<any> {
    return this.http.get<any>(this.apiUrl, {
      params: { date }
    });
  }

  getExpensesByDateRange(dateFrom: string, dateTo: string): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl, {
      params: { dateFrom, dateTo }
    });
  }

  getBalanceBefore(date: string): Observable<{ before: string; totalCounter: number; totalExpenses: number; balance: number }> {
    return this.http.get<{ before: string; totalCounter: number; totalExpenses: number; balance: number }>(
      `${this.apiUrl}/balance`,
      { params: { before: date } }
    );
  }

  deleteExpenseByDate(date: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${date}`);
  }

  markExpensePaid(
    date: string,
    expenseId: string,
    payment: { paidDate: string; mode: string },
  ): Observable<any> {
    return this.http.patch<any>(
      `${this.apiUrl}/${date}/expenses/${expenseId}/payment`,
      payment,
    );
  }

  getHealth(): Observable<{ ok: boolean; database: boolean }> {
    return this.http.get<{ ok: boolean; database: boolean }>(`${environment.apiUrl}/health`);
  }

  // Replace an existing record after conflict review.
  updateExpenses(
    date: string,
    data: { counter: number; expenses: Expense[] }
  ): Observable<any> {
    return this.cleanPayload({
      date,
      counter: data.counter,
      expenses: data.expenses,
      action: 'replace'
    }).pipe(switchMap((payload) => this.http.post<any>(this.apiUrl, payload)));
  }

  private cleanPayload<T extends { date: string; expenses: Expense[] }>(
    data: T
  ): Observable<Omit<T, 'expenses'> & { expenses: Omit<Expense, 'billFile' | 'isOldEntry'>[] }> {
    const expenses = data.expenses;
    if (!expenses.some((expense) => expense.billFile)) {
      return of({
        ...data,
        expenses: expenses.map((expense) => this.cleanExpense(data.date, expense, expense.billData)),
      });
    }

    return from(Promise.all(expenses.map(async (expense) => {
      const billData = expense.billFile ? await this.readBillFile(expense.billFile) : expense.billData;
      return this.cleanExpense(data.date, expense, billData);
    }))).pipe(map((cleanExpenses) => ({ ...data, expenses: cleanExpenses })));
  }

  private cleanExpense(
    date: string,
    { billFile, isOldEntry, ...expense }: Expense,
    billData: string | null | undefined,
  ): Omit<Expense, 'billFile' | 'isOldEntry'> {
    const status = expense.status?.toLowerCase() === 'paid' ? 'Paid' : 'Pending';
    return {
      ...expense,
      category: expense.category || 'Other',
      amount: Number.isFinite(Number(expense.amount)) ? Number(expense.amount) : 0,
      status,
      mode: status === 'Paid' ? expense.mode : '',
      paidDate: status === 'Paid' ? (expense.paidDate || date) : '',
      billData: billData || '',
      billContentType: billData ? (billFile?.type || expense.billContentType || '') : '',
      billFileName: billData ? (billFile?.name || expense.billFileName || '') : '',
    };
  }

  private async readBillFile(file: File): Promise<string> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const chunks: string[] = [];
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
    }
    return btoa(chunks.join(''));
  }
}