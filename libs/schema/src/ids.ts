const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

let counter = 0;

/**
 * Short, collision resistant id. Not a cryptographic uuid — it only has to be
 * unique inside one document and stable across reloads.
 */
export function createId(prefix = 'n'): string {
  counter += 1;
  const time = Date.now().toString(36);
  let random = '';
  for (let i = 0; i < 5; i += 1) {
    random += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}_${time}${counter.toString(36)}${random}`;
}

/** Deterministic id, used by tests and fixtures. */
export function createSeededId(seed: number, prefix = 'n'): string {
  return `${prefix}_${seed.toString(36).padStart(4, '0')}`;
}
