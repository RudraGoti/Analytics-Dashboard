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
  syncErrorMessage: string = '';
  isSyncing: boolean = false;
  isReviewingConflict: boolean = false; // true after a 409 merge, until the user re-syncs

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
      // Reset review state when date changes
      this.isReviewingConflict = false;
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
      description: 'Stationery and prints',
      isOldEntry: false
    },

    {
      title: 'Rent',
      category: 'Rent',
      amount: 2100,
      status: 'Pending',
      mode: 'Cash',
      description: 'Monthly hosting charge',
      isOldEntry: false
    },

    {
      title: 'Transport',
      category: 'Transport',
      amount: 2100,
      status: 'Pending',
      mode: 'UPI',
      description: 'Team lunch with client',
      isOldEntry: false
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

  getOldExpenses(): Expense[] {
    return this.expenses.filter(exp => exp.isOldEntry);
  }

  getNewExpenses(): Expense[] {
    return this.expenses.filter(exp => !exp.isOldEntry);
  }

  getExpenseIndex(expense: Expense): number {
    return this.expenses.indexOf(expense);
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
      status: 'Pending', // must be a valid enum value ('' is not) so a
                          // half-filled row never breaks Mongoose validation
      mode: '',
      description: '',
      isOldEntry: false
    });
  }

  // ---------- Validation ----------

  /**
   * Checks every expense row has the fields the backend schema requires
   * (title, category, mode, and a valid status). Returns a human-readable
   * error naming the first incomplete row, or null if everything is valid.
   */
  private validateExpenses(): string | null {
    for (let i = 0; i < this.expenses.length; i++) {
      const exp = this.expenses[i];
      const rowLabel = `Row ${i + 1}`;

      if (!exp.title || !exp.title.trim()) {
        return `${rowLabel}: Title is required.`;
      }
      if (!exp.category || !exp.category.trim()) {
        return `${rowLabel}: Please select a category.`;
      }
      if (exp.status !== 'Paid' && exp.status !== 'Pending') {
        return `${rowLabel}: Please select a status (Paid/Pending).`;
      }
      if (!exp.mode || !exp.mode.trim()) {
        return `${rowLabel}: Please select a payment mode.`;
      }
    }
    return null;
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

    // Block the request entirely if any row is missing a required field —
    // this is what used to reach Mongoose and throw a validation error.
    const validationError = this.validateExpenses();
    if (validationError) {
      this.syncError = true;
      this.syncErrorMessage = validationError;
      try { this.cd.detectChanges(); } catch (e) {}

      setTimeout(() => {
        this.syncError = false;
        this.syncErrorMessage = '';
        try { this.cd.detectChanges(); } catch (e) {}
      }, 4000);
      return;
    }

    this.isSyncing = true;
    this.syncError = false;
    this.syncErrorMessage = '';

    // If we're reviewing a merged conflict, this click means "Sync again" -> PUT
    if (this.isReviewingConflict) {
      this.performUpdateToDatabase();
      return;
    }

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

        // Handle duplicate date - fetch existing entries and let the user review/merge
        if (err.status === 409 && err.error?.conflict) {
          this.handleDuplicateDateConflict(err.error.data);
          return;
        }

        this.isSyncing = false;
        try { this.cd.detectChanges(); } catch (e) {}

        this.syncError = true;

        setTimeout(() => {
          this.syncError = false;
        }, 3000);
      }
    );
  }

  // ---------- Handle Duplicate Date ----------

  private handleDuplicateDateConflict(existingData: any): void {

    // Fetch existing expenses for the date
    this.expenseService.getExpenseByDate(this.selectedDate).subscribe(
      (data: any) => {
        if (data && data.expenses) {
          // Map existing expenses to the expense model and mark as old
          const existingExpenses = data.expenses.map((exp: any) => ({
            title: exp.title || '',
            category: exp.category || '',
            amount: exp.amount || 0,
            status: exp.status || '',
            mode: exp.mode || '',
            description: exp.description || '',
            billFileName: exp.billFileName || undefined,
            billFile: null,
            isOldEntry: true // Mark as fetched from database
          }));

          // Merge: existing entries first, then new entries
          this.expenses = [...existingExpenses, ...this.expenses];

          // Update counter from existing data if needed
          if (data.counter) {
            this.counter = data.counter;
          }

          // Stop here so the user can review/edit before syncing again
          this.isReviewingConflict = true;
          this.isSyncing = false;
          try { this.cd.detectChanges(); } catch (e) {}

          console.log(`Loaded ${existingExpenses.length} existing expense(s) for ${this.selectedDate}. Awaiting review before update.`);
        } else {
          this.isSyncing = false;
          try { this.cd.detectChanges(); } catch (e) {}
        }
      },
      (fetchErr: any) => {
        console.error('Failed to fetch existing entries:', fetchErr);
        this.isSyncing = false;
        this.syncError = true;
        try { this.cd.detectChanges(); } catch (e) {}

        setTimeout(() => {
          this.syncError = false;
        }, 3000);
      }
    );
  }

  private performUpdateToDatabase(): void {
    const payload = {
      counter: this.counter,
      expenses: this.expenses
    };

    this.expenseService.updateExpenses(this.selectedDate, payload).subscribe(
      (res: any) => {
        console.log('Updated successfully:', res);
        this.isSyncing = false;
        this.synced = true;
        this.isReviewingConflict = false;
        try { this.cd.detectChanges(); } catch (e) {}

        setTimeout(() => {
          this.synced = false;
          try { this.cd.detectChanges(); } catch (e) {}
        }, 2500);
      },
      (err: any) => {
        console.error('Update failed:', err);
        this.isSyncing = false;
        this.syncError = true;
        try { this.cd.detectChanges(); } catch (e) {}

        setTimeout(() => {
          this.syncError = false;
        }, 3000);
      }
    );
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

// ---------- Bill Upload ----------

onBillFileSelected(event: any, index: number): void {
  const file = event.target.files?.[0];
  if (file) {
    // Validate file type (only PDF and images)
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid file (PDF or Image)');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert('File size must be less than 5MB');
      return;
    }

    this.expenses[index].billFile = file;
    this.expenses[index].billFileName = file.name;
  }
}

removeBillFile(index: number): void {
  this.expenses[index].billFile = null;
  this.expenses[index].billFileName = undefined;
}

triggerBillUpload(index: number): void {
  const fileInput = document.getElementById(`bill-upload-${index}`) as HTMLInputElement;
  fileInput?.click();
}

}