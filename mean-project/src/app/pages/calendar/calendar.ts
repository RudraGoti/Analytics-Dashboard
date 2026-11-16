import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ExpenseService } from '../../services/expense.service';
import { DateService } from '../../services/date.service';
import { Subscription } from 'rxjs';

interface CalendarRecord {
  date: string;
  counter: number;
  expenses: Array<{ amount: number }>;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar.html',
  styleUrl: './calendar.css',
})
export class Calendar implements OnInit, OnDestroy {
  currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  days: Date[] = [];
  records = new Map<string, CalendarRecord>();
  isLoading = false;
  errorMessage = '';
  selectedDate: string;
  private readonly dateSubscription: Subscription;
  readonly weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  constructor(
    private expenseService: ExpenseService,
    private dateService: DateService,
    private router: Router,
    private cd: ChangeDetectorRef,
  ) {
    this.selectedDate = this.dateService.selectedDate$.getValue();
    this.dateSubscription = this.dateService.selectedDate$.subscribe((date) => {
      this.selectedDate = date;
      this.cd.markForCheck();
    });
  }

  ngOnInit(): void {
    this.loadMonth();
  }

  ngOnDestroy(): void {
    this.dateSubscription.unsubscribe();
  }

  get monthDaysRecorded(): number {
    return [...this.records.keys()].filter((date) => date.startsWith(this.monthPrefix)).length;
  }

  get monthCounter(): number {
    return this.monthRecords.reduce((sum, record) => sum + Number(record.counter || 0), 0);
  }

  get monthExpenses(): number {
    return this.monthRecords.reduce((sum, record) => sum + this.expenseTotal(record), 0);
  }

  private get monthPrefix(): string {
    return `${this.currentMonth.getFullYear()}-${String(this.currentMonth.getMonth() + 1).padStart(2, '0')}`;
  }

  private get monthRecords(): CalendarRecord[] {
    return [...this.records.values()].filter((record) => record.date.startsWith(this.monthPrefix));
  }

  loadMonth(): void {
    const first = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    this.days = Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      return day;
    });
    const from = this.toIsoDate(this.days[0]);
    const to = this.toIsoDate(this.days[41]);
    this.isLoading = true;
    this.errorMessage = '';
    this.expenseService.getExpensesByDateRange(from, to).subscribe({
      next: (records) => {
        this.records = new Map((records || []).map((record) => [record.date, record as CalendarRecord]));
        this.isLoading = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.records.clear();
        this.errorMessage = 'Unable to load calendar activity.';
        this.isLoading = false;
        this.cd.markForCheck();
      },
    });
  }

  previousMonth(): void {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1, 1);
    this.loadMonth();
  }

  nextMonth(): void {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 1);
    this.loadMonth();
  }

  goToToday(): void {
    const today = new Date();
    this.currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    this.loadMonth();
  }

  isCurrentMonth(date: Date): boolean {
    return date.getMonth() === this.currentMonth.getMonth() && date.getFullYear() === this.currentMonth.getFullYear();
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return this.toIsoDate(date) === this.toIsoDate(today);
  }

  dateRecord(date: Date): CalendarRecord | undefined {
    return this.records.get(this.toIsoDate(date));
  }

  isSelected(date: Date): boolean {
    return this.toIsoDate(date) === this.selectedDate;
  }

  expenseTotal(record: CalendarRecord): number {
    return (record.expenses || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  }

  selectDay(date: Date): void {
    this.dateService.setSingleDate(this.toIsoDate(date));
    this.router.navigate(['/dashboard']);
  }

  private toIsoDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
