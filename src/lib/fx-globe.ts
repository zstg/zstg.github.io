import { globeClearFraction, globeFeather, globeOffset } from './globe';

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
 *
 * The radius and the centring are configurable from CSS - see the property
 * list in lib/globe.ts. That is the manual lever if the mask ever looks
 * off-centre: set `--globe-offset-x` / `--globe-offset-y`.
 */

export function globeOpen(x: number, y: number, W: number, H: number): number {
  const off = globeOffset();
  const dx = x - (W / 2 + off.x);
  const dy = y - (H / 2 + off.y);
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
  const clearR = short * globeClearFraction();
  const feather = short * globeFeather();
  if (d <= clearR) return 0;
  if (d >= clearR + feather) return 1;
  return (d - clearR) / feather;
}