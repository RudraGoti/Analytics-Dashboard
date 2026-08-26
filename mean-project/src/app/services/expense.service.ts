import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

  private apiUrl = '/api/expenses';

  constructor(private http: HttpClient) {}

  // Save expenses
  saveExpenses(data: DailyExpensePayload): Observable<any> {
    return this.http.post<any>(this.apiUrl, data);
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

  // Update expenses (used after conflict review, sends PUT to /:date)
  updateExpenses(
    date: string,
    data: { counter: number; expenses: Expense[] }
  ): Observable<any> {
      return this.http.post<any>(this.apiUrl, {
        date,
        counter: data.counter,
        expenses: data.expenses,
        action: 'replace'
      });
    }
}