import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpenseService } from '../../services/expense.service';
import { DateService } from '../../services/date.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard implements OnInit, OnDestroy {

  selectedDate: string = '';
  selectedDateDisplay: string = '';

  counter: number = 0;
  totalExpenses: number = 0;
  expenseCount: number = 0;
  categoryCount: number = 0;

  recordFound = false;
  expenses: any[] = [];
  categorySummary: Array<{ name: string; count: number; color: string }> = [];
  pieGradient: string = '';

  private dateSubscription = new Subscription();

  constructor(
    private cd: ChangeDetectorRef,
    private expenseService: ExpenseService,
    private dateService: DateService
  ) {}

  ngOnInit(): void {

    this.selectedDate = this.dateService.selectedDate$.getValue();
    this.selectedDateDisplay = this.formatDateLabel(this.selectedDate);

    this.loadRecord(this.selectedDate);

    this.dateSubscription = this.dateService.selectedDate$.subscribe((date) => {

      this.selectedDate = date;
      this.selectedDateDisplay = this.formatDateLabel(date);

      this.loadRecord(date);

    });
  }

  ngOnDestroy(): void {
    this.dateSubscription.unsubscribe();
  }

  private loadRecord(date: string): void {

    console.log('Dashboard requesting date:', date);

    this.expenseService.getExpenseByDate(date).subscribe({

      next: (record) => {

        console.log('Dashboard received:', record);

        if (record) {

          this.recordFound = true;

          this.counter = record.counter || 0;

          this.expenseCount = record.expenses?.length || 0;

          this.totalExpenses = (record.expenses || []).reduce(
            (sum: number, expense: any) =>
              sum + Number(expense.amount || 0),
            0
          );

          this.categoryCount = new Set(
            (record.expenses || []).map(
              (expense: any) => expense.category
            )
          ).size;

          this.expenses = record.expenses || [];
          this.categorySummary = this.buildCategorySummary(this.expenses);
          this.pieGradient = this.buildPieGradient(this.categorySummary);

          try { this.cd.detectChanges(); } catch (e) {}
        } else {

          this.recordFound = false;

          this.counter = 0;
          this.totalExpenses = 0;
          this.expenseCount = 0;
          this.categoryCount = 0;
          this.categorySummary = [];
          this.pieGradient = '';
          try { this.cd.detectChanges(); } catch (e) {}
        }
      },

      error: (err) => {

        console.error('Dashboard fetch error:', err);

        this.recordFound = false;
        this.expenses = [];
        this.categorySummary = [];
        this.pieGradient = '';

        this.counter = 0;
        this.totalExpenses = 0;
        this.expenseCount = 0;
        this.categoryCount = 0;
        try { this.cd.detectChanges(); } catch (e) {}
      }
    });
  }

  private buildCategorySummary(expenses: any[]): Array<{ name: string; count: number; color: string }> {
    const counts: Record<string, number> = {};
    expenses.forEach(expense => {
      const category = expense.category || 'Other';
      counts[category] = (counts[category] || 0) + 1;
    });

    const palette = ['#4f46e5', '#059669', '#dc2626', '#d97706', '#0ea5e9', '#8b5cf6'];
    return Object.keys(counts).map((category, index) => ({
      name: category,
      count: counts[category],
      color: palette[index % palette.length]
    }));
  }

  private buildPieGradient(categorySummary: Array<{ name: string; count: number; color: string }>): string {
    const total = categorySummary.reduce((sum, item) => sum + item.count, 0);
    if (!total) {
      return 'conic-gradient(#e5e7eb 0deg 360deg)';
    }

    let startAngle = 0;
    const segments = categorySummary.map(item => {
      const portion = (item.count / total) * 360;
      const segment = `${item.color} ${startAngle}deg ${startAngle + portion}deg`;
      startAngle += portion;
      return segment;
    });

    return `conic-gradient(${segments.join(', ')})`;
  }

  private formatDateLabel(date: string): string {

    if (!date) {
      return 'Selected Date';
    }

    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  getStatusBadgeText(expense: any): string {
    const mode = expense.mode?.toLowerCase();
    const status = expense.status?.toLowerCase();

    if (status === 'pending') {
      return 'pending';
    }

    if (mode === 'cash') {
      return 'cash';
    }

    if (mode === 'upi' || mode === 'card' || mode === 'bank transfer' || mode === 'online') {
      return 'online';
    }

    return status || 'pending';
  }

  getStatusBadgeClass(expense: any): string {
    const text = this.getStatusBadgeText(expense);
    return text === 'pending' ? 'pending' : 'paid';
  }
}