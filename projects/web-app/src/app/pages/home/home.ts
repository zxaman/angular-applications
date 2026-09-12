import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button, PageHeader } from 'shared-ui';

@Component({
  selector: 'app-home',
  imports: [RouterLink, Button, PageHeader],
  template: `
    <lib-page-header
      badge="Web App"
      title="Welcome to Web App"
      subtitle="This is one of multiple apps in the Angular monorepo. It shares UI from the shared-ui library."
    />
    <div class="cards">
      <div class="card">
        <h3>🛠️ Monorepo setup</h3>
        <p>Apps live under <code>projects/*-app</code> and shared code under <code>projects/shared-*</code>.</p>
      </div>
      <div class="card">
        <h3>📦 Shared library</h3>
        <p>The header and buttons on this page come from <code>shared-ui</code>.</p>
        <p><lib-button variant="primary">Primary button</lib-button></p>
        <p><lib-button variant="secondary">Secondary button</lib-button></p>
      </div>
      <div class="card">
        <h3>🧭 Routing</h3>
        <p>Each app has its own router. Try the about page:</p>
        <p><a routerLink="/about">Go to About →</a></p>
      </div>
    </div>
  `,
  styles: `
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
    }
    .card {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 1.25rem;
      background: #fff;
    }
    .card h3 { margin-top: 0; }
    code {
      background: #f3f4f6;
      padding: 0.1rem 0.4rem;
      border-radius: 6px;
      font-size: 0.85em;
    }
    a { color: #4f46e5; font-weight: 600; }
  `,
})
export class Home {}
