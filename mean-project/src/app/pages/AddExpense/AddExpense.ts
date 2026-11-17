import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ExpenseService, Expense } from '../../services/expense.service';
import { DateService } from '../../services/date.service';
import { SettingsService } from '../../services/settings.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-add-expense',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './AddExpense.html',
  styleUrls: ['./AddExpense.css']
})
export class AddExpense implements OnInit, OnDestroy {
  counter = 0;
  selectedDate = '';
  synced = false;
  syncError = false;
  syncErrorMessage = '';
  isSyncing = false;
  isReviewingConflict = false;
  hasSavedRecord = false;
  openDropdown: number | null = null;
  openStatusDropdown: number | null = null;
  openModeDropdown: number | null = null;
  expenses: Expense[] = [];
  private readonly subscriptions = new Subscription();
  private loadVersion = 0;
  private defaults = { defaultCategory: 'Other', defaultMode: 'Cash', defaultStatus: 'Pending' };

  categories = [
    { name: 'Product Purchase', icon: '🛒' },
    { name: 'Rent', icon: '🏠' },
    { name: 'Light Bill', icon: '💡' },
    { name: 'Maintenance', icon: '🛠️' },
    { name: 'Petrol', icon: '⛽' },
    { name: 'Other', icon: '📦' }
  ];

