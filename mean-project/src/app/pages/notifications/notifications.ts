import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ExpenseService } from '../../services/expense.service';
import { DateService } from '../../services/date.service';

interface NotificationItem {
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  date: string;
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css',
})
export class Notifications implements OnInit {
  items: NotificationItem[] = [];
  isLoading = true;
  errorMessage = '';

  constructor(
    private expenseService: ExpenseService,
    private dateService: DateService,
    private router: Router,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 29);
    const fromDate = this.toIsoDate(from);
    const todayDate = this.toIsoDate(today);
    this.expenseService.getExpensesByDateRange(fromDate, todayDate).subscribe({
      next: (records) => {
        const byDate = new Map((records || []).map((record) => [record.date, record]));
        const items: NotificationItem[] = [];
        if (!byDate.has(todayDate)) {
          items.push({ type: 'info', title: 'Today is not recorded', message: 'Add today’s counter and expenses.', date: todayDate });
        }

        for (let daysAgo = 1; daysAgo < 7; daysAgo++) {
          const date = new Date(today);
          date.setDate(today.getDate() - daysAgo);
          const isoDate = this.toIsoDate(date);
          if (!byDate.has(isoDate)) {
            items.push({ type: 'warning', title: 'Day not recorded', message: `No record found for ${isoDate}.`, date: isoDate });
          }
        }

        (records || []).forEach((record) => {
          (record.expenses || []).filter((expense: { status?: string }) => expense.status === 'Pending')
            .forEach((expense: { title: string; amount: number }) => {
              items.push({
                type: 'warning',
                title: 'Pending expense',
                message: `${expense.title} · ₹${Number(expense.amount || 0).toLocaleString('en-IN')}`,
                date: record.date,
              });
            });
        });
        if (!items.length) {
          items.push({ type: 'success', title: 'All caught up', message: 'There are no missing days or pending expenses.', date: todayDate });
        }
        this.items = items;
        this.isLoading = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.items = [{ type: 'error', title: 'Server not reachable', message: 'Could not load recent activity.', date: todayDate }];
        this.errorMessage = 'Please check the server connection and try again.';
        this.isLoading = false;
        this.cd.markForCheck();
      },
    });
  }

  openItem(item: NotificationItem): void {
    this.dateService.setSingleDate(item.date);
    this.router.navigate(['/AddExpense']);
  }

  private toIsoDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
