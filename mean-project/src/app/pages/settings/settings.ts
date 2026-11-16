import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppSettings, SettingsService } from '../../services/settings.service';
import { ExpenseService } from '../../services/expense.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings implements OnInit, OnDestroy {
  settings: AppSettings = { businessName: '', defaultCategory: '', defaultMode: '', defaultStatus: '' };
  connectionStatus: 'checking' | 'connected' | 'unavailable' = 'checking';
  savedMessage = '';
  private settingsSubscription = new Subscription();

  constructor(
    private settingsService: SettingsService,
    private expenseService: ExpenseService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.settingsSubscription = this.settingsService.settings$.subscribe((settings) => {
      this.settings = { ...settings };
      this.cd.markForCheck();
    });
    this.checkServer();
  }

  ngOnDestroy(): void {
    this.settingsSubscription.unsubscribe();
  }

  save(): void {
    this.settingsService.save(this.settings);
    this.savedMessage = 'Settings saved.';
  }

  reset(): void {
    this.settingsService.reset();
    this.savedMessage = 'Settings restored to defaults.';
  }

  checkServer(): void {
    this.connectionStatus = 'checking';
    this.expenseService.getHealth().subscribe({
      next: (response) => {
        this.connectionStatus = response.ok && response.database ? 'connected' : 'unavailable';
        this.cd.markForCheck();
      },
      error: () => {
        this.connectionStatus = 'unavailable';
        this.cd.markForCheck();
      },
    });
  }
}
