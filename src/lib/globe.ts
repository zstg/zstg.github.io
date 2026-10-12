/*
 * Shared state about the particle sphere ("the globe").
 *
 * The globe expands and shrinks with scroll - a triangle wave from a compact
 * shell to a wide cloud and back. The background effects need to know how big
 * it currently is so they can keep a *constant* gap around it: a fixed
 * keep-out radius looks wildly wrong, because the globe is ~4x wider part way
 * down the page than it is at rest.
 *
 * ParticleSphere writes here each frame; the effects read it. Deliberately a
 * plain module rather than a signal - this is sampled inside a draw loop, and
 * a Solid signal would re-run reactive work at 60fps for no benefit.
 */

let expansion = 0;

/** 0 at rest, 1 at full expansion. */
export function setGlobeExpansion(p: number) {
  expansion = Math.min(1, Math.max(0, p));
}

export function getGlobeExpansion(): number {
  return expansion;
}

/*
 * Manual controls for the keep-out the background effects leave around the
 * sphere. All four are plain CSS custom properties on :root in global.css, so
 * you can nudge the mask by hand without touching this file:
 *
 *   --globe-clear-base    radius when the sphere is compact  (x short edge)
 *   --globe-clear-growth  extra radius once fully expanded
 *   --globe-feather       width of the soft edge outside the hard radius
 *   --globe-offset-x/-y   shift the mask, in px, if it looks off-centre
 *
 * The values are re-read at most a few times a second: the effects ask for
 * them inside a draw loop, once per cell, and getComputedStyle in there is
 * ruinous.
 */
interface Settings {
  at: number;
  base: number;
  growth: number;
  feather: number;
  ox: number;
  oy: number;
}

let cache: Settings = { at: -1e9, base: 0.3, growth: 0.5, feather: 0.12, ox: 0, oy: 0 };

function settings(): Settings {
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  if (now - cache.at < 150) return cache;
  const defaults = { base: 0.3, growth: 0.5, feather: 0.12, ox: 0, oy: 0 };
  let next = defaults;
  if (typeof getComputedStyle !== 'undefined') {
    const cs = getComputedStyle(document.documentElement);
    const num = (name: string, d: number) => {
      const v = parseFloat(cs.getPropertyValue(name));
      return Number.isFinite(v) ? v : d;
    };
    next = {
      base: num('--globe-clear-base', defaults.base),
      growth: num('--globe-clear-growth', defaults.growth),
      feather: num('--globe-feather', defaults.feather),
      ox: num('--globe-offset-x', defaults.ox),
      oy: num('--globe-offset-y', defaults.oy),
    };
  }
  cache = { ...next, at: now };
  return cache;
}

export function globeFeather(): number {
  return settings().feather;
}

export function globeOffset(): { x: number; y: number } {
  const s = settings();
  return { x: s.ox, y: s.oy };
}

/**
 * Keep-out radius as a fraction of the viewport's short edge, tracking the
 * globe: ~0.30 when it is compact, ~0.80 when fully spread.
 *
 * Always concentric with the sphere, so the gap around it is uniform on every
 * side at every scroll position.
 */
export function globeClearFraction(): number {
  const s = settings();
  return s.base + s.growth * expansion;
}