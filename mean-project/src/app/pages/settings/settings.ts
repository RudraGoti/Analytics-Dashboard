import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseService } from '../../services/expense.service';

const HIGH_EXPENSE_KEY = 'ad_settings_high_expense_threshold';
const PROFILE_KEY = 'ad_settings_profile';
const PREFS_KEY = 'ad_settings_prefs';
const READ_KEY = 'ad_notifications_read';
const HISTORY_KEY = 'ad_report_history';

interface Profile {
  name: string;
  email: string;
  businessName: string;
}

interface Prefs {
  defaultMode: string;
  weekStartsMonday: boolean;
  compactTables: boolean;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings implements OnInit {

  profile: Profile = { name: '', email: '', businessName: '' };
  prefs: Prefs = { defaultMode: 'Cash', weekStartsMonday: false, compactTables: false };

  highExpenseThreshold = 5000;

  savedMessage = '';
  isExporting = false;
  exportError = '';

  constructor(private expenseService: ExpenseService) {}

  ngOnInit(): void {
    this.loadProfile();
    this.loadPrefs();
    this.loadThreshold();
  }

  private loadProfile(): void {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      this.profile = raw ? JSON.parse(raw) : this.profile;
    } catch (e) {}
  }

  private loadPrefs(): void {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      this.prefs = raw ? { ...this.prefs, ...JSON.parse(raw) } : this.prefs;
    } catch (e) {}
  }

  private loadThreshold(): void {
    try {
      const raw = localStorage.getItem(HIGH_EXPENSE_KEY);
      this.highExpenseThreshold = raw ? Number(raw) : 5000;
    } catch (e) {}
  }

  saveProfile(): void {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile));
      this.flashSaved('Profile saved.');
    } catch (e) {
      console.warn('Settings: failed to save profile', e);
    }
  }

  savePrefs(): void {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
      this.flashSaved('Preferences saved.');
    } catch (e) {
      console.warn('Settings: failed to save preferences', e);
    }
  }

  saveThreshold(): void {
    try {
      localStorage.setItem(HIGH_EXPENSE_KEY, String(this.highExpenseThreshold || 0));
      this.flashSaved('Notification threshold updated.');
    } catch (e) {
      console.warn('Settings: failed to save threshold', e);
    }
  }

  private flashSaved(message: string): void {
    this.savedMessage = message;
    setTimeout(() => (this.savedMessage = ''), 2500);
  }

  exportAllData(): void {
    if (this.isExporting) return;
    this.isExporting = true;
    this.exportError = '';

    this.expenseService.getExpenses().subscribe({
      next: (records) => {
        const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-dashboard-export-${this.todayKey()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.isExporting = false;
      },
      error: (err) => {
        console.error('Settings: failed to export data', err);
        this.exportError = 'Unable to export data right now. Please check your connection to the server.';
        this.isExporting = false;
      },
    });
  }

  clearLocalAppData(): void {
    const confirmed = window.confirm(
      'This clears locally stored preferences, notification read-state and report history on this device. Your saved expenses on the server are not affected. Continue?'
    );
    if (!confirmed) return;

    [HIGH_EXPENSE_KEY, PROFILE_KEY, PREFS_KEY, READ_KEY, HISTORY_KEY].forEach((key) => {
      try { localStorage.removeItem(key); } catch (e) {}
    });

    this.profile = { name: '', email: '', businessName: '' };
    this.prefs = { defaultMode: 'Cash', weekStartsMonday: false, compactTables: false };
    this.highExpenseThreshold = 5000;

    this.flashSaved('Local app data cleared.');
  }

  private todayKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
