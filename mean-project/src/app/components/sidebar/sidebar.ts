import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css']
})
export class SidebarComponent implements OnInit, OnDestroy {

  @Input() isCollapsed = false;

  @Output() toggle = new EventEmitter<void>();

  isMobileMenuOpen = false;
  businessName = 'MEAN APP';
  private settingsSubscription = new Subscription();

  constructor(private settingsService: SettingsService) {}

  ngOnInit(): void {
    this.settingsSubscription = this.settingsService.settings$.subscribe((settings) => {
      this.businessName = settings.businessName;
    });
  }

  ngOnDestroy(): void {
    this.settingsSubscription.unsubscribe();
  }

  toggleSidebar() {
    this.toggle.emit();
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

}