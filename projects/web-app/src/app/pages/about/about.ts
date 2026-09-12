import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeader } from 'shared-ui';

@Component({
  selector: 'app-about',
  imports: [RouterLink, PageHeader],
  template: `
    <lib-page-header
      badge="Web App"
      title="About this monorepo"
      subtitle="One workspace, many projects — apps + libraries versioned and built together."
    />
    <p>This page is routed at <code>/about</code> inside <strong>web-app</strong> only.</p>
    <p>The <strong>admin-app</strong> is a completely separate application in the same repo.</p>
    <p><a routerLink="/">← Back to Home</a></p>
  `,
  styles: `
    code { background: #f3f4f6; padding: 0.1rem 0.4rem; border-radius: 6px; }
    a { color: #4f46e5; font-weight: 600; }
  `,
})
export class About {}
