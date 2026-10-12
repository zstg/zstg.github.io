/*
 * Shared access to the live theme colours that the background effects read.
 *
 * Effects run on a canvas, so they cannot use CSS custom properties directly —
 * they have to resolve the accent to concrete numbers. Every effect used to
 * carry its own copy of that parsing, which is why they drifted apart. This is
 * the single implementation.
 */

export interface AccentHSL {
  /** 0..360 */
  h: number;
  /** 0..1 */
  s: number;
  /** 0..1 */
  l: number;
  /** 0..1 */
  a: number;
}

function parseHexToHsl(hex: string): { r: number; g: number; b: number; a: number } | null {
  const m = hex.match(/^#([0-9a-f]{3,8})$/i);
  if (!m) return null;
  let s = m[1];
  if (s.length === 3 || s.length === 4) s = s.split('').map((c) => c + c).join('');
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
    a: s.length >= 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1,
  };
}

/** Resolve `--color-accent` to HSL + alpha, whatever format the theme uses. */
export function readAccent(): AccentHSL {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
  const fallback: AccentHSL = { h: 144.7, s: 0.78, l: 0.68, a: 1 }; // Matrix #75eb70

  const hex = parseHexToHsl(v);
  if (hex) {
    const r = hex.r / 255,
      g = hex.g / 255,
      b = hex.b / 255;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0,
      s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return { h: h * 360, s, l, a: hex.a };
  }

  const fn = v.match(/^(rgba?|hsla?)\(([^)]+)\)$/i);
  if (fn) {
    const parts = fn[2].split(/[\s,/]+/).filter(Boolean);
    if (fn[1].toLowerCase().startsWith('hsl')) {
      return {
        h: parseFloat(parts[0]),
        s: parseFloat(parts[1]) / 100,
        l: parseFloat(parts[2]) / 100,
        a: parts[3] != null ? parseFloat(parts[3]) : 1,
      };
    }
    const r = parseFloat(parts[0]) / 255,
      g = parseFloat(parts[1]) / 255,
      b = parseFloat(parts[2]) / 255;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0,
      s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return { h: h * 360, s, l, a: parts[3] != null ? parseFloat(parts[3]) : 1 };
  }
  return fallback;
}

/** Resolve `--color-dark` to a 6-digit hex (the theme's own background). */
export function readThemeBg(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--color-dark').trim();
  const hex = parseHexToV6(v);
  return hex ?? '#050508';
}

function parseHexToV6(hex: string): string | null {
  const m = hex.match(/^#([0-9a-f]{3,8})$/i);
  if (!m) return null;
  let s = m[1];
  if (s.length === 3 || s.length === 4) s = s.split('').map((c) => c + c).join('');
  return '#' + s.slice(0, 6);
}

/** `hsla(h, s%, l%, a)` string for canvas fill/stroke styles. */
export function hsl(c: AccentHSL, alpha = c.a, lOverride?: number, hueShift = 0): string {
  const l = lOverride ?? c.l;
  const h = (((c.h + hueShift) % 360) + 360) % 360;
  return `hsla(${h}, ${Math.round(c.s * 100)}%, ${Math.round(l * 100)}%, ${alpha})`;
}

/**
 * Subscribe to theme changes.
 *
 * The picker broadcasts `wob:themechange` for immediacy; the MutationObserver
 * is a backstop for changes made by the pre-paint script or devtools, which
 * do not fire that event.
 */
export function onThemeChange(cb: () => void): () => void {
  const handler = () => cb();
  const obs = new MutationObserver(handler);
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'style'],
  });
  window.addEventListener('wob:themechange', handler);
  return () => {
    obs.disconnect();
    window.removeEventListener('wob:themechange', handler);
  };
}