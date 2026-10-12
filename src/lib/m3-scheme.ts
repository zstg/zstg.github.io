import { schemeColors, hctFromInt } from './m3-engine.js';

/*
 * Material 3 colour roles, generated from the active accent.
 *
 * Rather than hand-mixing accent tints (which is what makes a UI look
 * "almost Material"), this runs the real HCT solver: the accent is read as a
 * seed (hue + chroma), a full tonal palette is generated, and every M3 role
 * (primary, onPrimary, secondaryContainer, surfaceContainer…, ~53 in all) is
 * mapped onto a tone exactly as material-color-utilities does.
 *
 * The scheme is then published as `--md-sys-color-*` on :root, so the
 * stylesheet can use genuine M3 tokens.
 *
 * Variant: "vibrant". TonalSpot mutes a light seed badly (primary lands at
 * tone 80, and at that tone green can only carry ~48 chroma, so #75eb70
 * comes back as a washed #afcfa6). Vibrant keeps the accent's vividness
 * while still being a real HCT-derived scheme.
 */

const VARIANT = 'vibrant';

/** "#rgb" | "#rrggbb" -> packed ARGB int. Returns null if unparseable. */
function hexToArgb(hex: string): number | null {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  return (
    ((1 << 24) | 0) +
    (parseInt(h.slice(0, 2), 16) << 16) +
    (parseInt(h.slice(2, 4), 16) << 8) +
    parseInt(h.slice(4, 6), 16)
  ) >>> 0;
}

const camelToKebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** Read a CSS custom property, resolved through any var() indirection. */
function cssVar(name: string, el: HTMLElement): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

/**
 * True when the theme's background is dark, so the scheme is generated for
 * dark mode. Light themes (latte, solarized-light) get the light scheme.
 */
function rootIsDark(el: HTMLElement): boolean {
  const v = cssVar('--color-dark', el);
  const argb = hexToArgb(v);
  if (argb == null) return true;
  const r = (argb >> 16) & 255,
    g = (argb >> 8) & 255,
    b = argb & 255;
  // relative luminance
  const lin = (u: number) => {
    const c = u / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) < 0.4;
}

export interface M3SchemeOptions {
  /** Scheme variant; defaults to "vibrant" (see note above). */
  variant?: string;
  /** Overrides auto-detection from the theme background. */
  isDark?: boolean;
}

/**
 * Build `--md-sys-color-*` declarations for a seed colour.
 * Returns a flat object of custom property name -> hex.
 */
export function m3ColorVars(accent: string, opts: M3SchemeOptions = {}): Record<string, string> {
  const argb = hexToArgb(accent);
  if (argb == null) return {};
  const { hue, chroma, tone } = hctFromInt(argb);
  const isDark = opts.isDark ?? true;
  const scheme = schemeColors({
    hue,
    chroma,
    tone,
    variant: (opts.variant ?? VARIANT) as never,
    isDark,
    specVersion: '2025',
  });

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(scheme)) {
    if (typeof value === 'string' && value.startsWith('#')) {
      out['--md-sys-color-' + camelToKebab(key)] = value;
    }
  }
  return out;
}

let lastApplied = '';

/**
 * Regenerate the M3 roles from whatever accent is currently on :root and
 * publish them. Safe to call repeatedly; it is a no-op if nothing changed.
 */
export function syncM3Scheme(el: HTMLElement = document.documentElement): void {
  const accent = cssVar('--color-accent', el);
  if (!accent) return;
  const isDark = rootIsDark(el);
  const signature = `${accent}|${isDark}`;
  if (signature === lastApplied) return;
  lastApplied = signature;

  const vars = m3ColorVars(accent, { isDark });
  for (const [name, value] of Object.entries(vars)) {
    el.style.setProperty(name, value);
  }
  // let CSS colour-scheme / native widgets follow the generated scheme
  el.style.colorScheme = isDark ? 'dark' : 'light';
}