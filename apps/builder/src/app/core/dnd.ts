export const DND_MIME = 'application/x-appstudio-node';

export type DragPayload =
  | { kind: 'new'; type: string }
  | { kind: 'move'; id: string };

export function encodePayload(payload: DragPayload): string {
  return JSON.stringify(payload);
}

export function decodePayload(raw: string | null): DragPayload | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as DragPayload;
    if (parsed.kind === 'new' && typeof parsed.type === 'string') {
      return parsed;
    }
    if (parsed.kind === 'move' && typeof parsed.id === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** Reads a dropped payload from either our MIME type or the text fallback. */
export function payloadFromEvent(event: DragEvent): DragPayload | null {
  const data = event.dataTransfer;
  if (!data) {
    return null;
  }
  return decodePayload(data.getData(DND_MIME)) ?? decodePayload(data.getData('text/plain'));
}

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsText(file);
  });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
