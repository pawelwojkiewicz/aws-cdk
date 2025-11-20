import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'new-page',
    loadComponent: () => import('./new-page/new-page').then((m) => m.NewPage),
  },
];
