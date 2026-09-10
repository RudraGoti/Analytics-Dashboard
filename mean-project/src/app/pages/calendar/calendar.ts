import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ExpenseService, Expense } from '../../services/expense.service';
import { DateService } from '../../services/date.service';

interface DailyRecord {
  date: string;
  counter?: number;
  expenses: Expense[];
}

interface CalendarCell {
  date: Date;
  dateKey: string;
  inCurrentMonth: boolean;
  isToday: boolean;
  hasRecord: boolean;
  counter: number;
  expenseTotal: number;
  net: number;
  entryCount: number;
  pendingCount: number;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar.html',
  styleUrl: './calendar.css',
})
export class Calendar implements OnInit {

  currentMonth: Date = new Date();
  weekDays: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  cells: CalendarCell[] = [];

  isLoading = true;
  errorMessage = '';

  selectedCell: CalendarCell | null = null;

  monthSummary = {
    totalCounter: 0,
    totalExpense: 0,
    net: 0,
    activeDays: 0,
    pendingCount: 0,
  };

  constructor(
    private expenseService: ExpenseService,
    private dateService: DateService,
    private router: Router,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadMonth();
  }

  private loadMonth(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const from = this.formatIsoDate(this.startOfMonth(this.currentMonth));
    const to = this.formatIsoDate(this.endOfMonth(this.currentMonth));

    this.expenseService.getExpensesByDateRange(from, to).subscribe({
      next: (records: DailyRecord[]) => {
        this.buildCalendar(records || []);
        this.isLoading = false;
        // Angular 21 apps are zoneless by default: a plain property update
        // inside an RxJS subscribe callback does NOT automatically trigger
        // a re-render. Without this, the fetched data just sits in memory
        // until some unrelated click elsewhere forces a check — which is
        // exactly the "have to click twice" / "loads slowly" symptom.
        try { this.cd.detectChanges(); } catch (e) {}
      },
      error: (err) => {
        console.error('Calendar: failed to load month data', err);
        this.errorMessage = 'Unable to load calendar activity right now.';
        this.buildCalendar([]);
        this.isLoading = false;
        try { this.cd.detectChanges(); } catch (e) {}
      },
    });
  }

  private buildCalendar(records: DailyRecord[]): void {
    const recordByDate = new Map(records.map((r) => [r.date, r]));

    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const cells: CalendarCell[] = [];

    // Leading days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      cells.push(this.buildEmptyCell(date, false));
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const key = this.formatIsoDate(date);
      const record = recordByDate.get(key);
      cells.push(this.buildCellFromRecord(date, key, true, record));
    }

    // Trailing days to complete the 6x7 grid
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      cells.push(this.buildEmptyCell(date, false));
    }

    this.cells = cells;
    this.selectedCell = null;
    this.computeMonthSummary(cells);
  }

  private buildEmptyCell(date: Date, inCurrentMonth: boolean): CalendarCell {
    return {
      date,
      dateKey: this.formatIsoDate(date),
      inCurrentMonth,
      isToday: this.isSameDay(date, new Date()),
      hasRecord: false,
      counter: 0,
      expenseTotal: 0,
      net: 0,
      entryCount: 0,
      pendingCount: 0,
    };
  }

  private buildCellFromRecord(date: Date, key: string, inCurrentMonth: boolean, record?: DailyRecord): CalendarCell {
    if (!record) {
      return this.buildEmptyCell(date, inCurrentMonth);
    }

    const expenses = record.expenses || [];
    const expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const counter = record.counter || 0;
    const pendingCount = expenses.filter((e) => (e.status || '').toLowerCase() === 'pending').length;

    return {
      date,
      dateKey: key,
      inCurrentMonth,
      isToday: this.isSameDay(date, new Date()),
      hasRecord: true,
      counter,
      expenseTotal,
      net: counter - expenseTotal,
      entryCount: expenses.length,
      pendingCount,
    };
  }

  private computeMonthSummary(cells: CalendarCell[]): void {
    const activeCells = cells.filter((c) => c.inCurrentMonth && c.hasRecord);

    this.monthSummary = {
      totalCounter: activeCells.reduce((sum, c) => sum + c.counter, 0),
      totalExpense: activeCells.reduce((sum, c) => sum + c.expenseTotal, 0),
      net: activeCells.reduce((sum, c) => sum + c.net, 0),
      activeDays: activeCells.length,
      pendingCount: activeCells.reduce((sum, c) => sum + c.pendingCount, 0),
    };
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
    this.currentMonth = new Date();
    this.loadMonth();
  }

  selectCell(cell: CalendarCell): void {
    if (!cell.inCurrentMonth) return;
    this.selectedCell = cell;
  }

  openInDashboard(cell: CalendarCell): void {
    if (!cell.inCurrentMonth) return;
    this.dateService.setSingleDate(cell.dateKey);
    this.router.navigate(['/dashboard']);
  }

  openInAddExpense(cell: CalendarCell): void {
    if (!cell.inCurrentMonth) return;
    this.dateService.setSingleDate(cell.dateKey);
    this.router.navigate(['/AddExpense']);
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private endOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  private formatIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  formatSelectedDate(cell: CalendarCell | null): string {
    if (!cell) return '';
    return cell.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
