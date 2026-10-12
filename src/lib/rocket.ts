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
 */

interface RocketState {
  /** Smoothed position in CSS pixels. */
  x: number;
  y: number;
  /** Where the pointer actually is, for a direction of travel. */
  tx: number;
  ty: number;
  /** False once the pointer has left the document. */
  visible: boolean;
}

export const rocket: RocketState = {
  x: -9999,
  y: -9999,
  tx: -9999,
  ty: -9999,
  visible: false,
};

export function setRocket(x: number, y: number, tx: number, ty: number, visible: boolean) {
  rocket.x = x;
  rocket.y = y;
  rocket.tx = tx;
  rocket.ty = ty;
  rocket.visible = visible;
}