/*
 * One animation loop for every background effect.
 *
 * Each effect used to run its own requestAnimationFrame, which meant N effects
 * meant N independent loops each redrawing a full-screen canvas. They all share
 * this one loop instead, and each subscriber gets its own frame-rate cap:
 * ambient effects sit at 30fps (they drift slowly, nobody can tell), while the
 * interactive ones can ask for 60.
 */

export type FxFrame = (dt: number, t: number) => void;

interface Sub {
  cb: FxFrame;
  interval: number;
  acc: number;
}

const subs = new Set<Sub>();
let raf = 0;
let last = 0;
let clock = 0;

function loop(now: number) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  clock += dt;

  for (const s of subs) {
    s.acc += dt;
    if (s.acc < s.interval) continue;
    s.acc = 0;
    s.cb(dt, clock);
  }
}

function ensureRunning() {
  if (raf || subs.size === 0) return;
  last = performance.now();
  raf = requestAnimationFrame(loop);
}

function maybeStop() {
  if (subs.size === 0 && raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
}

/** Subscribe a drawing callback. `fps` is capped at 60. Returns an unsubscribe. */
export function subscribeFx(cb: FxFrame, fps = 30): () => void {
  const sub: Sub = { cb, interval: 1 / Math.min(60, Math.max(1, fps)), acc: 0 };
  subs.add(sub);
  ensureRunning();
  return () => {
    subs.delete(sub);
    maybeStop();
  };
}

export interface SizedCanvas {
  ctx: CanvasRenderingContext2D;
  /** CSS pixels */
  W: number;
  H: number;
  dpr: number;
}

/**
 * Size a canvas to its element (or the viewport) and set up the transform.
 * `dprCap` keeps ambient effects cheap on HiDPI displays.
 */
export function sizeCanvas(canvas: HTMLCanvasElement, dprCap = 1.5): SizedCanvas {
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  const W = canvas.clientWidth || window.innerWidth;
  const H = canvas.clientHeight || window.innerHeight;
  canvas.width = Math.max(1, Math.round(W * dpr));
  canvas.height = Math.max(1, Math.round(H * dpr));
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W, H, dpr };
}