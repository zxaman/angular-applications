import { emitHandlerBody, type ActionContext } from './actions';
import { escapeTs } from './naming';
import type { ComponentPlan } from './plan';
import type { TemplateResult } from './template';

/** Relative ES module path between two generated folders (both under `src/app`). */
export function relativeImportPath(fromFolder: string, toFolder: string, fileBase: string): string {
  const from = fromFolder.split('/');
  const to = [...toFolder.split('/'), fileBase];
  while (from.length > 0 && to.length > 1 && from[0] === to[0]) {
    from.shift();
    to.shift();
  }
  const prefix = from.length > 0 ? '../'.repeat(from.length) : './';
  return `${prefix}${to.join('/')}`;
}

function inputDeclaration(name: string, type: string, value: string | number | boolean, label: string): string {
  const literal = type === 'string' ? `'${escapeTs(String(value))}'` : String(value);
  return `  /** ${label}. */\n  readonly ${name} = input<${type}>(${literal});`;
}

/** Emits the standalone component class for a plan. */
/** Empty action context: handlers fall back to TODO stubs. */
const NO_ACTIONS: ActionContext = { state: [], routeOf: () => undefined };

export function emitComponentClass(
  plan: ComponentPlan,
  template: TemplateResult,
  childPlans: ComponentPlan[],
  actions: ActionContext = NO_ACTIONS,
): string {
  // Handler bodies are resolved first: they decide which services to inject.
  const needs: { router: boolean; http: boolean; store: boolean } = { router: false, http: false, store: false };
  const handlerBlocks: string[] = [];
  let hasSubmitHandler = false;

  for (const handler of template.handlers) {
    const emitted = handler.actions.length > 0 ? emitHandlerBody(handler.actions, actions) : null;
    if (emitted) {
      needs.router ||= emitted.needs.router;
      needs.http ||= emitted.needs.http;
      needs.store ||= emitted.needs.store;
    }
    if (handler.param === 'form') {
      hasSubmitHandler = true;
    }
    const body = emitted
      ? emitted.body
      : handler.param === 'form'
        ? `    // TODO: replace with your API call.\n    console.log('${escapeTs(plan.className)} form submitted', form.value);`
        : '    // TODO: implement this action.\n    void event;';
    const signature = handler.param === 'form' ? 'form: NgForm' : 'event: MouseEvent';
    handlerBlocks.push(`  /** ${handler.comment} */\n  protected ${handler.name}(${signature}): void {\n${body}\n  }`);
  }

  const usesStore = template.needsStore || needs.store;
  const usesInject = usesStore || needs.router || needs.http;

  const coreImports = ['ChangeDetectionStrategy', 'Component'];
  if (plan.inputs.length > 0) {
    coreImports.push('input');
  }
  if (usesInject) {
    coreImports.push('inject');
  }

  const importLines: string[] = [`import { ${coreImports.join(', ')} } from '@angular/core';`];
  const componentImports: string[] = [];

  if (needs.http) {
    importLines.push("import { HttpClient } from '@angular/common/http';");
  }
  if (usesStore) {
    importLines.push(`import { AppStore } from '${relativeImportPath(plan.folder, 'core', 'app-store')}';`);
  }
  if (template.needsForms || handlerBlocks.some((block) => block.includes('form: NgForm')) || template.hasForm) {
    importLines.push("import { FormsModule, type NgForm } from '@angular/forms';");
    componentImports.push('FormsModule');
  }
  if (template.needsRouter || needs.router) {
    const names = [template.needsRouter ? 'RouterLink' : null, needs.router ? 'Router' : null].filter(Boolean);
    importLines.push(`import { ${names.join(', ')} } from '@angular/router';`);
    if (template.needsRouter) {
      componentImports.push('RouterLink');
    }
  }
  for (const child of childPlans) {
    const path = relativeImportPath(plan.folder, child.folder, child.fileBase);
    importLines.push(`import { ${child.className} } from '${path}';`);
    componentImports.push(child.className);
  }

  const decorator = [
    '@Component({',
    `  selector: '${plan.selector}',`,
    `  templateUrl: './${plan.fileBase}.html',`,
    `  styleUrl: './${plan.fileBase}.scss',`,
    '  changeDetection: ChangeDetectionStrategy.OnPush,',
    componentImports.length > 0 ? `  imports: [${componentImports.join(', ')}],` : null,
    '})',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  const members: string[] = [];

  if (needs.http) {
    members.push('  private readonly http = inject(HttpClient);');
  }
  if (needs.router) {
    members.push('  private readonly router = inject(Router);');
  }
  if (usesStore) {
    members.push('  protected readonly store = inject(AppStore);');
  }

  if (plan.inputs.length > 0) {
    members.push(plan.inputs.map((item) => inputDeclaration(item.name, item.type, item.value, item.label)).join('\n\n'));
  }

  const modelKeys = Object.entries(template.modelDefaults);
  if (modelKeys.length > 0) {
    const initial = modelKeys.map(([key, value]) => `'${escapeTs(key)}': ${value}`).join(', ');
    members.push(`  /** Form values, keyed by field name. */\n  protected model: Record<string, unknown> = { ${initial} };`);
  }

  if (template.hasForm && !hasSubmitHandler) {
    members.push(
      `  protected onSubmit(form: NgForm): void {\n    // TODO: replace with your API call.\n    console.log('${escapeTs(
        plan.className,
      )} form submitted', form.value);\n  }`,
    );
  }

  if (handlerBlocks.length > 0) {
    members.push(handlerBlocks.join('\n\n'));
  }

  const header = `/* Generated by AppStudio — ${plan.className}. */`;
  return `${header}\n${importLines.join('\n')}\n\n${decorator}\nexport class ${plan.className} {\n${
    members.length > 0 ? `${members.join('\n\n')}\n` : ''
  }}\n`;
}

/** Smoke spec emitted next to page components so `npm test` works out of the box. */
export function emitComponentSpec(plan: ComponentPlan, template: TemplateResult): string {
  const routerImport = template.needsRouter ? "import { provideRouter } from '@angular/router';\n" : '';
  const providers = template.needsRouter ? ', providers: [provideRouter([])]' : '';
  return `import { ComponentFixture, TestBed } from '@angular/core/testing';
${routerImport}import { ${plan.className} } from './${plan.fileBase}';

describe('${plan.className}', () => {
  let fixture: ComponentFixture<${plan.className}>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [${plan.className}]${providers} }).compileComponents();
    fixture = TestBed.createComponent(${plan.className});
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders its template', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.innerHTML.trim().length).toBeGreaterThan(0);
  });
});
`;
}
