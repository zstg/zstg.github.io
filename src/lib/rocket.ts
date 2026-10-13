/*
 * Where the rocket is right now.
 *
 * The page hides the system cursor (`cursor: none` globally), so the rocket IS
 * the pointer. Background effects that respond to the pointer should therefore
 * follow the rocket rather than the raw cursor: the rocket eases toward the
 * real pointer, so it lags slightly, and a glow locked to the raw event looks
 * detached from the thing the user is actually looking at.
 *
 * RocketCursor publishes here each frame; effects read it.
 *
 * The position is exactly where the sprite was drawn. Nothing extrapolates it.
 * An effect that sampled it a few milliseconds late and then guessed forward
 * produced a halo that jumped tens of pixels ahead of the rocket during fast
 * motion - worse than the few-pixel staleness it was trying to hide. If an
 * effect needs to compensate for its own redraw rate, it should do so from a
 * position it can see moving, not by prediction.
 */

interface RocketState {
  /** Smoothed position in CSS pixels - the middle of the sprite. */
  x: number;
  y: number;
  /** Where the pointer actually is, for a direction of travel. */
  tx: number;
  ty: number;
  /** False once the pointer has left the document. */
  visible: boolean;
  /**
   * Radius of the circle that circumscribes the sprite - the furthest any
   * pixel of it sits from the hotspot, at the worst rotation.
   *
   * Effects need it to size a halo that clears the body at any angle: the
   * sprite is long and thin, so that distance is set by the diagonal of its
   * bounding box, not by its width.
   */
  radius: number;
}

export const rocket: RocketState = {
  x: -9999,
  y: -9999,
  tx: -9999,
  ty: -9999,
  visible: false,
  radius: 24,
};

export function setRocket(
  x: number,
  y: number,
  tx: number,
  ty: number,
  visible: boolean,
  radius = 24
) {
  rocket.x = x;
  rocket.y = y;
  rocket.tx = tx;
  rocket.ty = ty;
  rocket.visible = visible;
  rocket.radius = radius;
}