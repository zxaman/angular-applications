import { createDocument, createPage, type AppDocument, type AppNode } from '@appstudio/schema';
import { createNodeFromWidget } from './catalog';

/**
 * Starter templates. They double as living documentation of the document model
 * and as the fixture used by the generator tests.
 */

export function landingTemplate(name = 'Landing Page'): AppDocument {
  const doc = createDocument(name);

  const navbar = createNodeFromWidget('navbar', {
    props: { brand: name },
    children: [
      createNodeFromWidget('link', { props: { label: 'Features', href: '#features' } }),
      createNodeFromWidget('link', { props: { label: 'Pricing', href: '#pricing' } }),
      createNodeFromWidget('button', { props: { label: 'Get started', size: 'sm' } }),
    ],
  });

  const hero = createNodeFromWidget('column', {
    style: { 'align-items': 'center', 'text-align': 'center', gap: '18px', padding: '64px 20px' },
    children: [
      createNodeFromWidget('badge', { props: { text: 'New', variant: 'soft' } }),
      createNodeFromWidget('heading', { props: { text: 'Ship your next idea this weekend', level: 'h1' } }),
      createNodeFromWidget('text', {
        props: { text: 'Design screens visually, then export a clean, componentised Angular codebase.' },
        style: { 'max-width': '560px', color: 'var(--as-text-muted)' },
      }),
      createNodeFromWidget('row', {
        style: { 'justify-content': 'center' },
        children: [
          createNodeFromWidget('button', { props: { label: 'Start building', size: 'lg' } }),
          createNodeFromWidget('button', { props: { label: 'View docs', variant: 'outline', size: 'lg' } }),
        ],
      }),
    ],
  });

  const featureCard = (title: string, body: string): AppNode =>
    createNodeFromWidget('card', {
      props: { title, subtitle: body },
      children: [createNodeFromWidget('link', { props: { label: 'Learn more' } })],
    });

  const features = createNodeFromWidget('container', {
    name: 'Features',
    style: { padding: '48px 20px', 'max-width': '1100px', margin: '0 auto', gap: '20px' },
    children: [
      createNodeFromWidget('heading', { props: { text: 'Everything you need', level: 'h2' }, style: { 'text-align': 'center' } }),
      createNodeFromWidget('grid', {
        props: { columns: 3 },
        styles: { sm: { '--as-cols': '1' }, md: { '--as-cols': '2' }, lg: { '--as-cols': '3' } },
        children: [
          featureCard('Drag and drop', 'Compose screens from a widget library without writing markup.'),
          featureCard('Real components', 'Export standalone Angular components with their own styles.'),
          featureCard('Your CSS', 'Import your own stylesheet per component and keep your design system.'),
        ],
      }),
    ],
  });

  const signup = createNodeFromWidget('card', {
    props: { title: 'Stay in the loop', subtitle: 'One email a month. No noise.' },
    style: { 'max-width': '460px', margin: '48px auto' },
    children: [
      createNodeFromWidget('form', {
        props: { submitLabel: 'Subscribe' },
        children: [
          createNodeFromWidget('text-input', {
            props: { label: 'Email address', inputType: 'email', placeholder: 'you@example.com', name: 'email', required: true },
          }),
          createNodeFromWidget('checkbox', { props: { label: 'Send me product updates' } }),
        ],
      }),
    ],
  });

  const home = doc.pages[0];
  if (home) {
    home.root = createNodeFromWidget('container', {
      style: { padding: '0', gap: '0' },
      children: [navbar, hero, features, signup],
    });
    home.title = `${name} — Home`;
  }

  doc.pages.push(
    createPage({
      name: 'About',
      route: 'about',
      root: createNodeFromWidget('container', {
        style: { 'max-width': '760px', margin: '0 auto', padding: '48px 20px', gap: '16px' },
        children: [
          createNodeFromWidget('breadcrumb', { props: { items: '/: Home\n/about: About' } }),
          createNodeFromWidget('heading', { props: { text: 'About', level: 'h1' } }),
          createNodeFromWidget('text', { props: { text: 'Tell the story of your product here.' } }),
          createNodeFromWidget('image', { props: { alt: 'Team photo' } }),
        ],
      }),
    }),
  );

  doc.meta.updatedAt = new Date().toISOString();
  return doc;
}

export function blankTemplate(name = 'Blank App'): AppDocument {
  return createDocument(name);
}

export interface TemplateDef {
  id: string;
  label: string;
  description: string;
  build: (name: string) => AppDocument;
}

export const TEMPLATES: TemplateDef[] = [
  { id: 'landing', label: 'Landing page', description: 'Navbar, hero, feature grid and a signup card.', build: landingTemplate },
  { id: 'blank', label: 'Blank', description: 'A single empty page.', build: blankTemplate },
];
