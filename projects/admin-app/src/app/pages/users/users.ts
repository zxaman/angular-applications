import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeader } from 'shared-ui';

@Component({
  selector: 'app-users',
  imports: [RouterLink, PageHeader],
  template: `
    <lib-page-header
      badge="Admin App"
      title="Users"
      subtitle="Routed at /users inside admin-app only."
    />
    <table class="users">
      <thead><tr><th>Name</th><th>Role</th><th>Status</th></tr></thead>
      <tbody>
        <tr><td>Aarav Sharma</td><td>Admin</td><td>Active</td></tr>
        <tr><td>Diya Patel</td><td>Editor</td><td>Active</td></tr>
        <tr><td>Kabir Singh</td><td>Viewer</td><td>Invited</td></tr>
      </tbody>
    </table>
    <p><a routerLink="/">← Back to Dashboard</a></p>
  `,
  styles: `
    .users { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; }
    .users th, .users td { padding: 0.75rem 1rem; border-bottom: 1px solid #e5e7eb; text-align: left; }
    .users thead { background: #f3f4f6; }
    a { color: #4f46e5; font-weight: 600; }
  `,
})
export class Users {}
