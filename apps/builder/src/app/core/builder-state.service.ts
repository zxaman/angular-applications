import { computed, Injectable, signal } from '@angular/core';
import {
  addComponentInput,
  addNodeAction,
  addStateVariable,
  cloneDocument,
  cloneNodeWithNewIds,
  countNodes,
  createDocument,
  createPage,
  duplicateNode,
  findNode,
  findPage,
  insertNode,
  moveNode,
  removeNode,
  countInstances,
  createComponent,
  createStateVariable,
  detachInstance,
  deleteComponent,
  findComponent,
  inferInputs,
  insertInstance,
  removeComponentInput,
  removeNodeAction,
  removeStateVariable,
  setNodeComponentName,
  setNodeCss,
  setNodeRepeat,
  saveNodeAsComponent,
  updateComponent,
  updateComponentInput,
  updateInstanceProp,
  updateNodeAction,
  updateStateVariable,
  setNodeStyle,
  slugifyRoute,
  updateNode,
  updateNodeProps,
  widgetTypesUsed,
  type AppDocument,
  type AppNode,
  type AppSettings,
  type Breakpoint,
  type ComponentDef,
  type ComponentInputDef,
  type CssMap,
  type NodeAction,
  type NodeLocation,
  type PageDef,
  type RepeatConfig,
  type StateType,
  type StateVariable,
  type StyleFile,
  type ThemeTokens,
} from '@appstudio/schema';
import { createNodeFromWidget, derivedStyle, getWidget, getWidgetOrFallback } from '@appstudio/widgets';

export type LeftPanel = 'widgets' | 'layers' | 'pages' | 'data' | 'theme';
export type RightPanel = 'design' | 'styles' | 'code';

const HISTORY_LIMIT = 60;

/**
 * Single source of truth for the studio.
 *
 * Every mutation goes through `commit()`, which snapshots the previous document
 * for undo/redo and marks the project dirty for autosave. Components only read
 * signals and call these methods — no direct document mutation anywhere else.
 */
@Injectable({ providedIn: 'root' })
export class BuilderStateService {
  readonly document = signal<AppDocument>(createDocument('Untitled App'));
  readonly selectedId = signal<string | null>(null);
  readonly activePageId = signal<string>('');
  readonly breakpoint = signal<Breakpoint>('md');
  readonly preview = signal(false);
  readonly zoom = signal(100);
  readonly leftPanel = signal<LeftPanel>('widgets');
  readonly rightPanel = signal<RightPanel>('design');
  readonly leftOpen = signal(true);
  readonly rightOpen = signal(true);
  readonly dirty = signal(false);
  readonly lastSavedAt = signal<string | null>(null);
  readonly notice = signal<{ text: string; tone: 'info' | 'error' } | null>(null);

  private readonly past = signal<AppDocument[]>([]);
  private readonly future = signal<AppDocument[]>([]);

  readonly canUndo = computed(() => this.past().length > 0);
  readonly canRedo = computed(() => this.future().length > 0);

  readonly activePage = computed<PageDef | null>(() => {
    const doc = this.document();
    return findPage(doc, this.activePageId()) ?? doc.pages[0] ?? null;
  });

  /** When set, the canvas edits a library component instead of a page. */
  readonly editingComponentId = signal<string | null>(null);

  readonly components = computed<ComponentDef[]>(() => this.document().components);

  readonly editingComponent = computed<ComponentDef | null>(() => {
    const id = this.editingComponentId();
    return id ? findComponent(this.document(), id) ?? null : null;
  });

  /** Root node the canvas renders: the component being edited, else the page. */
  readonly activeRoot = computed<AppNode | null>(() => this.editingComponent()?.root ?? this.activePage()?.root ?? null);

  /** The component definition behind the selected node, when it is an instance. */
  readonly selectedInstance = computed<ComponentDef | null>(() => {
    const node = this.selectedNode();
    return node?.instance ? findComponent(this.document(), node.instance.componentId) ?? null : null;
  });

  readonly instanceCount = computed(() => {
    const node = this.selectedNode();
    return node?.instance ? countInstances(this.document(), node.instance.componentId) : 0;
  });

  readonly selection = computed<NodeLocation | null>(() => {
    const id = this.selectedId();
    return id ? findNode(this.document(), id) : null;
  });

