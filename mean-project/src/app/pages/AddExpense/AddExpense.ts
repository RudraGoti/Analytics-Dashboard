import { Component, HostListener, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ExpenseService, Expense } from '../../services/expense.service';
import { DateService } from '../../services/date.service';
import { Subscription } from 'rxjs';

interface Category {
  name: string;
  icon: string;
}

@Component({
  selector: 'app-add-expense',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './AddExpense.html',
  styleUrls: ['./AddExpense.css']
})

export class AddExpense implements OnInit, OnDestroy {

  counter: number = 15450;
  selectedDate: string = '';

  synced: boolean = false;
  syncError: boolean = false;
  isSyncing: boolean = false;
  showDuplicateDateModal: boolean = false;
  duplicateDateInfo: any = null;

  openDropdown: number | null = null;
  private dateSubscription = new Subscription();

  constructor(
    private expenseService: ExpenseService,
    private dateService: DateService,
    private cd: ChangeDetectorRef
  ) {}

  // ---------- Categories ----------

  categories = [
    { name: 'Product Purchase', icon: '🛒'},
    { name: 'Rent', icon: '🏠'},
    { name: 'Light Bill', icon: '💡'},
    { name: 'Maintenance', icon: '🛠️'},
    { name: 'Petrol', icon: '⛽'},
    { name: 'Other', icon: '📦'}
  ];

  getCategoryIcon(category: string): string {

    switch (category) {

      case 'Product Purchase':
        return '🛒';

      case 'Rent':
        return '🏠';

      case 'Light Bill':
        return '💡';

      case 'Internet':
        return '🌐';

      case 'Salary':
        return '💰';

      case 'Transport':
        return '🚚';

      default:
        return '📦';
    }
  }

  ngOnInit(): void {
    const date = this.dateService.selectedDate$.getValue();
    this.selectedDate = date;

    this.dateSubscription = this.dateService.selectedDate$.subscribe((dateValue) => {
      this.selectedDate = dateValue;
    });
  }

  ngOnDestroy(): void {
    this.dateSubscription.unsubscribe();
  }

  // ---------- Expense Data ----------

  expenses: Expense[] = [
    {
      title: 'Product Purchase',
      category: 'Product Purchase',
      amount: 1250,
      status: 'Paid',
      mode: 'Cash',
      description: 'Stationery and prints'
    },

    {
      title: 'Rent',
      category: 'Rent',
      amount: 2100,
      status: 'Pending',
      mode: 'Cash',
      description: 'Monthly hosting charge'
    },

    {
      title: 'Transport',
      category: 'Transport',
      amount: 2100,
      status: 'Pending',
      mode: 'UPI',
      description: 'Team lunch with client'
    }
  ];

  // ---------- Computed Values ----------

  get totalExpenses(): number {
    return this.expenses.reduce(
      (sum, expense) => sum + Number(expense.amount || 0),
      0
    );
  }

  get netPosition(): number {
    return this.counter - this.totalExpenses;
  }

  // ---------- Counter ----------

  updateCounter(value: number | string): void {
    this.counter = Number(value) || 0;
  }

  // ---------- CRUD ----------

  addExpense(): void {
    this.expenses.push({
      title: '',
      category: '',
      amount: 0,
      status: '',
      mode: '',
      description: ''
    });
  }

  removeExpense(index: number): void {
    this.expenses.splice(index, 1);
  }

  // ---------- Dropdown ----------

  toggleDropdown(index: number): void {
    if (this.openDropdown === index) {
      this.openDropdown = null;
    } else {
      this.openDropdown = index;
      this.openStatusDropdown = null;  // close others
      this.openModeDropdown = null;
    }
  }

  selectCategory(index: number, categoryName: string): void {
    this.expenses[index].category = categoryName;
    this.openDropdown = null;
  }

  // ---------- Close Dropdown ----------

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {

    const target = event.target as HTMLElement;

    if (!target.closest('.cat-wrap')) {
      this.openDropdown = null;
    }
  }

  // ---------- Save To MongoDB ----------

