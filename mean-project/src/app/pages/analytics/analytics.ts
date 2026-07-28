import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpenseService, Expense } from '../../services/expense.service';
import { DateService } from '../../services/date.service';

interface DailyRecord {
  date: string;
  counter?: number;
  expenses: Expense[];
}

interface AnalyticsSummary {
  totalCounter: number;
  totalExpenses: number;
  totalTransactions: number;
  totalCategories: number;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics.html',
  styleUrl: './analytics.css',
})
export class Analytics implements OnInit {
  selectedDate: string = '';

  summary: AnalyticsSummary = {
    totalCounter: 0,
    totalExpenses: 0,
    totalTransactions: 0,
    totalCategories: 0,
  };

  isLoading = true;
  errorMessage = '';

  constructor(
    private expenseService: ExpenseService,
    private dateService: DateService
  ) {}

  ngOnInit(): void {
    this.dateService.selectedDate$.subscribe((date) => {
      this.selectedDate = date;
      this.loadAnalytics(date);
    });
  }

  loadAnalytics(date: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.expenseService.getExpenseByDate(date).subscribe({
      next: (record: DailyRecord | null) => {
        this.summary = record ? this.calculateAnalytics([record]) : this.calculateAnalytics([]);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Failed to load analytics', error);
        this.errorMessage = 'Unable to load analytics right now.';
        this.summary = this.calculateAnalytics([]);
        this.isLoading = false;
      },
    });
  }

  calculateAnalytics(records: DailyRecord[]): AnalyticsSummary {
    const expenses = (records || []).flatMap((record) =>
      (record.expenses || []).map((expense) => ({
        ...expense,
        date: record.date,
      }))
    );

    const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const totalTransactions = expenses.length;
    const totalCounter = records.reduce((sum, record) => sum + (record.counter || 0), 0);

    const categoryCount = new Set(
      expenses.map((expense) => expense.category || 'Other')
    ).size;

    return {
      totalCounter,
      totalExpenses,
      totalTransactions,
      totalCategories: categoryCount,
    };
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-IN').format(value);
  }
}
