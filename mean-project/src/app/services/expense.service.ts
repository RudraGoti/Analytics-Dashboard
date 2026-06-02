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

  private apiUrl = 'https://probable-adventure-5gjr5p6v64xr2v695-3000.app.github.dev/api/expenses';

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
}