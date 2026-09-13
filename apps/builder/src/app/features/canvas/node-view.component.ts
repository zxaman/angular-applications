import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  ElementRef,
  OnDestroy,
  OnChanges,
  Renderer2,
  SimpleChanges,
  ViewContainerRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { AppNode, Breakpoint, CssMap } from '@appstudio/schema';
import { getWidgetOrFallback, renderPlan, type RenderPlan } from '@appstudio/widgets';
import { DND_MIME, encodePayload, payloadFromEvent, type DragPayload } from '../../core/dnd';
import { resolveStyle, styleToString } from '../../core/responsive';

export interface DropEvent {
  parentId: string;
  index: number;
  payload: DragPayload;
}

/**
 * Renders one widget (and its subtree) exactly as the generator emits it.
 *
 * The DOM is built from the shared `RenderPlan` with `Renderer2` so the preview
 * can use whatever tag the widget asks for. Child widgets become nested
 * `studio-node-view` components, which is what makes per-node selection, drag
 * and drop work.
 */
@Component({
  selector: 'studio-node-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
  host: {
    '[class.node]': 'true',
    '[class.is-selected]': 'isSelected()',
    '[class.drop-before]': 'dropHint() === "before"',
    '[class.drop-after]': 'dropHint() === "after"',
    '[class.drop-inside]': 'dropHint() === "inside"',
    '[attr.data-node-id]': 'node().id',
    '[attr.data-type]': 'node().type',
    '[draggable]': 'draggable()',
    '(click)': 'onClick($event)',
    '(dragstart)': 'onDragStart($event)',
    '(dragend)': 'onDragEnd()',
    '(dragover)': 'onDragOver($event)',
    '(dragleave)': 'onDragLeave($event)',
    '(drop)': 'onDrop($event)',
  },
})
export class NodeViewComponent implements OnChanges, AfterViewInit, OnDestroy {
  readonly node = input.required<AppNode>();
  readonly breakpoint = input<Breakpoint>('md');
  readonly selectedId = input<string | null>(null);
  readonly preview = input(false);
  readonly depth = input(0);

  readonly select = output<string>();
  readonly dropNode = output<DropEvent>();
  readonly dragStart = output<string>();
  readonly dragEnd = output<void>();

  protected readonly dropHint = signal<'before' | 'after' | 'inside' | null>(null);
  protected readonly isSelected = computed(() => !this.preview() && this.selectedId() === this.node().id);
  protected readonly draggable = computed(() => !this.preview());

  private readonly host = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly renderer = inject(Renderer2);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly viewContainer = inject(ViewContainerRef);

  private rootElement: HTMLElement | null = null;
  private childHosts: HTMLElement[] = [];
  private childRefs: ComponentRef<NodeViewComponent>[] = [];
  private pendingDropIndex = 0;
  private built = false;

