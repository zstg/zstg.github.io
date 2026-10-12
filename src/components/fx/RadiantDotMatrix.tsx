import { onMount, onCleanup } from 'solid-js';
import { subscribeFx, sizeCanvas } from '../../lib/fx-ticker';
import { readAccent, onThemeChange } from '../../lib/theme-colors';
import { GLOBE_FEATHER } from '../../lib/fx-globe';
import { globeClearFraction } from '../../lib/globe';
import { rocket } from '../../lib/rocket';

/*
 * Radiant pixel field.
 *
 * Modelled on omarchy-site's HeroPixelField (src/components/HeroPixelField.tsx):
 * a grid of square cells whose brightness comes from a drifting noise field,
 * and which IGNITE as luminance crosses an ordered-dither threshold. That
 * threshold is what makes it read as fire rather than a soft blob - cells
 * pop on in a Bayer order as the cursor's glow reaches them, and drop back out
 * as the glow decays, so moving the cursor drags a field of embers with it.
 *
 * The pointer is never smoothed (the cells under the cursor are the cells that
 * light); only its overall strength eases, which is what makes the trail feel
 * like it trails.
 */

/** Classic 8x8 ordered dither, 0..63. */
const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6,
  38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17,
  57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
];

const NOISE_SIZE = 128;
const CELLS_PER_NOISE = 9;
/** Cursor reach, in cells. Deliberately tight: the highlight should hug the
 *  rocket rather than flood a third of the screen. */
const CURSOR_CELLS = 7;
const BLOOM_LIFE = 0.9;
/** How far ahead of the rocket the glow leads, in px. */
const LEAD_PX = 26;


function buildNoise(seed: number) {
  const size = NOISE_SIZE;
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  let field = new Float32Array(size * size);
  for (let i = 0; i < field.length; i++) field[i] = random();

  // a couple of box passes turn white noise into soft blobs
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            sum += field[(((y + dy + size) % size) * size) + ((x + dx + size) % size)];
        next[y * size + x] = sum / 9;
      }
    }
    field = next;
  }

  // blurring collapses the range, so stretch it back out
  let min = Infinity,
    max = -Infinity;
  for (const v of field) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min || 1;
  for (let i = 0; i < field.length; i++) field[i] = (field[i] - min) / span;
  return field;
}

/** A fixed 64x64 tile of per-cell threshold offsets, tiled over the grid. */
function buildJitter(seed: number) {
  let state = seed >>> 0;
  const tile = new Float32Array(64 * 64);
  for (let i = 0; i < tile.length; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    tile[i] = state / 4294967296;
  }
  return tile;
}

