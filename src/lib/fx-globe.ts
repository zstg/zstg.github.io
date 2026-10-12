/*
 * Keep-out zone for the background effects.
 *
 * The particle sphere owns the middle of the viewport, and so does the hero
 * copy that sits over it. Effects that fill the whole screen (honeycomb,
 * shape morph, radiant dots) draw straight through the globe and wash it out.
 *
 * Rather than each effect inventing its own mask, they all ask `globeOpen()`
 * for a 0..1 weight and scale their ink by it: 0 inside the sphere, 1 well
 * outside, with a soft feather between so the exclusion reads as deliberate
 * rather than as a hole.
 */

/** Radius of the hard exclusion, as a fraction of the short edge. */
export const GLOBE_CLEAR = 0.34;
/** Width of the feathered edge outside that, same units. */
export const GLOBE_FEATHER = 0.12;

/**
 * How much ink an effect may lay down at (x, y).
 * 0 = entirely inside the sphere, 1 = clear of it.
 */
export function globeOpen(x: number, y: number, W: number, H: number): number {
  const dx = x - W / 2;
  const dy = y - H / 2;
  return globeOpenAtDistance(Math.sqrt(dx * dx + dy * dy), W, H);
}

/**
 * The same question asked with the distance already known.
 *
 * Large objects must pass the distance to their NEAREST point rather than
 * their centre: a 300px shape whose origin sits just outside the zone still
 * reaches deep into it, and testing the centre alone lets it wash over the
 * sphere.
 */
export function globeOpenAtDistance(d: number, W: number, H: number): number {
  const short = Math.min(W, H);
  const clearR = short * GLOBE_CLEAR;
  const feather = short * GLOBE_FEATHER;
  if (d <= clearR) return 0;
  if (d >= clearR + feather) return 1;
  return (d - clearR) / feather;
}