  readonly selectedNode = computed<AppNode | null>(() => this.selection()?.node ?? null);

  readonly selectedWidget = computed(() => {
    const node = this.selectedNode();
    return node ? getWidgetOrFallback(node.type) : null;
  });

  readonly nodeCount = computed(() => {
    const root = this.activeRoot();
    return root ? countNodes(root) : 0;
  });

  readonly widgetTypes = computed(() => widgetTypesUsed(this.document()));

  constructor() {
    const doc = this.document();
    this.activePageId.set(doc.pages[0]?.id ?? '');
  }

  // ---------------------------------------------------------------- lifecycle

  /** Replaces the whole document (open project, template, undo/redo). */
  load(doc: AppDocument, options: { keepHistory?: boolean; markDirty?: boolean } = {}): void {
    if (options.keepHistory !== false) {
      this.pushHistory(this.document());
    }
    this.document.set(doc);
    const active = findPage(doc, this.activePageId()) ?? doc.pages[0];
    this.activePageId.set(active?.id ?? '');
    const selected = this.selectedId();
    if (selected && !findNode(doc, selected)) {
      this.selectedId.set(null);
    }
    if (options.markDirty !== false) {
      this.dirty.set(true);
    }
  }

  newProject(name: string, template: (name: string) => AppDocument): void {
    this.load(template(name));
    this.selectedId.set(null);
    this.notify(`Started "${name}"`);
  }

  reset(): void {
    this.load(createDocument(this.document().meta.name));
    this.selectedId.set(null);
  }

  // ------------------------------------------------------------------ history

  private pushHistory(doc: AppDocument): void {
    this.past.update((entries) => [...entries.slice(-HISTORY_LIMIT), cloneDocument(doc)]);
    this.future.set([]);
  }

  undo(): void {
    this.past.update((entries) => {
      const previous = entries[entries.length - 1];
      if (!previous) {
        return entries;
      }
      this.future.update((future) => [...future, cloneDocument(this.document())]);
      this.document.set(previous);
      this.dirty.set(true);
      this.revalidateSelection();
      return entries.slice(0, -1);
    });
  }

  redo(): void {
    this.future.update((entries) => {
      const next = entries[entries.length - 1];
      if (!next) {
        return entries;
      }
      this.past.update((past) => [...past, cloneDocument(this.document())]);
      this.document.set(next);
      this.dirty.set(true);
      this.revalidateSelection();
      return entries.slice(0, -1);
    });
  }

  private revalidateSelection(): void {
    const id = this.selectedId();
    if (id && !findNode(this.document(), id)) {
      this.selectedId.set(null);
    }
  }

  private commit(mutator: (doc: AppDocument) => AppDocument, options: { history?: boolean } = {}): void {
    const current = this.document();
    const next = mutator(current);
    if (next === current) {
      return;
    }
    if (options.history !== false) {
      this.pushHistory(current);
    }
    this.document.set({ ...next, meta: { ...next.meta, updatedAt: new Date().toISOString() } });
    this.dirty.set(true);
    this.revalidateSelection();
  }

  notify(text: string, tone: 'info' | 'error' = 'info'): void {
    this.notice.set({ text, tone });
    setTimeout(() => {
      const current = this.notice();
      if (current?.text === text) {
        this.notice.set(null);
      }
    }, 3200);
  }

  markSaved(): void {
    this.dirty.set(false);
    this.lastSavedAt.set(new Date().toISOString());
  }

  // ----------------------------------------------------------------- nodes

  addWidget(type: string, parentId: string, index = -1): string | null {
    const node = createNodeFromWidget(type);
    this.commit((doc) => insertNode(doc, parentId, node, index));
    this.selectedId.set(node.id);
    return node.id;
  }

  addWidgetFromDrop(type: string, parentId: string, index: number): void {
    this.addWidget(type, parentId, index);
  }

  updateProp(key: string, value: string | number | boolean | null): void {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.commit((doc) =>
      updateNode(doc, id, (node) => {
        const props = { ...node.props, [key]: value };
        const next = { ...node, props };
        return { ...next, style: { ...next.style, ...derivedStyle(next) } };
      }),
    );
  }

