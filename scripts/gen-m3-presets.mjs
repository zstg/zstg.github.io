/**
 * Generates src/styles/m3-presets.css — a `--md-sys-color-*` block for every
 * preset theme, so the M3 role colours are available as plain CSS with no
 * JavaScript and therefore no flash of unstyled colours.
 *
 * Run: node scripts/gen-m3-presets.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { schemeColors, hctFromInt, stateLayer } from '../src/lib/m3-engine.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/*
 * The preset list is read textually rather than imported: themes.ts uses
 * extensionless bundler-style imports that plain node cannot resolve, and
 * running a TS/bundler transform here would defeat the point of a one-command
 * generator. THEMES is a plain literal, so parsing it is safe.
 */
function readPresets() {
  const src = readFileSync(resolve(root, 'src/data/themes.ts'), 'utf8');
  const start = src.indexOf('export const THEMES');
  if (start < 0) throw new Error('THEMES not found in src/data/themes.ts');
  const body = src.slice(start);
  const out = [];
  const re = /id:\s*'([^']+)'[\s\S]*?kind:\s*'(\w+)'[\s\S]*?vars:\s*\{([\s\S]*?)\n\s*\}/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const [, id, kind, vars] = m;
    const pick = (k) => {
      const mm = vars.match(new RegExp(k + ":\\s*'([^']+)'"));
      return mm ? mm[1] : null;
    };
    const accent = pick('accent');
    const dark = pick('dark');
    if (accent && dark) out.push({ id, kind, vars: { accent, dark } });
  }
  if (!out.length) throw new Error('no presets parsed from THEMES');
  return out;
}

const THEMES = readPresets();

/** Roles the stylesheet actually consumes. Keeps the generated CSS small. */
const ROLES = [
  'primary',
  'onPrimary',
  'primaryContainer',
  'onPrimaryContainer',
  'secondaryContainer',
  'onSecondaryContainer',
  'tertiaryContainer',
  'onTertiaryContainer',
  'surface',
  'surfaceContainerLowest',
  'surfaceContainerLow',
  'surfaceContainer',
  'surfaceContainerHigh',
  'surfaceContainerHighest',
  'onSurface',
  'onSurfaceVariant',
  'outline',
  'outlineVariant',
  'inverseSurface',
  'inversePrimary',
  'surfaceTint',
  'scrim',
  'shadow',
];

const camelToKebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/*
 * M3 state layers, pre-composited.
 *
 * `stateLayer()` is the engine's own helper for building an interaction
 * state: `onColor` at `opacity` over `containerColor`. For buttons with an
 * OPAQUE container that is exactly what M3 specifies, so we bake the real
 * hexes out rather than faking them with a translucent CSS overlay.
 *
 * (Translucent/frosted buttons keep the CSS overlay instead - pre-compositing
 * over an opaque colour would be wrong when the real backdrop is live.)
 */
const STATE_LAYERS = [
  { container: 'primary', on: 'onPrimary' },
  { container: 'secondaryContainer', on: 'onSecondaryContainer' },
];
const STATE_STEPS = [
  { suffix: 'hover', opacity: 0.08 }, // M3: hover 8%
  { suffix: 'focus', opacity: 0.1 }, // M3: focus 10%
  { suffix: 'pressed', opacity: 0.1 }, // M3: pressed 10%
];

function stateLayerDecls(scheme) {
  const lines = [];
  for (const { container, on } of STATE_LAYERS) {
    const c = scheme[container];
    const o = scheme[on];
    if (typeof c !== 'string' || typeof o !== 'string') continue;
    for (const { suffix, opacity } of STATE_STEPS) {
      // NB: stateLayer() forwards to blendArgb(fg, bg, amount), which lerps
      // fg -> bg. To express "onColor at `opacity` OVER containerColor" the
      // CONTAINER has to be the first argument, despite the helper's own
      // parameter naming. Passing them the other way round returns a colour
      // that is essentially the on-colour, not a tint of the container.
      lines.push(
        `  --md-sys-color-${camelToKebab(container)}-${suffix}: ${stateLayer(c, o, opacity)};`
      );
    }
  }
  return lines.join('\n');
}

function argbOf(hex) {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  return (((1 << 24) | 0) + (parseInt(h.slice(0, 2), 16) << 16) + (parseInt(h.slice(2, 4), 16) << 8) + parseInt(h.slice(4, 6), 16)) >>> 0;
}

function isDark(rgb) {
  const a = argbOf(rgb);
  if (a == null) return true;
  const lin = (u) => {
    const c = u / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin((a >> 16) & 255) + 0.7152 * lin((a >> 8) & 255) + 0.0722 * lin(a & 255) < 0.4;
}

const blocks = [];
for (const theme of THEMES) {
  const argb = argbOf(theme.vars.accent);
  if (argb == null) continue;
  const { hue, chroma, tone } = hctFromInt(argb);
  const dark = isDark(theme.vars.dark);
  const scheme = schemeColors({ hue, chroma, tone, variant: 'vibrant', isDark: dark, specVersion: '2025' });
  const decls = ROLES.filter((r) => typeof scheme[r] === 'string' && scheme[r].startsWith('#'))
    .map((r) => `  --md-sys-color-${camelToKebab(r)}: ${scheme[r]};`)
    .join('\n');
  blocks.push(`html[data-theme="${theme.id}"] {\n${decls}\n${stateLayerDecls(scheme)}\n}`);
}

// The default theme also needs to apply before data-theme is set.
const def = THEMES[0];
const defArgb = argbOf(def.vars.accent);
const defHct = hctFromInt(defArgb);
const defScheme = schemeColors({
  hue: defHct.hue,
  chroma: defHct.chroma,
  tone: defHct.tone,
  variant: 'vibrant',
  isDark: isDark(def.vars.dark),
  specVersion: '2025',
});
const defDecls = ROLES.filter((r) => typeof defScheme[r] === 'string' && defScheme[r].startsWith('#'))
  .map((r) => `  --md-sys-color-${camelToKebab(r)}: ${defScheme[r]};`)
  .join('\n');

const out = `/* AUTO-GENERATED by scripts/gen-m3-presets.mjs — do not edit by hand.
   Full Material 3 role palettes (HCT, "vibrant" variant) derived from each
   preset's accent, plus pre-composited M3 state layers. Regenerate after
   editing the accent of any theme. */

:root {
${defDecls}
${stateLayerDecls(defScheme)}
}

${blocks.join('\n\n')}
`;

mkdirSync(resolve(root, 'src/styles'), { recursive: true });
writeFileSync(resolve(root, 'src/styles/m3-presets.css'), out);
console.log(`wrote src/styles/m3-presets.css (${THEMES.length} themes, ${ROLES.length} roles)`);