import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent {

  @Input() isSidebarCollapsed = false;

  pageTitle = 'Dashboard';

}