  constructor(
    private expenseService: ExpenseService,
    private dateService: DateService,
    private settingsService: SettingsService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(this.settingsService.settings$.subscribe((settings) => {
      this.defaults = settings;
    }));
    this.subscriptions.add(this.dateService.selectedDate$.subscribe((date) => {
      this.selectedDate = date;
      this.isReviewingConflict = false;
      this.loadRecord(date);
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get totalExpenses(): number {
    return this.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  }

  get netPosition(): number {
    return this.counter - this.totalExpenses;
  }

  getOldExpenses(): Expense[] {
    return this.expenses.filter((expense) => expense.isOldEntry);
  }

  getNewExpenses(): Expense[] {
    return this.expenses.filter((expense) => !expense.isOldEntry);
  }

  getExpenseIndex(expense: Expense): number {
    return this.expenses.indexOf(expense);
  }

  updateCounter(value: number | string): void {
    this.counter = Number(value) || 0;
  }

  addExpense(): void {
    this.expenses.push(this.createBlankExpense());
  }

  removeExpense(index: number): void {
    this.expenses.splice(index, 1);
  }

  getCategoryIcon(category: string): string {
    return this.categories.find((item) => item.name === category)?.icon || '📦';
  }

  toggleDropdown(index: number): void {
    this.openDropdown = this.openDropdown === index ? null : index;
    this.openStatusDropdown = null;
    this.openModeDropdown = null;
  }

  selectCategory(index: number, categoryName: string): void {
    this.expenses[index].category = categoryName;
    this.openDropdown = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.cat-wrap')) {
      this.openDropdown = null;
      this.openStatusDropdown = null;
      this.openModeDropdown = null;
    }
  }

  saveExpenses(): void {
    if (this.isSyncing) return;

    const expensesToSave = this.expenses.filter((expense) => !this.isCompletelyEmpty(expense));
    if (expensesToSave.some((expense) => !expense.title.trim() || !expense.category.trim())) {
      this.showSyncError('Enter a title and category for every expense.');
      return;
    }
    if (expensesToSave.some((expense) => expense.status.toLowerCase() === 'paid' && !expense.mode)) {
      this.showSyncError('Choose a payment mode for every paid expense.');
      return;
    }
    if (expensesToSave.some((expense) => expense.status.toLowerCase() === 'paid' && !expense.paidDate)) {
      this.showSyncError('Add the paid date for every paid expense.');
      return;
    }
    const totalBillBytes = expensesToSave.reduce((total, expense) =>
      total + (expense.billFile?.size || Math.ceil((expense.billData || '').length * 0.75)), 0);
    if (totalBillBytes > 10 * 1024 * 1024) {
      this.showSyncError('Bill attachments must total 10MB or less for each day.');
      return;
    }

    this.isSyncing = true;
    this.syncError = false;
    this.syncErrorMessage = '';
    const action = this.hasSavedRecord || this.isReviewingConflict ? 'replace' : undefined;
    this.expenseService.saveExpenses({
      date: this.selectedDate,
      counter: this.counter,
      expenses: expensesToSave,
      action,
    }).subscribe({
      next: (response) => this.finishSave(response.data?.expenses || expensesToSave),
      error: (error: HttpErrorResponse) => {
        if (error.status === 409 && error.error?.conflict) {
          this.handleDuplicateDateConflict();
          return;
        }
        this.isSyncing = false;
        this.showSyncError(this.getSaveErrorMessage(error));
        this.cd.markForCheck();
      },
    });
  }

  private getSaveErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'Cannot reach the server. Check that the backend is running, then retry.';
    }
    if (error.status === 503) {
      return 'Database is unavailable. Check the MongoDB connection, then retry.';
    }
    if (typeof error.error?.error === 'string') {
      return error.error.error;
    }
    return 'Unable to save this record. Please try again.';
  }

  private loadRecord(date: string): void {
    const version = ++this.loadVersion;
    this.expenses = [this.createBlankExpense()];
    this.counter = 0;
    this.hasSavedRecord = false;
    this.syncError = false;
    this.syncErrorMessage = '';
    this.expenseService.getExpenseByDate(date).subscribe({
      next: (record) => {
        if (version !== this.loadVersion || this.selectedDate !== date) return;
        if (record) {
          this.counter = Number(record.counter || 0);
          this.expenses = (record.expenses || []).map((expense: Expense) => ({
            ...expense,
            mode: expense.status === 'Paid' ? expense.mode || '' : '',
            paidDate: expense.status === 'Paid' ? expense.paidDate || date : '',
            billFile: null,
            isOldEntry: true,
          }));
          this.hasSavedRecord = true;
        }
        this.cd.markForCheck();
      },
      error: () => {
        if (version === this.loadVersion) {
          this.showSyncError('Unable to load the saved record for this date.');
          this.cd.markForCheck();
        }
      },
    });
  }

  private handleDuplicateDateConflict(): void {
    this.expenseService.getExpenseByDate(this.selectedDate).subscribe({
      next: (record) => {
        if (!record) {
          this.isSyncing = false;
          this.showSyncError('A record conflict occurred but the saved record could not be loaded.');
          this.cd.markForCheck();
          return;
        }
        const currentCounter = this.counter;
        const existingExpenses = (record.expenses || []).map((expense: Expense) => ({
          ...expense,
          billFile: null,
          isOldEntry: true,
        }));
        const currentExpenses = this.expenses.filter((expense) => !this.isCompletelyEmpty(expense));
        this.expenses = [...existingExpenses, ...currentExpenses];
        this.counter = currentCounter;
        this.hasSavedRecord = true;
        this.isReviewingConflict = true;
        this.isSyncing = false;
        this.showSyncError('A record was created for this date. Review the merged entries, then sync again.');
        this.cd.markForCheck();
      },
      error: () => {
        this.isSyncing = false;
        this.showSyncError('Unable to load the conflicting record. Please retry.');
        this.cd.markForCheck();
      },
    });
  }

  private finishSave(savedExpenses: Expense[]): void {
    this.isSyncing = false;
    this.synced = true;
    this.hasSavedRecord = true;
    this.isReviewingConflict = false;
    this.expenses = savedExpenses.map((expense) => ({ ...expense, isOldEntry: true, billFile: null }));
    this.syncError = false;
    this.syncErrorMessage = '';
    this.cd.markForCheck();
    setTimeout(() => {
      this.synced = false;
      this.cd.markForCheck();
    }, 2500);
  }

  private showSyncError(message: string): void {
    this.syncError = true;
    this.syncErrorMessage = message;
  }

  private isCompletelyEmpty(expense: Expense): boolean {
    return !expense.title.trim()
      && !expense.description.trim()
      && Number(expense.amount || 0) === 0
      && !expense.billFile
      && !expense.billData
      && (!expense.category || expense.category === this.defaults.defaultCategory);
  }

  private createBlankExpense(): Expense {
    return {
      title: '',
      category: this.defaults.defaultCategory,
      amount: 0,
      status: this.defaults.defaultStatus,
      mode: '',
      paidDate: this.defaults.defaultStatus === 'Paid' ? this.selectedDate : '',
      description: '',
      isOldEntry: false,
    };
  }

  toggleStatusDropdown(index: number): void {
    this.openStatusDropdown = this.openStatusDropdown === index ? null : index;
    this.openDropdown = null;
    this.openModeDropdown = null;
  }

  selectStatus(index: number, status: string): void {
    this.expenses[index].status = status;
    if (status === 'Pending') {
      this.expenses[index].mode = '';
      this.expenses[index].paidDate = '';
    } else {
      this.expenses[index].paidDate ||= this.selectedDate;
    }
    this.openStatusDropdown = null;
  }

  toggleModeDropdown(index: number): void {
    this.openModeDropdown = this.openModeDropdown === index ? null : index;
    this.openDropdown = null;
    this.openStatusDropdown = null;
  }

  selectMode(index: number, mode: string): void {
    this.expenses[index].mode = mode;
    this.openModeDropdown = null;
  }

  onBillFileSelected(event: Event, index: number): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid file (PDF or Image)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }
    this.expenses[index].billFile = file;
    this.expenses[index].billFileName = file.name;
    this.expenses[index].billContentType = file.type;
  }

  removeBillFile(index: number): void {
    this.expenses[index].billFile = null;
    this.expenses[index].billFileName = undefined;
    this.expenses[index].billData = '';
    this.expenses[index].billContentType = '';
  }

  triggerBillUpload(index: number): void {
    document.getElementById(`bill-upload-${index}`)?.click();
  }
}