function sample(field: Float32Array, x: number, y: number) {
  const size = NOISE_SIZE;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const x0 = ((xi % size) + size) % size;
  const y0 = ((yi % size) + size) % size;
  const x1 = (x0 + 1) % size;
  const y1 = (y0 + 1) % size;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = field[y0 * size + x0];
  const b = field[y0 * size + x1];
  const c = field[y1 * size + x0];
  const d = field[y1 * size + x1];
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

type Bloom = { x: number; y: number; born: number };

export default function RadiantDotMatrix(props: { cell?: number; offsetX?: number }) {
  let canvas!: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    // Smaller cells, so many more of them fill the same area.
    const CELL = props.cell ?? 7;
    /*
     * Nudge the whole field to the right, as a fraction of the viewport
     * width. Optical balance only - the globe keep-out stays centred on the
     * sphere, so the circular gap around it is unaffected. Set to 0 to undo.
     */
    const OFFSET_X = props.offsetX ?? 0.03;

    let W = 0,
      H = 0;
    let dpr = 1;
    let accent = readAccent();
    const offTheme = onThemeChange(() => {
      accent = readAccent();
    });

    const noise = buildNoise(0x75eb70);
    const jitter = buildJitter(0x0a1f14);

    let cols = 0;
    let rows = 0;
    let shift = 0;
    let ramp = new Float32Array(0);

    function resize() {
      const s = sizeCanvas(canvas, 2);
      W = s.W;
      H = s.H;
      dpr = s.dpr;
      cols = Math.max(1, Math.ceil(W / CELL));
      rows = Math.max(1, Math.ceil(H / CELL));
      // Vertical density ramp: denser near the top, thinning downward, so
      // the field has weight where the header sits without flooding the fold.
      ramp = new Float32Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        const v = Math.min(1, Math.max(0.25, 1.05 - (r / rows) * 0.8));
        for (let c = 0; c < cols; c++) ramp[r * cols + c] = v;
      }
    }
    resize();
    window.addEventListener('resize', resize);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    /*
     * The glow follows the ROCKET, not the raw pointer. The system cursor is
     * hidden site-wide, so the rocket is what the user is actually looking at;
     * it eases toward the pointer and lags slightly, and a glow locked to the
     * raw event reads as detached from the sprite.
     *
     * The glow centre also leads the rocket slightly along its direction of
     * travel, so the dots light the space it is heading into - a spotlight
     * just ahead of it rather than a halo pinned behind it.
     */
    let strength = 0;
    let targetStrength = 0;
    let blooms: Bloom[] = [];
    let prevX = -1e4;
    let prevY = -1e4;

    const locate = (e: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      const inside =
        e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
      return { inside, x: e.clientX - box.left, y: e.clientY - box.top };
    };

    const onDown = (e: PointerEvent) => {
      const { inside, x, y } = locate(e);
      if (!inside) return;
      targetStrength = 0;
      blooms = [...blooms.slice(-3), { x, y, born: performance.now(), charge: 0 }];
    };
    const onCancel = () => {
      targetStrength = 0;
    };

    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointercancel', onCancel, { passive: true });
    window.addEventListener('pointerleave', onCancel, { passive: true });

    type B = Bloom & { charge?: number };

    const stop = subscribeFx((_dt, t) => {
      const now = performance.now();
      targetStrength = rocket.visible ? 1 : 0;
      strength += (targetStrength - strength) * 0.3;

      // lead the glow slightly along the rocket's direction of travel
      const rx = rocket.x;
      const ry = rocket.y;
      let leadX = 0;
      let leadY = 0;
      const vx = rx - prevX;
      const vy = ry - prevY;
      const speed = Math.hypot(vx, vy);
      if (speed > 0.4) {
        const lead = Math.min(LEAD_PX, speed * 14);
        leadX = (vx / speed) * lead;
        leadY = (vy / speed) * lead;
      }
      prevX = rx;
      prevY = ry;
      const glowX = rx + leadX;
      const glowY = ry + leadY;

      blooms = (blooms as B[]).filter((b) => (now - b.born) / 1000 < BLOOM_LIFE) as B[];

      ctx.clearRect(0, 0, W, H);

      const reach = CURSOR_CELLS * CELL;

      // globe keep-out geometry, resolved once per frame
      const short = Math.min(W, H);
      const clearR = short * globeClearFraction();
      const feather = short * GLOBE_FEATHER;
      const clearR2 = clearR * clearR;
      const outerR2 = (clearR + feather) * (clearR + feather);
      const invFeather = 1 / (feather || 1);
      // bloom wavefronts
      const stamps = blooms.map((b) => {
        const age = (now - b.born) / 1000 / BLOOM_LIFE;
        const grow = 1 - Math.pow(1 - age, 3);
        const r = CELL * (0.6 + (2.5 + (b.charge ?? 0) * 4) * grow);
        return { x: b.x, y: b.y, r, amp: Math.pow(1 - age, 1.7) };
      });

      // Ink ramp derived from the accent: ember -> lit.
      const dim = `hsl(${accent.h}, ${Math.round(accent.s * 100)}%, 26%, 1)`;
      const mid = `hsl(${accent.h}, ${Math.round(accent.s * 100)}%, ${Math.round(
        accent.l * 100
      )}%, 1)`;
      const lit = `hsl(${accent.h}, ${Math.round(accent.s * 100)}%, ${Math.round(
        Math.min(0.88, accent.l + 0.14) * 100
      )}%, 1)`;

      // Keep clear of the sphere (and the hero copy) in the middle.
      for (let r = 0; r < rows; r++) {
        const y = r * CELL;
        const cy = y + CELL / 2;
        for (let c = 0; c < cols; c++) {
          const x = c * CELL + shift;
          const cx = x + CELL / 2;

          // 0 inside the sphere, feathering to 1 as it clears the centre.
          // The radii are hoisted out of the loop; see clearR/invFeather.
          const gdx = cx - W / 2;
          const gdy = cy - H / 2;
          const gd2 = gdx * gdx + gdy * gdy;
          if (gd2 <= clearR2) continue;
          const open = gd2 >= outerR2 ? 1 : (Math.sqrt(gd2) - clearR) * invFeather;
          if (open <= 0) continue;

          // resting field: drifting noise + a slow twinkle
          const u = c / CELLS_PER_NOISE;
          const v = r / CELLS_PER_NOISE;
          const base =
            0.6 * sample(noise, u + t * 0.14, v - t * 0.055) +
            0.4 * sample(noise, u * 0.55 - t * 0.08, v * 0.55 + t * 0.06);
          const twinkle =
            0.5 +
            0.5 * Math.sin(t * 1.1 + jitter[(r * 37 + c * 11) & 4095] * 6.283);

          let lum = ramp[r * cols + c] * (0.3 + 0.52 * base * base + 0.18 * twinkle) * 0.62;

          // cursor glow: quadratic falloff, like the original
          let glow = 0;
          if (strength > 0.01) {
            const dx = cx - glowX;
            const dy = cy - glowY;
            // sqrt rather than hypot: this runs for every cell, every frame.
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < reach) {
              const falloff = 1 - dist / reach;
              glow = falloff * falloff * strength;
              lum += glow * 0.6;
            }
          }

          // click blooms
          let wave = 0;
          for (const s of stamps) {
            const dx = cx - s.x;
            const dy = cy - s.y;
            const dist = Math.abs(Math.sqrt(dx * dx + dy * dy) - s.r);
            if (dist < CELL * 2.2) {
              const f = 1 - dist / (CELL * 2.2);
              const a = f * f * s.amp;
              if (a > wave) wave = a;
            }
          }
          lum += wave * 1.15;

          /*
           * Ordered dither. Pure Bayer would light the same low-index cells
           * everywhere and read as a static lattice, so most of the weight is
           * Bayer (so the ordered structure still shows where the cursor
           * pushes luminance high) and a little per-cell jitter.
           */
          const threshold =
            0.78 * ((BAYER[(r & 7) * 8 + (c & 7)] + 0.5) / 64) +
            0.22 * jitter[(r & 63) * 64 + (c & 63)];
          if (lum <= threshold) continue;

          const heat = Math.max(glow, wave);
          const px = Math.round(x * dpr);
          const py = Math.round(y * dpr);
          const pw = Math.round((x + CELL) * dpr) - px;
          const ph = Math.round((y + CELL) * dpr) - py;
          ctx.fillStyle = heat > 0.34 ? lit : heat > 0.1 ? mid : dim;
          // Resting embers are background texture, not content, and the
          // field must never compete with the copy over it.
          ctx.globalAlpha = open * (heat > 0.1 ? 0.5 + heat * 0.35 : 0.3);
          ctx.fillRect(px, py, pw, ph);
        }
      }
      ctx.globalAlpha = 1;
    }, 60);

    onCleanup(() => {
      stop();
      offTheme();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('pointerleave', onCancel);
      void reduced;
    });
  });

  return <canvas ref={canvas} class="absolute inset-0 w-full h-full" aria-hidden="true" />;
}