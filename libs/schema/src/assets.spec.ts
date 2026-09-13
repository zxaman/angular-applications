import { describe, expect, it } from 'vitest';
import { addAsset, createAsset, createDocument, findAssetByName, removeAsset, sanitiseFileName } from './index';

describe('image assets', () => {
  it('parses a data URL into a stored payload', () => {
    const asset = createAsset({ name: 'Hero Image.PNG', dataUrl: 'data:image/png;base64, iVBORw0K Ggo= ' });

    expect(asset.name).toBe('hero-image.png');
    expect(asset.mimeType).toBe('image/png');
    expect(asset.base64).toBe('iVBORw0KGgo=');
  });

  it('falls back to a png name and mime type', () => {
    expect(createAsset({ name: '', base64: 'AAA' }).name).toBe('image.png');
    expect(createAsset({ name: 'logo.svg', base64: 'AAA' }).name).toBe('logo.svg');
    expect(createAsset({ name: 'notes.txt', base64: 'AAA' }).name).toBe('notes.png');
  });

  it('sanitises file names', () => {
    expect(sanitiseFileName('../etc/passwd')).toBe('etc-passwd.png');
    expect(sanitiseFileName('My Photo (2).JPG')).toBe('my-photo-2.jpg');
  });

  it('adds, replaces by name and removes assets', () => {
    let doc = addAsset(createDocument('Assets'), createAsset({ name: 'a.png', base64: 'AAA' }));
    expect(doc.assets).toHaveLength(1);

    doc = addAsset(doc, createAsset({ name: 'a.png', base64: 'BBB' }));
    expect(doc.assets).toHaveLength(1);
    expect(findAssetByName(doc, 'a.png')?.base64).toBe('BBB');

    const id = doc.assets[0]!.id;
    doc = removeAsset(doc, id);
    expect(doc.assets).toHaveLength(0);
  });
});
