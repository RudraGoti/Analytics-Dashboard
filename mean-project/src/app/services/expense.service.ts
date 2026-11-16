import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Expense {
  title: string;
  category: string;
  amount: number;
  status: string;
  mode: string;
  description: string;
  billFile?: File | null;
  billFileName?: string;
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
    return this.http.post<any>(this.apiUrl, this.cleanPayload(data));
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

  getHealth(): Observable<{ ok: boolean; database: boolean }> {
    return this.http.get<{ ok: boolean; database: boolean }>(`${environment.apiUrl}/health`);
  }

  // Replace an existing record after conflict review.
  updateExpenses(
    date: string,
    data: { counter: number; expenses: Expense[] }
  ): Observable<any> {
    return this.http.post<any>(this.apiUrl, this.cleanPayload({
      date,
      counter: data.counter,
      expenses: data.expenses,
      action: 'replace'
    }));
  }

  private cleanPayload<T extends { expenses: Expense[] }>(
    data: T
  ): Omit<T, 'expenses'> & { expenses: Omit<Expense, 'billFile' | 'isOldEntry' | 'billFileName'>[] } {
    const expenses = data.expenses.map(({ billFile, isOldEntry, billFileName, ...expense }) => ({
      ...expense,
      category: expense.category || 'Other',
      amount: Number.isFinite(Number(expense.amount)) ? Number(expense.amount) : 0,
      status: expense.status?.toLowerCase() === 'paid' ? 'Paid' : 'Pending',
      mode: expense.mode || 'Cash',
    }));
    return { ...data, expenses };
  }
}