import { DOCUMENT_VERSION, isAppDocument } from './factory';
import type { AppDocument } from './types';

/**
 * Forward-only migrations. Every step upgrades the document by exactly one
 * version so old project files keep opening as the model evolves.
 */
type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

const migrations: Record<number, Migration> = {
  // 0 -> 1: initial release, nothing to rewrite, but documents without `kind`
  // (hand written fixtures) get normalised here.
  0: (doc) => ({ ...doc, kind: 'appstudio.document' }),
  // 1 -> 2: app state and repeaters were introduced.
  1: (doc) => ({ ...doc, state: Array.isArray(doc['state']) ? doc['state'] : [] }),
  // 2 -> 3: reusable component library.
  2: (doc) => ({ ...doc, components: Array.isArray(doc['components']) ? doc['components'] : [] }),
};

export interface MigrateResult {
  doc: AppDocument;
  migratedFrom: number;
  applied: number[];
}

export function migrateDocument(input: unknown): MigrateResult {
  const raw = (typeof input === 'string' ? JSON.parse(input) : input) as Record<string, unknown>;
  const startVersion = typeof raw['version'] === 'number' ? raw['version'] : 0;
  let current: Record<string, unknown> = { ...raw };
  const applied: number[] = [];

  for (let version = startVersion; version < DOCUMENT_VERSION; version += 1) {
    const step = migrations[version];
    if (step) {
      current = step(current);
      applied.push(version);
    }
    current['version'] = version + 1;
  }

  if (!isAppDocument(current)) {
    throw new Error('File is not an AppStudio project document.');
  }
  return { doc: current, migratedFrom: startVersion, applied };
}