  private get widget(): ReturnType<typeof getWidgetOrFallback> {
    return getWidgetOrFallback(this.node().type);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.built) {
      return;
    }
    if (changes['node'] || changes['breakpoint'] || changes['preview']) {
      this.build();
      return;
    }
    if (changes['selectedId']) {
      // Each level forwards to its own children, so no recursion is needed here.
      for (const ref of this.childRefs) {
        ref.setInput('selectedId', this.selectedId());
      }
    }
  }

  ngAfterViewInit(): void {
    this.built = true;
    this.build();
  }

  ngOnDestroy(): void {
    this.viewContainer.clear();
    this.childRefs = [];
    this.childHosts = [];
  }

  private build(): void {
    this.viewContainer.clear();
    this.childRefs = [];
    this.childHosts = [];
    this.rootElement = null;
    this.renderer.setProperty(this.host, 'innerHTML', '');

    const plan = renderPlan(this.node());
    const element = this.createElement(plan, true);
    this.rootElement = element;
    this.renderer.appendChild(this.host, element);
    this.buildChildren(plan, element);

    if (this.node().children.length === 0 && this.widget.isContainer && !this.preview()) {
      const placeholder = this.renderer.createElement('div');
      this.renderer.addClass(placeholder, 'as-empty');
      this.renderer.appendChild(placeholder, this.renderer.createText(String(this.node().props['label'] ?? this.widget.label)));
      this.renderer.appendChild(element, placeholder);
    }
  }

  private buildChildren(plan: RenderPlan, parentElement: HTMLElement): void {
    for (const child of plan.children ?? []) {
      if (child.node.id !== this.node().id) {
        const ref = this.createChild(child.node);
        this.renderer.appendChild(parentElement, ref.location.nativeElement);
        continue;
      }
      const element = this.createElement(child, false);
      this.renderer.appendChild(parentElement, element);
      this.buildChildren(child, element);
    }
  }

  private createChild(childNode: AppNode): ComponentRef<NodeViewComponent> {
    const ref = this.viewContainer.createComponent(NodeViewComponent);
    ref.setInput('node', childNode);
    ref.setInput('breakpoint', this.breakpoint());
    ref.setInput('selectedId', this.selectedId());
    ref.setInput('preview', this.preview());
    ref.setInput('depth', this.depth() + 1);
    ref.instance.select.subscribe((id) => this.select.emit(id));
    ref.instance.dropNode.subscribe((event) => this.dropNode.emit(event));
    ref.instance.dragStart.subscribe((id) => this.dragStart.emit(id));
    ref.instance.dragEnd.subscribe(() => this.dragEnd.emit());
    this.childRefs.push(ref);
    this.childHosts.push(ref.location.nativeElement);
    return ref;
  }

  private createElement(plan: RenderPlan, isRoot: boolean): HTMLElement {
    const element = this.renderer.createElement(plan.tag) as HTMLElement;
    for (const className of plan.classes) {
      this.renderer.addClass(element, className);
    }
    for (const [name, value] of Object.entries(plan.attrs)) {
      this.renderer.setAttribute(element, name, value);
    }
    if (isRoot) {
      const style: CssMap = resolveStyle(plan.node, this.breakpoint());
      const css = styleToString(style);
      if (css) {
        this.renderer.setAttribute(element, 'style', css);
      }
    }
    if (plan.html) {
      this.renderer.setProperty(element, 'innerHTML', this.sanitizer.bypassSecurityTrustHtml(plan.html));
    } else if (plan.text !== undefined) {
      this.renderer.appendChild(element, this.renderer.createText(plan.text));
    }
    return element;
  }

  // ------------------------------------------------------------------ events

  protected onClick(event: MouseEvent): void {
    if (this.preview()) {
      return;
    }
    event.stopPropagation();
    this.select.emit(this.node().id);
  }

  protected onDragStart(event: DragEvent): void {
    if (this.preview() || !event.dataTransfer) {
      return;
    }
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(DND_MIME, encodePayload({ kind: 'move', id: this.node().id }));
    event.dataTransfer.setData('text/plain', this.node().type);
    this.dragStart.emit(this.node().id);
  }

  protected onDragEnd(): void {
    this.clearHints();
    this.dragEnd.emit();
  }

  protected onDragLeave(event: DragEvent): void {
    const related = event.relatedTarget as HTMLElement | null;
    if (related && this.host.contains(related)) {
      return;
    }
    this.dropHint.set(null);
  }

  protected onDragOver(event: DragEvent): void {
    if (this.preview() || !this.widget.isContainer) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.pendingDropIndex = this.indexAt(event);
    this.applyHint();
  }

  protected onDrop(event: DragEvent): void {
    if (this.preview() || !this.widget.isContainer) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const payload = payloadFromEvent(event);
    this.clearHints();
    if (!payload) {
      return;
    }
    if (payload.kind === 'move' && payload.id === this.node().id) {
      return;
    }
    this.dropNode.emit({ parentId: this.node().id, index: this.pendingDropIndex, payload });
  }

  private indexAt(event: DragEvent): number {
    const hosts = this.childHosts;
    if (hosts.length === 0) {
      return 0;
    }
    const horizontal = this.isHorizontal();
    const point = horizontal ? event.clientX : event.clientY;
    for (let i = 0; i < hosts.length; i += 1) {
      const rect = hosts[i].getBoundingClientRect();
      const middle = horizontal ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
      if (point < middle) {
        return i;
      }
    }
    return hosts.length;
  }

  private isHorizontal(): boolean {
    if (!this.rootElement) {
      return false;
    }
    const styles = getComputedStyle(this.rootElement);
    if (styles.display === 'grid') {
      return true;
    }
    return styles.display.includes('flex') && styles.flexDirection.startsWith('row');
  }

  private applyHint(): void {
    const hosts = this.childHosts;
    for (const host of hosts) {
      this.renderer.removeClass(host, 'drop-before');
      this.renderer.removeClass(host, 'drop-after');
    }
    if (hosts.length === 0) {
      this.dropHint.set('inside');
      return;
    }
    this.dropHint.set(null);
    const target = hosts[Math.min(this.pendingDropIndex, hosts.length - 1)];
    if (target) {
      this.renderer.addClass(target, this.pendingDropIndex >= hosts.length ? 'drop-after' : 'drop-before');
    }
  }

  /** Clears drop hints for this node and its whole subtree. */
  clearHints(): void {
    this.dropHint.set(null);
    for (const host of this.childHosts) {
      this.renderer.removeClass(host, 'drop-before');
      this.renderer.removeClass(host, 'drop-after');
    }
    this.childRefs.forEach((ref) => ref.instance.clearHints());
  }
}