  syncToDatabase(): void {

    if (this.isSyncing) {
      return;
    }

    this.isSyncing = true;
    this.syncError = false;

    const payload = {
      date: this.selectedDate,
      counter: this.counter,
      expenses: this.expenses
    };

    this.expenseService.saveExpenses(payload).subscribe(

      (res: any) => {

        console.log('Saved successfully:', res);

        this.isSyncing = false;
        this.synced = true;
        try { this.cd.detectChanges(); } catch (e) {}

        setTimeout(() => {
          this.synced = false;
          try { this.cd.detectChanges(); } catch (e) {}
        }, 2500);
      },

      (err: any) => {

        console.error('Save failed:', err);

        this.isSyncing = false;
        try { this.cd.detectChanges(); } catch (e) {}

        if (err.status === 409 && err.error?.conflict) {
          this.duplicateDateInfo = err.error.data;
          this.showDuplicateDateModal = true;
          // ensure Angular updates the view immediately
          try { this.cd.detectChanges(); } catch (e) {}
          return;
        }

        this.syncError = true;

        setTimeout(() => {
          this.syncError = false;
        }, 3000);
      }
    );
  }

  replaceExistingRecord(): void {
    if (this.isSyncing) {
      return;
    }

    // close modal immediately for better UX
    this.showDuplicateDateModal = false;
    try { this.cd.detectChanges(); } catch (e) {}

    this.isSyncing = true;
    this.syncError = false;

    const payload = {
      date: this.selectedDate,
      counter: this.counter,
      expenses: this.expenses,
      action: 'replace' as const
    };

    this.expenseService.saveExpenses(payload).subscribe(
      (res: any) => {
        console.log('Replaced existing date record:', res);
        this.isSyncing = false;
        this.synced = true;
        this.showDuplicateDateModal = false;
        try { this.cd.detectChanges(); } catch (e) {}

        setTimeout(() => {
          this.synced = false;
          try { this.cd.detectChanges(); } catch (e) {}
        }, 2500);
      },
      (err: any) => {
        console.error('Replace failed:', err);
        this.isSyncing = false;
        this.showDuplicateDateModal = false;
        this.syncError = true;
        try { this.cd.detectChanges(); } catch (e) {}

        setTimeout(() => {
          this.syncError = false;
          try { this.cd.detectChanges(); } catch (e) {}
        }, 3000);
      }
    );
  }

  appendToExistingRecord(): void {
    if (this.isSyncing) {
      return;
    }

    // close modal immediately for better UX
    this.showDuplicateDateModal = false;
    try { this.cd.detectChanges(); } catch (e) {}

    this.isSyncing = true;
    this.syncError = false;

    const payload = {
      date: this.selectedDate,
      counter: this.counter,
      expenses: this.expenses,
      action: 'append' as const
    };

    this.expenseService.saveExpenses(payload).subscribe(
      (res: any) => {
        console.log('Appended to existing date record:', res);
        this.isSyncing = false;
        this.synced = true;
        this.showDuplicateDateModal = false;
        try { this.cd.detectChanges(); } catch (e) {}

        setTimeout(() => {
          this.synced = false;
          try { this.cd.detectChanges(); } catch (e) {}
        }, 2500);
      },
      (err: any) => {
        console.error('Append failed:', err);
        this.isSyncing = false;
        this.showDuplicateDateModal = false;
        this.syncError = true;
        try { this.cd.detectChanges(); } catch (e) {}

        setTimeout(() => {
          this.syncError = false;
          try { this.cd.detectChanges(); } catch (e) {}
        }, 3000);
      }
    );
  }

  cancelExistingRecord(): void {
    this.showDuplicateDateModal = false;
    this.duplicateDateInfo = null;
  }

openStatusDropdown: number | null = null;
openModeDropdown: number | null = null;



toggleStatusDropdown(index: number) {
  if (this.openStatusDropdown === index) {
    this.openStatusDropdown = null;
  } else {
    this.openStatusDropdown = index;
    this.openDropdown = null;        // close others
    this.openModeDropdown = null;
  }
}

selectStatus(index: number, status: string) {
  this.expenses[index].status = status;
  this.openStatusDropdown = null;
}

toggleModeDropdown(index: number) {
  if (this.openModeDropdown === index) {
    this.openModeDropdown = null;
  } else {
    this.openModeDropdown = index;
    this.openDropdown = null;        // close others
    this.openStatusDropdown = null;
  }
}

selectMode(index: number, mode: string) {
  this.expenses[index].mode = mode;
  this.openModeDropdown = null;
}

}