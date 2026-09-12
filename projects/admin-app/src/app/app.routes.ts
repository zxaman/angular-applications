import { Routes } from '@angular/router';
import { Dashboard } from './pages/dashboard/dashboard';
import { Users } from './pages/users/users';

export const routes: Routes = [
  { path: '', component: Dashboard, title: 'Admin — Dashboard' },
  { path: 'users', component: Users, title: 'Admin — Users' },
  { path: '**', redirectTo: '' },
];
