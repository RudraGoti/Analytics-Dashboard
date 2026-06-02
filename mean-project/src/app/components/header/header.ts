import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { DateService } from '../../services/date.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent implements OnInit {

  @Input() isSidebarCollapsed = false;

  pageTitle = 'Dashboard';
  currentDate: string;
  selectedDate: string;

  constructor(private router: Router, private dateService: DateService) {

    const today = new Date();

    this.currentDate = today.toLocaleDateString(
      'en-GB',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }
    );

    this.selectedDate = this.dateService.selectedDate$.getValue();
  }

  ngOnInit(): void {
    this.dateService.selectedDate$.subscribe((date) => {
      this.selectedDate = date;
    });

    this.updateTitle(this.router.url);

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.updateTitle(event.urlAfterRedirects);
      });
  }

  setSelectedDate(value: string): void {
    this.dateService.selectedDate$.next(value);
  }

  updateTitle(url: string) {

    const route = url.split('/')[1];

    switch(route) {

      case 'dashboard':
        this.pageTitle = 'Dashboard';
        break;

      case 'calendar':
        this.pageTitle = 'Calendar';
        break;

      case 'notifications':
        this.pageTitle = 'Notifications';
        break;

      case 'Reports':
        this.pageTitle = 'Reports';
        break;

      case 'analytics':
        this.pageTitle = 'Analytics';
        break;

      case 'AddExpense':
        this.pageTitle = 'Add Expense';
        break;

      case 'settings':
        this.pageTitle = 'Settings';
        break;

      default:
        this.pageTitle = 'Dashboard';
    }
  }

}