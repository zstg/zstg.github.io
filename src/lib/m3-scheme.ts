import { schemeColors, hctFromInt } from '../../reference/m3-engine.js';

/*
 * Thin adapter over the provided Material 3 engine (reference/m3-engine.js).
 *
 * The engine does all the actual colour science: HCT seed extraction
 * (`hctFromInt`) and the full tonal-palette/role mapping (`schemeColors`).
 * None of that is reimplemented here. The only glue is what the engine
 * deliberately leaves to the caller:
 *
 *   1. pack a hex accent into the ARGB int `hctFromInt` expects,
 *   2. decide light vs dark from the theme's own background,
 *   3. publish the returned roles as `--md-sys-color-*` on :root.
 *
 * This is the same job `reference/m3-head.js` does at runtime, minus its
 * localStorage bootstrap. We don't inline that file because it is a ~130 kB
 * blocking script that would have to run on every page just to produce the
 * same values that `src/styles/m3-presets.css` already ships as plain CSS
 * (generated from this same engine by scripts/gen-m3-presets.mjs). That
 * path renders the correct palette pre-paint, with no JS and no flash.
 * This adapter only runs for custom accents, which have no CSS entry.
 */

/*
 * Variant: "vibrant".
 * TonalSpot mutes a light seed badly - M3 dark `primary` sits at tone 80, and
 * green cannot carry much chroma there, so #75eb70 came back as #afcfa6.
 * Vibrant keeps the accent's vividness and is still a real HCT scheme.
 */
const VARIANT = 'vibrant';

function hexToArgb(hex: string): number | null {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  return (
    (((1 << 24) | 0) +
      (parseInt(h.slice(0, 2), 16) << 16) +
      (parseInt(h.slice(2, 4), 16) << 8) +
      parseInt(h.slice(4, 6), 16)) >>>
    0
  );
}

/** Same kebab mapping the engine's own head bootstrap uses. */
const kebab = (s: string) => s.replace(/([A-Z])/g, (m) => '-' + m.toLowerCase());

/** Dark when the theme's background is dark, so we build a dark scheme. */
function rootIsDark(el: HTMLElement): boolean {
  const argb = hexToArgb(getComputedStyle(el).getPropertyValue('--color-dark').trim());
  if (argb == null) return true;
  const lin = (u: number) => {
    const c = u / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin((argb >> 16) & 255) + 0.7152 * lin((argb >> 8) & 255) + 0.0722 * lin(argb & 255) < 0.4;
}

let last = '';
let applied: string[] = [];

/**
 * Regenerate `--md-sys-color-*` from whatever accent is currently on :root.
 *
 * Preset themes get their palette from src/styles/m3-presets.css, so there is
 * nothing to do for them — and in fact we must NOT leave inline values behind:
 * an inline custom property outranks the `html[data-theme="..."]` stylesheet
 * block, so once a custom accent had written them inline, switching back to a
 * preset would leave the buttons wearing the old custom palette.
 */
export function syncM3Scheme(el: HTMLElement = document.documentElement): void {
  const isPreset = !!el.dataset.theme && el.dataset.theme !== 'custom';

  if (isPreset) {
    if (applied.length) {
      for (const prop of applied) el.style.removeProperty(prop);
      applied = [];
    }
    last = '';
    return;
  }

  const accent = getComputedStyle(el).getPropertyValue('--color-accent').trim();
  if (!accent) return;
  const argb = hexToArgb(accent);
  if (argb == null) return;

  const isDark = rootIsDark(el);
  const signature = `${accent}|${isDark}`;
  if (signature === last) return;
  last = signature;

  const { hue, chroma, tone } = hctFromInt(argb);
  const scheme = schemeColors({
    hue,
    chroma,
    tone,
    variant: VARIANT as never,
    isDark,
    specVersion: '2025',
  });

  for (const key in scheme) {
    const value = scheme[key];
    if (typeof value === 'string' && value.startsWith('#')) {
      const prop = '--md-sys-color-' + kebab(key);
      el.style.setProperty(prop, value);
      applied.push(prop);
    }
  }
  el.style.colorScheme = isDark ? 'dark' : 'light';
}