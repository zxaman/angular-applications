import type { GeneratedFile } from './types';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: FileTreeNode[];
  contents?: string;
  kind?: GeneratedFile['kind'];
}

/** Builds a nested tree from the flat file list, for the export preview UI. */
export function buildFileTree(files: GeneratedFile[]): FileTreeNode[] {
  const root: FileTreeNode = { name: '', path: '', type: 'dir', children: [] };

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;
    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      const path = parts.slice(0, index + 1).join('/');
      const children = current.children ?? [];
      let next = children.find((child) => child.name === part && child.type === (isLast ? 'file' : 'dir'));
      if (!next) {
        next = isLast
          ? { name: part, path, type: 'file', contents: file.contents, kind: file.kind }
          : { name: part, path, type: 'dir', children: [] };
        children.push(next);
      }
      current.children = children;
      current = next;
    });
  }

  sortTree(root);
  return root.children ?? [];
}

function sortTree(node: FileTreeNode): void {
  if (!node.children) {
    return;
  }
  node.children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'dir' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  node.children.forEach(sortTree);
}

/** Flattens a tree back into paths, used by the zip exporter. */
export function flattenTree(nodes: FileTreeNode[]): string[] {
  return nodes.flatMap((node) => (node.type === 'dir' ? flattenTree(node.children ?? []) : [node.path]));
}