  setStyle(property: string, value: string, breakpoint: Breakpoint = this.breakpoint()): void {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.commit((doc) => setNodeStyle(doc, id, breakpoint, property, value || null));
  }

  setStyles(patch: CssMap, breakpoint: Breakpoint = this.breakpoint()): void {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.commit((doc) => {
      let next = doc;
      for (const [property, value] of Object.entries(patch)) {
        next = setNodeStyle(next, id, breakpoint, property, value || null);
      }
      return next;
    });
  }

  setNodeCss(css: string, fileName?: string): void {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.commit((doc) => setNodeCss(doc, id, css, fileName));
  }

  setComponentName(name: string): void {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.commit((doc) => setNodeComponentName(doc, id, name));
  }

  renameNode(name: string): void {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.commit((doc) => updateNode(doc, id, (node) => ({ ...node, name: name.trim() || undefined })));
  }

  deleteSelected(): void {
    const location = this.selection();
    if (!location || !location.parent) {
      return;
    }
    const id = location.node.id;
    this.commit((doc) => removeNode(doc, id).doc);
    this.selectedId.set(location.parent.id);
  }

  duplicateSelected(): void {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    let copyId: string | null = null;
    this.commit((doc) => {
      const result = duplicateNode(doc, id);
      copyId = result.copy?.id ?? null;
      return result.doc;
    });
    if (copyId) {
      this.selectedId.set(copyId);
    }
  }

  /** Wraps the selection in a new container — the quickest way to group widgets. */
  wrapSelected(type = 'container'): void {
    const location = this.selection();
    if (!location || !location.parent) {
      return;
    }
    const node = location.node;
    const parentId = location.parent.id;
    const index = location.index;
    const wrapper = createNodeFromWidget(type, { children: [node] });
    this.commit((doc) => {
      const without = removeNode(doc, node.id);
      return insertNode(without.doc, parentId, { ...wrapper, children: [node] }, index);
    });
    this.selectedId.set(wrapper.id);
  }

  moveSelected(delta: number): void {
    const location = this.selection();
    if (!location?.parent) {
      return;
    }
    const target = location.index + delta;
    if (target < 0 || target >= location.parent.children.length) {
      return;
    }
    const parentId = location.parent.id;
    this.commit((doc) => moveNode(doc, location.node.id, parentId, target) ?? doc);
  }

  /** Re-parents a node (drag and drop, keyboard "move into"). */
  moveNode(id: string, parentId: string, index: number): void {
    this.commit((doc) => moveNode(doc, id, parentId, index) ?? doc);
    this.selectedId.set(id);
  }

  insertWidget(type: string, parentId: string, index: number): void {
    this.addWidget(type, parentId, index);
  }

  select(id: string | null): void {
    this.selectedId.set(id);
  }

  selectParent(): void {
    const location = this.selection();
    if (location?.parent) {
      this.selectedId.set(location.parent.id);
    }
  }

  selectFirstChild(): void {
    const node = this.selectedNode();
    const child = node?.children[0];
    if (child) {
      this.selectedId.set(child.id);
    }
  }

  selectSibling(delta: number): void {
    const location = this.selection();
    if (!location?.parent) {
      return;
    }
    const next = location.parent.children[location.index + delta];
    if (next) {
      this.selectedId.set(next.id);
    }
  }

  // ------------------------------------------------------------------ state

  readonly stateVariables = computed(() => this.document().state);

  addStateVariable(name: string, type: StateType = 'string'): void {
    if (!name.trim()) {
      this.notify('Give the variable a name first.', 'error');
      return;
    }
    const variable = createStateVariable({ name, type });
    if (this.document().state.some((entry) => entry.name === variable.name)) {
      this.notify(`"${variable.name}" already exists.`, 'error');
      return;
    }
    this.commit((doc) => addStateVariable(doc, variable));
    this.notify(`Added state "${variable.name}"`);
  }

  updateStateVariable(id: string, patch: Partial<StateVariable>): void {
    this.commit((doc) => updateStateVariable(doc, id, patch));
  }

  removeStateVariable(id: string): void {
    this.commit((doc) => removeStateVariable(doc, id));
  }

  // ---------------------------------------------------------------- actions

