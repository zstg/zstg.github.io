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
    id: 'midnight',
    name: 'Midnight (default)',
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

export function loadStoredTheme(): StoredTheme {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return { theme: 'midnight' };
    const parsed = JSON.parse(raw) as StoredTheme;
    if (!parsed.theme) return { theme: 'midnight' };
    return parsed;
  } catch {
    return { theme: 'midnight' };
  }
}

export function applyTheme(id: string, customAccent?: string) {
  const root = document.documentElement;
  const known = THEMES.some((t) => t.id === id);
  const effective = id === 'custom' || !known ? 'custom' : id;
  root.dataset.theme = effective;
  const theme = THEMES.find((t) => t.id === effective);
  root.style.colorScheme = theme ? theme.kind : 'dark';
  if (effective === 'custom' && customAccent) {
    root.style.setProperty('--color-accent', customAccent);
    root.style.setProperty(
      '--color-accent-dim',
      `color-mix(in srgb, ${customAccent} 68%, #050508)`
    );
  } else {
    root.style.removeProperty('--color-accent');
    root.style.removeProperty('--color-accent-dim');
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ theme: id, customAccent }));
  } catch {
    /* private mode etc. */
  }
}
