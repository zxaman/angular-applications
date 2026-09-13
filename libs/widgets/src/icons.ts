/**
 * Built in line icons. Deliberately tiny and dependency free: the same path data
 * is used by the canvas preview and written verbatim into generated templates.
 */
export const ICONS: Record<string, string> = {
  star: 'M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z',
  check: 'M4.5 12.5l5 5 10-11',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16.2 16.2L21 21',
  settings: 'M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6zM12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6',
  user: 'M12 12.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2zM4.2 20.2c0-3.4 3.5-5.2 7.8-5.2s7.8 1.8 7.8 5.2',
  mail: 'M3.5 6.5h17v11h-17zM3.8 7.2l8.2 6 8.2-6',
  phone: 'M6.5 3.5h3l1.5 4-2 1.4a11 11 0 0 0 5.1 5.1l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z',
  home: 'M4 11.2L12 4.5l8 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-3.2v-6H8.7v6H5.5A1.5 1.5 0 0 1 4 19z',
  cart: 'M3.5 4.5h2.2l2.3 10.2h9.4l2-7.4H6.6M9.5 20a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4zM17 20a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z',
  heart: 'M12 20s-7.5-4.4-7.5-9.3A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7.5 2.7C19.5 15.6 12 20 12 20z',
  'arrow-right': 'M4.5 12h15M13.5 6l6 6-6 6',
  download: 'M12 4v10.5M8 11l4 4 4-4M5 19.5h14',
  upload: 'M12 20V9.5M8 13l4-4 4 4M5 4.5h14',
  menu: 'M4 7h16M4 12h16M4 17h16',
  plus: 'M12 5v14M5 12h14',
  trash: 'M5 7h14M9.5 7V4.8h5V7M6.8 7l.9 12.2h8.6L17.2 7',
  edit: 'M4.5 19.5h3.8L20 7.8 16.2 4 4.5 15.7zM14.5 5.7l3.8 3.8',
  bell: 'M6.5 17V11a5.5 5.5 0 0 1 11 0v6M4.5 17h15M10.2 20h3.6',
  'image': 'M4 5.5h16v13H4zM4 15.5l4.5-4.5 4 4 3-3L20 16M15 9.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z',
};

export const ICON_NAMES = Object.keys(ICONS);

export function iconSvg(name: string, size = 24): string {
  const path = ICONS[name] ?? ICONS['star'];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
}
