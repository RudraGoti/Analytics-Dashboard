import { Component, OnInit, OnDestroy } from '@angular/core';
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

  private dateSubscription = new Subscription();

  constructor(
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

        } else {

          this.recordFound = false;

          this.counter = 0;
          this.totalExpenses = 0;
          this.expenseCount = 0;
          this.categoryCount = 0;
        }
      },

      error: (err) => {

        console.error('Dashboard fetch error:', err);

        this.recordFound = false;

        this.counter = 0;
        this.totalExpenses = 0;
        this.expenseCount = 0;
        this.categoryCount = 0;
      }
    });
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
}