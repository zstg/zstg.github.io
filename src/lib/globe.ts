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

/**
 * Keep-out radius as a fraction of the viewport's short edge, tracking the
 * globe: ~0.30 when it is compact, ~0.80 when fully spread.
 *
 * Always concentric with the sphere, so the gap around it is uniform on every
 * side at every scroll position.
 */
export function globeClearFraction(): number {
  return 0.3 + 0.5 * expansion;
}