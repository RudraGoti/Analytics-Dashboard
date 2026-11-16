import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AppSettings {
  businessName: string;
  defaultCategory: string;
  defaultMode: string;
  defaultStatus: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  businessName: 'MEAN APP',
  defaultCategory: 'Other',
  defaultMode: 'Cash',
  defaultStatus: 'Pending',
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly storageKey = 'analytics-dashboard-settings';
  readonly settings$ = new BehaviorSubject<AppSettings>(this.loadSettings());

  save(settings: AppSettings): void {
    const normalized = { ...settings, businessName: settings.businessName.trim() || DEFAULT_SETTINGS.businessName };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(normalized));
    } catch {
      // Settings remain available in memory when browser storage is unavailable.
    }
    this.settings$.next(normalized);
  }

  reset(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // Settings remain available in memory when browser storage is unavailable.
    }
    this.settings$.next({ ...DEFAULT_SETTINGS });
  }

  private loadSettings(): AppSettings {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } as AppSettings;
      }
    } catch {
      // Use defaults when browser storage is unavailable or contains invalid data.
    }
    return { ...DEFAULT_SETTINGS };
  }
}
