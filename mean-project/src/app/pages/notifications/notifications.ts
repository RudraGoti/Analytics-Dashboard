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

type NotificationType = 'alert' | 'warning' | 'info' | 'success';

interface AppNotification {
  id: string;
  type: NotificationType;
  icon: string;
  title: string;
  message: string;
  date: string; // ISO date relevant to the notification
  read: boolean;
  actionDate?: string; // date to jump to on click
}

const READ_KEY = 'ad_notifications_read';
const HIGH_EXPENSE_KEY = 'ad_settings_high_expense_threshold';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css',
})
export class Notifications implements OnInit {

  isLoading = true;
  errorMessage = '';

  notifications: AppNotification[] = [];
  filter: 'all' | 'unread' | 'alert' | 'warning' | 'info' = 'all';

  highExpenseThreshold = 5000;

  constructor(
    private expenseService: ExpenseService,
    private dateService: DateService,
    private router: Router,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadThreshold();
    this.loadNotifications();
  }

  private loadThreshold(): void {
    try {
      const raw = localStorage.getItem(HIGH_EXPENSE_KEY);
      this.highExpenseThreshold = raw ? Number(raw) : 5000;
    } catch (e) {
      this.highExpenseThreshold = 5000;
    }
  }

  loadNotifications(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 29);

    const from = this.formatIsoDate(start);
    const to = this.formatIsoDate(today);

