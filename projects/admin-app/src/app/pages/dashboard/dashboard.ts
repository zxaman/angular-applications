import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button, PageHeader } from 'shared-ui';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, Button, PageHeader],
  template: `
    <lib-page-header
      badge="Admin App"
      title="Admin Dashboard"
      subtitle="A second app in the same monorepo — same shared-ui library, different project."
    />
    <div class="stats">
      <div class="stat"><strong>1,248</strong><span>Users</span></div>
      <div class="stat"><strong>312</strong><span>Orders</span></div>
      <div class="stat"><strong>98%</strong><span>Uptime</span></div>
    </div>
    <p>
      <a routerLink="/users"><lib-button>Manage users →</lib-button></a>
    </p>
  `,
  styles: `
    .stats { display: flex; gap: 1rem; margin-bottom: 1rem; }
    .stat {
      flex: 1;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      strong { font-size: 1.5rem; }
      span { color: #6b7280; font-size: 0.85rem; }
    }
    a { text-decoration: none; }
  `,
})
export class Dashboard {}
