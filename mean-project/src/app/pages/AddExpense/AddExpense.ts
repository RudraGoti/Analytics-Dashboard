import { Component, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface Expense {
  title: string;
  category: string;
  amount: number;
  status: string;
  mode: string;
  description: string;
}

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
  openDropdown: number | null = null;

  categories: Category[] = [
    {
      name: 'Office Supplies',
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2"/><path d="M8 10h8M8 14h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
    },
    {
      name: 'Github',
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.607.069-.607 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.026A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.026 2.747-1.026.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>`
    },
    {
      name: 'Instagram',
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig1)" stroke-width="2"/><circle cx="12" cy="12" r="4" stroke="url(#ig1)" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1" fill="#e1306c"/><defs><linearGradient id="ig1" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse"><stop stop-color="#f09433"/><stop offset=".25" stop-color="#e6683c"/><stop offset=".5" stop-color="#dc2743"/><stop offset=".75" stop-color="#cc2366"/><stop offset="1" stop-color="#bc1888"/></linearGradient></defs></svg>`
    },
    {
      name: 'LinkedIn',
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#0a66c2" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="4" fill="#0a66c2"/><path d="M7 10h2v7H7v-7zm1-3a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm4 3h2v1h.03C14.43 10.36 15.26 10 16.1 10c2.14 0 2.9 1.41 2.9 3.24V17h-2v-3.24c0-.77-.01-1.76-1.07-1.76-1.08 0-1.24.84-1.24 1.7V17H12v-7z" fill="white"/></svg>`
    },
    {
      name: 'Facebook',
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#1877f2" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#1877f2"/><path d="M13.5 8.5H15V6.5h-1.5C12.12 6.5 11 7.62 11 9v1H9.5v2H11V19h2v-7h1.5l.5-2H13V9c0-.28.22-.5.5-.5z" fill="white"/></svg>`
    },
    {
      name: 'Twitter',
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#1da1f2" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#1da1f2"/><path d="M17.5 8.5a4.9 4.9 0 0 1-1.41.39 2.46 2.46 0 0 0 1.08-1.36c-.47.28-1 .48-1.55.59A2.44 2.44 0 0 0 12 9.7a6.93 6.93 0 0 1-5.03-2.55 2.44 2.44 0 0 0 .76 3.26 2.44 2.44 0 0 1-1.1-.3v.03a2.44 2.44 0 0 0 1.96 2.39 2.47 2.47 0 0 1-1.1.04 2.44 2.44 0 0 0 2.28 1.7A4.9 4.9 0 0 1 7 15.28a6.9 6.9 0 0 0 3.74 1.1c4.49 0 6.95-3.72 6.95-6.95 0-.11 0-.21-.01-.32A4.96 4.96 0 0 0 19 7.74a4.86 4.86 0 0 1-1.5.41z" fill="white"/></svg>`
    },
  ];

  expenses: Expense[] = [
    { title: 'Office Supplies', category: 'Office Supplies', amount: 1250, status: 'Paid',    mode: 'Cash', description: 'Stationery and prints' },
    { title: 'Server Hosting',  category: 'Github',          amount: 2100, status: 'Pending', mode: 'Cash', description: 'Monthly hosting charge' },
    { title: 'Client Lunch',    category: 'Instagram',       amount: 2100, status: 'Pending', mode: 'UPI',  description: 'Team lunch with client' },
  ];

  // ---- Computed ----

  get totalExpenses(): number {
    return this.expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }

  get netPosition(): number {
    return this.counter - this.totalExpenses;
  }

  // ---- Counter ----

  updateCounter(value: number | string): void {
    this.counter = Number(value) || 0;
  }

  // ---- Expense CRUD ----

  addExpense(): void {
    this.expenses = [
      ...this.expenses,
      { title: '', category: 'Office Supplies', amount: 0, status: 'Pending', mode: 'Cash', description: '' }
    ];
  }

  removeExpense(index: number): void {
    this.expenses = this.expenses.filter((_, i) => i !== index);
  }

  // ---- Category dropdown ----

  toggleDropdown(index: number): void {
    this.openDropdown = this.openDropdown === index ? null : index;
  }

  selectCategory(index: number, name: string): void {
    this.expenses[index].category = name;
    this.openDropdown = null;
  }

  getCategoryIcon(name: string): string {
    const cat = this.categories.find(c => c.name === name);
    return cat ? cat.icon : this.categories[0].icon;
  }

  // Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.cat-wrap')) {
      this.openDropdown = null;
    }
  }

  // ---- Sync ----

  syncToDatabase(): void {
    // Replace with your actual API call, e.g.:
    // this.expenseService.sync({ counter: this.counter, expenses: this.expenses }).subscribe(...)

    this.synced = true;
    setTimeout(() => { this.synced = false; }, 2500);
  }
}
