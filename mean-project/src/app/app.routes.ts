import { Routes } from '@angular/router';

export const routes: Routes = [

  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard')
        .then(m => m.Dashboard)
  },

  {
    path: 'calendar',
    loadComponent: () =>
      import('./pages/calendar/calendar')
        .then(m => m.Calendar)
  },

  {
    path: 'notifications',
    loadComponent: () =>
      import('./pages/notifications/notifications')
        .then(m => m.Notifications)
  },

  {
    path: 'team',
    loadComponent: () =>
      import('./pages/team/team')
        .then(m => m.Team)
  },

  {
    path: 'analytics',
    loadComponent: () =>
      import('./pages/analytics/analytics')
        .then(m => m.Analytics)
  },

  {
    path: 'bookmarks',
    loadComponent: () =>
      import('./pages/bookmarks/bookmarks')
        .then(m => m.Bookmarks)
  },

  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/settings/settings')
        .then(m => m.Settings)
  },

  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }

];