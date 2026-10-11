export interface HSL {
  h: number;
  s: number;
  l: number;
  a: number;
}

export interface ThemeVars {
  dark: string;
  darkLight: string;
  accent: string;
  accentDim: string;
  muted: string;
  light: string;
  onAccent: string;
}

export interface Theme {
  id: string;
  name: string;
  kind: 'dark' | 'light';
  vars: ThemeVars;
}

export const THEMES: Theme[] = [
  {
    id: 'matrix',
    name: 'Matrix',
    kind: 'dark',
    vars: {
      dark: '#050805',
      darkLight: '#0d150d',
      accent: '#75eb70',
      accentDim: '#57b554',
      muted: '#6f9b6f',
      light: '#c8ffc8',
      onAccent: '#061206',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    kind: 'dark',
    vars: {
      dark: '#050508',
      darkLight: '#0e0e14',
      accent: '#769ff0',
      accentDim: '#5a7cc4',
      muted: '#8892b0',
      light: '#ccd6f6',
      onAccent: '#0a0a12',
    },
  },
  {
    id: 'mocha',
    name: 'Catppuccin Mocha',
    kind: 'dark',
    vars: {
      dark: '#1e1e2e',
      darkLight: '#313244',
      accent: '#89b4fa',
      accentDim: '#6483c4',
      muted: '#9399b2',
      light: '#cdd6f4',
      onAccent: '#11111b',
    },
  },
  {
    id: 'macchiato',
    name: 'Catppuccin Macchiato',
    kind: 'dark',
    vars: {
      dark: '#24273a',
      darkLight: '#363a4f',
      accent: '#8aadf4',
      accentDim: '#6c8cc6',
      muted: '#a5adcb',
      light: '#cad3f5',
      onAccent: '#181926',
    },
  },
  {
    id: 'frappe',
    name: 'Catppuccin Frappé',
    kind: 'dark',
    vars: {
      dark: '#303446',
      darkLight: '#414559',
      accent: '#8caaee',
      accentDim: '#6d87bd',
      muted: '#a5adce',
      light: '#c6d0f5',
      onAccent: '#232634',
    },
  },
  {
    id: 'latte',
    name: 'Catppuccin Latte',
    kind: 'light',
    vars: {
      dark: '#eff1f5',
      darkLight: '#ccd0da',
      accent: '#1e66f5',
      accentDim: '#1850c4',
      muted: '#6c6f85',
      light: '#4c4f69',
      onAccent: '#ffffff',
    },
  },
  {
    id: 'tokyo',
    name: 'Tokyo Night',
    kind: 'dark',
    vars: {
      dark: '#1a1b26',
      darkLight: '#24283b',
      accent: '#7aa2f7',
      accentDim: '#5d7fc4',
      muted: '#9aa5ce',
      light: '#c0caf5',
      onAccent: '#101218',
    },
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    kind: 'dark',
    vars: {
      dark: '#282828',
      darkLight: '#3c3836',
      accent: '#83a598',
      accentDim: '#668076',
      muted: '#a89984',
      light: '#ebdbb2',
      onAccent: '#1d2021',
    },
  },
  {
    id: 'gruvbox-light',
    name: 'Gruvbox Light',
    kind: 'light',
    vars: {
      dark: '#fbf1c7',
      darkLight: '#ebdbb2',
      accent: '#076678',
      accentDim: '#05505f',
      muted: '#7c6f64',
      light: '#3c3836',
      onAccent: '#fbf1c7',
    },
  },
  {
    id: 'onedark',
    name: 'One Dark',
    kind: 'dark',
    vars: {
      dark: '#282c34',
      darkLight: '#353b45',
      accent: '#61afef',
      accentDim: '#4a88bd',
      muted: '#5c6370',
      light: '#abb2bf',
      onAccent: '#282c34',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    kind: 'dark',
    vars: {
      dark: '#282a36',
      darkLight: '#44475a',
      accent: '#bd93f9',
      accentDim: '#9370c4',
      muted: '#6272a4',
      light: '#f8f8f2',
      onAccent: '#282a36',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    kind: 'dark',
    vars: {
      dark: '#2e3440',
      darkLight: '#3b4252',
      accent: '#88c0d0',
      accentDim: '#6894a3',
      muted: '#8e9bb5',
      light: '#eceff4',
      onAccent: '#2e3440',
    },
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    kind: 'dark',
    vars: {
      dark: '#002b36',
      darkLight: '#073642',
      accent: '#268bd2',
      accentDim: '#1e6ea8',
      muted: '#839496',
      light: '#93a1a1',
      onAccent: '#002b36',
    },
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    kind: 'light',
    vars: {
      dark: '#fdf6e3',
      darkLight: '#eee8d5',
      accent: '#268bd2',
      accentDim: '#1e6ea8',
      muted: '#657b83',
      light: '#586e75',
      onAccent: '#fdf6e3',
    },
  },
];

export const THEME_STORAGE_KEY = 'wob-theme-v1';

export interface StoredTheme {
  theme: string;
  customAccent?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

function rgbToHsl(r: number, g: number, b: number, a = 1): HSL {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100, a };
}

/** Accepts #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba(), hsl()/hsla(). */
export function parseColor(input: string): HSL | null {
  if (!input) return null;
  const s = input.trim();

  let m = s.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    const h = m[1];
    const px = (i: number) => parseInt(h.slice(i * 2, i * 2 + 2), 16);
    if (h.length === 3 || h.length === 4) {
      const ch = (i: number) => parseInt(h[i] + h[i], 16);
      return rgbToHsl(ch(0), ch(1), ch(2), h.length === 4 ? ch(3) / 255 : 1);
    }
    if (h.length === 6 || h.length === 8) {
      return rgbToHsl(px(0), px(1), px(2), h.length === 8 ? px(3) / 255 : 1);
    }
    return null;
  }

  m = s.match(/^(rgba?|hsla?)\(([^)]*)\)$/i);
  if (!m) return null;
  const isHsl = m[1].toLowerCase().startsWith('hsl');
  const parts = m[2].split(/[,/\s]+/).filter(Boolean);
  const num = (v: string | undefined): number | null => {
    if (v === undefined) return null;
    const pct = v.endsWith('%');
    const n = parseFloat(v);
    if (Number.isNaN(n)) return null;
    return pct ? n / 100 : n;
  };
  const a = num(parts[3] === undefined ? '1' : parts[3]);
  if (a === null) return null;
  if (isHsl) {
    const h = num(parts[0]);
    const sat = num(parts[1]);
    const l = num(parts[2]);
    if (h === null || sat === null || l === null) return null;
    return { h: ((h % 360) + 360) % 360, s: clamp(sat, 0, 1) * 100, l: clamp(l, 0, 1) * 100, a: clamp(a, 0, 1) };
  }
  const r = num(parts[0]);
  const g = num(parts[1]);
  const b = num(parts[2]);
  if (r === null || g === null || b === null) return null;
  const norm = (v: number) => (parts[0] && parts[0].endsWith('%') ? clamp(v, 0, 1) * 255 : v);
  return rgbToHsl(norm(r), norm(g), norm(b), clamp(a, 0, 1));
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Canonical hex serialization: #rrggbb, or #rrggbbaa when translucent. */
export function toCss(c: HSL): string {
  const h = ((c.h % 360) + 360) % 360;
  const [r, g, b] = hslToRgb(h, clamp(c.s, 0, 100), clamp(c.l, 0, 100));
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  const base = `#${hex(r)}${hex(g)}${hex(b)}`;
  const a = clamp(c.a, 0, 1);
  if (a >= 0.999) return base;
  return `${base}${hex(Math.round(a * 255))}`;
}

function luma(c: HSL): number {
  const h = (c.h / 360) * 6;
  const sat = c.s / 100;
  const l = c.l / 100;
  const c1 = (1 - Math.abs(2 * l - 1)) * sat;
  const x = c1 * (1 - Math.abs((h % 2) - 1));
  const m = l - c1 / 2;
  const [r, g, b] =
    h < 1 ? [c1, x, 0] : h < 2 ? [x, c1, 0] : h < 3 ? [0, c1, x] : h < 4 ? [0, x, c1] : h < 5 ? [x, 0, c1] : [c1, 0, x];
  return (0.2126 * (r + m) + 0.7152 * (g + m) + 0.0722 * (b + m));
}

/** Alpha channel of a colour string, or 1 if opaque/unparseable. */
export function alphaOf(css: string): number {
  const c = parseColor(css);
  return c ? c.a : 1;
}

/** Readable text colour for a filled-accent surface (over the theme bg). */
export function onAccentFor(c: HSL): string {
  // composite translucent accents over the custom base background
  const over: HSL = { ...c, l: c.l * c.a + 2 * (1 - c.a), s: c.s * c.a + 0 * (1 - c.a) };
  return luma(over) > 0.42 ? '#0a0a12' : '#f2f6ff';
}

export function loadStoredTheme(): StoredTheme {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return { theme: 'matrix' };
    const parsed = JSON.parse(raw) as StoredTheme;
    if (!parsed.theme) return { theme: 'matrix' };
    return parsed;
  } catch {
    return { theme: 'matrix' };
  }
}

export function applyTheme(id: string, customAccent?: string): boolean {
  const root = document.documentElement;
  const known = THEMES.some((t) => t.id === id);
  const effective = !known || id === 'custom' ? 'custom' : id;

  if (effective === 'custom') {
    if (!customAccent) return false;
    const parsed = parseColor(customAccent);
    if (!parsed) return false;
    const css = toCss(parsed);
    root.dataset.theme = 'custom';
    root.style.colorScheme = 'dark';
    root.style.setProperty('--color-accent', css);
    root.style.setProperty('--color-accent-dim', `color-mix(in srgb, ${css} 68%, #050508)`);
    root.style.setProperty('--color-on-accent', onAccentFor(parsed));
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ theme: 'custom', customAccent: css }));
    } catch {
      /* ignore quota / private mode */
    }
    return true;
  }

  const theme = THEMES.find((t) => t.id === effective);
  root.dataset.theme = effective;
  root.style.colorScheme = theme ? theme.kind : 'dark';
  root.style.removeProperty('--color-accent');
  root.style.removeProperty('--color-accent-dim');
  root.style.removeProperty('--color-on-accent');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ theme: effective }));
  } catch {
    /* ignore */
  }
  return true;
}
