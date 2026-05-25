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
    path: 'Reports',
    loadComponent: () =>
      import('./pages/Reports/Reports')
        .then(m => m.Reports)
  },

  {
    path: 'analytics',
    loadComponent: () =>
      import('./pages/analytics/analytics')
        .then(m => m.Analytics)
  },

  {
    path: 'AddExpense',
    loadComponent: () =>
      import('./pages/AddExpense/AddExpense')
        .then(m => m.AddExpense)
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