    this.expenseService.getExpensesByDateRange(from, to).subscribe({
      next: (records: DailyRecord[]) => {
        this.notifications = this.buildNotifications(records || [], to);
        this.isLoading = false;
        // Zoneless-by-default in Angular 21: mutating properties inside an
        // RxJS subscribe callback doesn't schedule a re-render on its own,
        // so force one here. Without this the page appears stuck loading
        // until an unrelated click elsewhere triggers a check.
        try { this.cd.detectChanges(); } catch (e) {}
      },
      error: (err) => {
        console.error('Notifications: failed to load data', err);
        this.errorMessage = 'Unable to load notifications right now.';
        this.notifications = [];
        this.isLoading = false;
        try { this.cd.detectChanges(); } catch (e) {}
      },
    });
  }

  private buildNotifications(records: DailyRecord[], todayKey: string): AppNotification[] {
    const readIds = this.getReadIds();
    const list: AppNotification[] = [];
    const recordByDate = new Map(records.map((r) => [r.date, r]));

    // 1. No entry logged for today
    const todayRecord = recordByDate.get(todayKey);
    if (!todayRecord || (todayRecord.expenses || []).length === 0) {
      const id = `no-entry-${todayKey}`;
      list.push({
        id,
        type: 'info',
        icon: 'edit_note',
        title: 'No entries logged today',
        message: `You haven't added any expenses for today yet. Add them before you close the register.`,
        date: todayKey,
        actionDate: todayKey,
        read: readIds.has(id),
      });
    }

    // 2. Pending payments across the last 30 days
    const pendingByDate: Array<{ date: string; count: number; amount: number }> = [];
    records.forEach((r) => {
      const pending = (r.expenses || []).filter((e) => (e.status || '').toLowerCase() === 'pending');
      if (pending.length > 0) {
        pendingByDate.push({
          date: r.date,
          count: pending.length,
          amount: pending.reduce((sum, e) => sum + Number(e.amount || 0), 0),
        });
      }
    });

    if (pendingByDate.length > 0) {
      const totalPendingCount = pendingByDate.reduce((s, p) => s + p.count, 0);
      const totalPendingAmount = pendingByDate.reduce((s, p) => s + p.amount, 0);
      const id = `pending-summary-${todayKey}`;
      list.push({
        id,
        type: 'warning',
        icon: 'hourglass_empty',
        title: `${totalPendingCount} pending payment${totalPendingCount === 1 ? '' : 's'}`,
        message: `You have ${this.formatCurrency(totalPendingAmount)} across ${pendingByDate.length} day(s) marked as Pending in the last 30 days.`,
        date: pendingByDate[pendingByDate.length - 1].date,
        actionDate: pendingByDate[pendingByDate.length - 1].date,
        read: readIds.has(id),
      });
    }

    // 3. High-value expense alerts
    records.forEach((r) => {
      (r.expenses || []).forEach((e, index) => {
        const amount = Number(e.amount || 0);
        if (amount >= this.highExpenseThreshold) {
          const id = `high-expense-${r.date}-${index}`;
          list.push({
            id,
            type: 'alert',
            icon: 'priority_high',
            title: `High expense: ${e.title || e.category || 'Expense'}`,
            message: `${this.formatCurrency(amount)} recorded under "${e.category || 'Other'}" on ${this.formatLongDate(r.date)}.`,
            date: r.date,
            actionDate: r.date,
            read: readIds.has(id),
          });
        }
      });
    });

    // 4. Negative net position days (spent more than earned)
    records.forEach((r) => {
      const expenseTotal = (r.expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const counter = r.counter || 0;
      if ((r.expenses || []).length > 0 && expenseTotal > counter) {
        const id = `negative-net-${r.date}`;
        list.push({
          id,
          type: 'warning',
          icon: 'trending_down',
          title: `Negative net position on ${this.formatLongDate(r.date)}`,
          message: `Expenses (${this.formatCurrency(expenseTotal)}) exceeded the counter (${this.formatCurrency(counter)}) by ${this.formatCurrency(expenseTotal - counter)}.`,
          date: r.date,
          actionDate: r.date,
          read: readIds.has(id),
        });
      }
    });

    // 5. Positive milestone: best day in the period
    const daysWithData = records.filter((r) => (r.expenses || []).length > 0 || (r.counter || 0) > 0);
    if (daysWithData.length > 0) {
      const best = daysWithData.reduce((top, r) => {
        const net = (r.counter || 0) - (r.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
        const topNet = (top.counter || 0) - (top.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
        return net > topNet ? r : top;
      });
      const bestExpense = (best.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
      const bestNet = (best.counter || 0) - bestExpense;

      if (bestNet > 0) {
        const id = `best-day-${best.date}`;
        list.push({
          id,
          type: 'success',
          icon: 'emoji_events',
          title: `Best net position: ${this.formatLongDate(best.date)}`,
          message: `Net position of ${this.formatCurrency(bestNet)} — your strongest day in the last 30 days.`,
          date: best.date,
          actionDate: best.date,
          read: readIds.has(id),
        });
      }
    }

    // Sort newest first
    return list.sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  get filteredNotifications(): AppNotification[] {
    if (this.filter === 'all') return this.notifications;
    if (this.filter === 'unread') return this.notifications.filter((n) => !n.read);
    return this.notifications.filter((n) => n.type === this.filter);
  }

  get unreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  setFilter(filter: 'all' | 'unread' | 'alert' | 'warning' | 'info'): void {
    this.filter = filter;
  }

  markAsRead(notification: AppNotification): void {
    notification.read = true;
    this.persistReadIds();
  }

  markAllRead(): void {
    this.notifications.forEach((n) => (n.read = true));
    this.persistReadIds();
  }

  goToDate(notification: AppNotification): void {
    this.markAsRead(notification);
    if (notification.actionDate) {
      this.dateService.setSingleDate(notification.actionDate);
      this.router.navigate(['/dashboard']);
    }
  }

  private getReadIds(): Set<string> {
    try {
      const raw = localStorage.getItem(READ_KEY);
      const arr: string[] = raw ? JSON.parse(raw) : [];
      return new Set(arr);
    } catch (e) {
      return new Set();
    }
  }

  private persistReadIds(): void {
    const ids = this.notifications.filter((n) => n.read).map((n) => n.id);
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(ids));
    } catch (e) {
      console.warn('Notifications: unable to persist read state', e);
    }
  }

  private formatIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private formatLongDate(value: string): string {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
  }

  timeAgoLabel(dateKey: string): string {
    return this.formatLongDate(dateKey);
  }
}