  readonly selectedActions = computed(() => this.selectedNode()?.actions ?? []);

  addNodeAction(action: NodeAction): void {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.commit((doc) => addNodeAction(doc, id, action));
  }

  updateNodeAction(actionId: string, patch: Partial<NodeAction>): void {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.commit((doc) => updateNodeAction(doc, id, actionId, patch));
  }

  removeNodeAction(actionId: string): void {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.commit((doc) => removeNodeAction(doc, id, actionId));
  }

  setNodeRepeat(repeat: RepeatConfig | undefined): void {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.commit((doc) => setNodeRepeat(doc, id, repeat));
  }

  // ------------------------------------------------------------- components

  /** Saves the selected node as a reusable component, leaving an instance behind. */
  saveSelectedAsComponent(name: string): void {
    const node = this.selectedNode();
    if (!node) {
      this.notify('Select a widget first.', 'error');
      return;
    }
    if (node.instance) {
      this.notify('That node is already a component instance.', 'error');
      return;
    }
    const label = name.trim() || node.name?.trim() || this.selectedWidget()?.label || 'Component';
    let created = '';
    this.commit((doc) => {
      const saved = saveNodeAsComponent(doc, node.id, label);
      if (!saved) {
        return doc;
      }
      created = saved.componentId;
      return saved.doc;
    });
    if (!created) {
      this.notify('Could not save that widget as a component.', 'error');
      return;
    }
    this.notify(`Saved "${label}" to the component library`);
  }

  insertComponentInstance(componentId: string, parentId: string, index: number): void {
    this.commit((doc) => insertInstance(doc, componentId, parentId, index) ?? doc);
    const component = findComponent(this.document(), componentId);
    this.notify(`Placed "${component?.name ?? 'component'}"`);
  }

  setInstanceProp(key: string, value: string | number | boolean): void {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.commit((doc) => updateInstanceProp(doc, id, key, value));
  }

  /** Replaces the selected instance with an editable copy of the component. */
  detachSelectedInstance(): void {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.commit((doc) => detachInstance(doc, id));
    this.notify('Instance detached — it is now an ordinary widget');
  }

  editComponent(id: string): void {
    this.editingComponentId.set(id);
    this.selectedId.set(null);
    const component = findComponent(this.document(), id);
    this.notify(`Editing component "${component?.name ?? ''}"`);
  }

  exitComponentEditing(): void {
    this.editingComponentId.set(null);
    this.selectedId.set(null);
  }

  renameComponent(id: string, name: string): void {
    if (!name.trim()) {
      return;
    }
    this.commit((doc) => updateComponent(doc, id, { name: name.trim() }));
  }

  updateComponentDescription(id: string, description: string): void {
    this.commit((doc) => updateComponent(doc, id, { description: description.trim() || undefined }));
  }

  removeComponent(id: string): void {
    const component = findComponent(this.document(), id);
    this.commit((doc) => deleteComponent(doc, id));
    if (this.editingComponentId() === id) {
      this.editingComponentId.set(null);
    }
    this.notify(`Deleted "${component?.name ?? 'component'}" and detached its instances`);
  }

  updateComponentInput(componentId: string, inputName: string, patch: Partial<ComponentInputDef>): void {
    this.commit((doc) => updateComponentInput(doc, componentId, inputName, patch));
  }

  addComponentInput(componentId: string, name: string): void {
    const input: ComponentInputDef = { name: name.trim(), label: name.trim(), type: 'string', default: '' };
    if (!input.name) {
      return;
    }
    this.commit((doc) => addComponentInput(doc, componentId, input));
  }

  removeComponentInput(componentId: string, inputName: string): void {
    this.commit((doc) => removeComponentInput(doc, componentId, inputName));
  }

  /** Re-derives inputs from the component's current root props. */
  refreshComponentInputs(componentId: string): void {
    const component = findComponent(this.document(), componentId);
    if (!component) {
      return;
    }
    this.commit((doc) => updateComponent(doc, componentId, { inputs: inferInputs(component.root) }));
    this.notify('Inputs refreshed from the component content');
  }

