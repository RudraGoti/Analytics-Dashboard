import { Component, Input, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent implements OnInit {

  @Input() isSidebarCollapsed = false;

  pageTitle = 'Dashboard';
  currentDate: string;
  isDropdownOpen = false;
  selectedFilter = 'This Year';

  constructor(private router: Router) {

    const today = new Date();

    this.currentDate = today.toLocaleDateString(
      'en-GB',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }
    );
  }

  ngOnInit(): void {

    this.updateTitle(this.router.url);

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {

        this.updateTitle(event.urlAfterRedirects);

      });
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

      case 'team':
        this.pageTitle = 'Team';
        break;

      case 'analytics':
        this.pageTitle = 'Analytics';
        break;

      case 'bookmarks':
        this.pageTitle = 'Bookmarks';
        break;

      case 'settings':
        this.pageTitle = 'Settings';
        break;

      default:
        this.pageTitle = 'Dashboard';
    }
  }

  toggleDropdown() {

    this.isDropdownOpen = !this.isDropdownOpen;

  }

  selectFilter(filterName: string) {

    this.selectedFilter = filterName;

    this.isDropdownOpen = false;

  }

}