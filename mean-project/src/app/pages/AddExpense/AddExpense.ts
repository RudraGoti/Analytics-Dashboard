import { Component, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ExpenseService, Expense } from '../../services/expense.service';

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

export class AddExpense {

  counter: number = 15450;

  synced: boolean = false;
  syncError: boolean = false;
  isSyncing: boolean = false;

  openDropdown: number | null = null;

  constructor(private expenseService: ExpenseService) {}

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

      case 'Office Supplies':
        return '📁';

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

  // ---------- Expense Data ----------

  expenses: Expense[] = [
    {
      title: 'Office Supplies',
      category: 'Office Supplies',
      amount: 1250,
      status: 'Paid',
      mode: 'Cash',
      description: 'Stationery and prints'
    },

    {
      title: 'Server Hosting',
      category: 'Github',
      amount: 2100,
      status: 'Pending',
      mode: 'Cash',
      description: 'Monthly hosting charge'
    },

    {
      title: 'Client Lunch',
      category: 'Instagram',
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
      category: 'Office Supplies',
      amount: 0,
      status: 'Pending',
      mode: 'Cash',
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
      counter: this.counter,
      expenses: this.expenses
    };

    this.expenseService.saveExpenses(payload).subscribe(

      (res: any) => {

        console.log('Saved successfully:', res);

        this.isSyncing = false;
        this.synced = true;

        setTimeout(() => {
          this.synced = false;
        }, 2500);
      },

      (err: any) => {

        console.error('Save failed:', err);

        this.isSyncing = false;
        this.syncError = true;

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

}