  /** Exposes the factory so panels can build components from scratch. */
  createEmptyComponent(name: string): string | null {
    const root = createNodeFromWidget('column', { name: name.trim() || 'Component' });
    let id: string | null = null;
    this.commit((doc) => {
      const definition = createComponent({ name: name.trim() || 'Component', root });
      id = definition.id;
      return { ...doc, components: [...doc.components, definition] };
    });
    return id;
  }

  // ------------------------------------------------------------------ pages

  setActivePage(id: string): void {
    this.activePageId.set(id);
    this.selectedId.set(null);
  }

  addPage(name: string): void {
    const page = createPage({ name });
    this.commit((doc) => ({ ...doc, pages: [...doc.pages, page] }));
    this.activePageId.set(page.id);
    this.selectedId.set(null);
  }

  updatePage(id: string, patch: Partial<Pick<PageDef, 'name' | 'route' | 'title'>>): void {
    this.commit((doc) => ({
      ...doc,
      pages: doc.pages.map((page) => {
        if (page.id !== id) {
          return page;
        }
        const next = { ...page, ...patch };
        if (patch.name && patch.route === undefined) {
          next.route = slugifyRoute(patch.name);
        }
        return next;
      }),
    }));
  }

  deletePage(id: string): void {
    const doc = this.document();
    if (doc.pages.length <= 1) {
      this.notify('A project needs at least one page.', 'error');
      return;
    }
    this.commit((current) => ({ ...current, pages: current.pages.filter((page) => page.id !== id) }));
    if (this.activePageId() === id) {
      this.activePageId.set(this.document().pages[0]?.id ?? '');
    }
  }

  duplicatePage(id: string): void {
    const page = findPage(this.document(), id);
    if (!page) {
      return;
    }
    const copy = createPage({
      name: `${page.name} copy`,
      root: cloneNodeWithNewIds(page.root),
    });
    this.commit((doc) => ({ ...doc, pages: [...doc.pages, copy] }));
    this.activePageId.set(copy.id);
  }

  setPageCss(css: string, fileName?: string): void {
    const id = this.activePageId();
    this.commit((doc) => ({
      ...doc,
      pages: doc.pages.map((page) =>
        page.id === id ? { ...page, css: css.trim() ? css : undefined, cssFileName: css.trim() ? fileName : undefined } : page,
      ),
    }));
  }

  // ------------------------------------------------------------------ theme

  updateTheme(patch: Partial<ThemeTokens>): void {
    this.commit((doc) => ({ ...doc, theme: { ...doc.theme, ...patch } }), { history: true });
  }

  updateMeta(patch: Partial<AppDocument['meta']>): void {
    this.commit((doc) => ({ ...doc, meta: { ...doc.meta, ...patch } }));
  }

  updateSettings(patch: Partial<AppSettings>): void {
    this.commit((doc) => ({ ...doc, settings: { ...doc.settings, ...patch } }));
  }

  addGlobalStyle(file: StyleFile): void {
    this.commit((doc) => ({
      ...doc,
      globalStyles: [...doc.globalStyles.filter((style) => style.name !== file.name), file],
    }));
    this.notify(`Imported ${file.name}`);
  }

  removeGlobalStyle(name: string): void {
    this.commit((doc) => ({ ...doc, globalStyles: doc.globalStyles.filter((style) => style.name !== name) }));
  }

  // ------------------------------------------------------------------- view

  setBreakpoint(breakpoint: Breakpoint): void {
    this.breakpoint.set(breakpoint);
  }

  setPreview(preview: boolean): void {
    this.preview.set(preview);
    if (preview) {
      this.selectedId.set(null);
    }
  }

  setZoom(zoom: number): void {
    this.zoom.set(Math.min(200, Math.max(40, Math.round(zoom))));
  }

  setLeftPanel(panel: LeftPanel): void {
    this.leftPanel.set(panel);
    this.leftOpen.set(true);
  }

  setRightPanel(panel: RightPanel): void {
    this.rightPanel.set(panel);
    this.rightOpen.set(true);
  }

  toggleLeft(): void {
    this.leftOpen.update((open) => !open);
  }

  toggleRight(): void {
    this.rightOpen.update((open) => !open);
  }

  /** Widget definition helpers used by panels. */
  widgetOf(type: string): ReturnType<typeof getWidget> {
    return getWidget(type);
  }
}
