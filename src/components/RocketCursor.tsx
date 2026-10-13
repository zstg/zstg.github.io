import { onMount, onCleanup } from 'solid-js';
import { setRocket } from '../lib/rocket';

/*
 * Rocket cursor.
 *
 * A rocket sprite that banks into the direction of travel, trailing an
 * accent-coloured flame and a fading position ribbon. Its hotspot is the
 * middle of the body, so clicks register exactly where the pointer is.
 */

interface Pt {
  x: number;
  y: number;
}

/* Sprite geometry, in drawn units. The nose is at -NOSE, the tail at +TAIL. */
const NOSE = 11;
const TAIL = 8;
/** Where the flame's plume starts, in the same units. */
const PLUME_BASE = 7;

function quadPts(p0: number[], c: number[], p1: number[], n = 24): number[][] {
  const out: number[][] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
      u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1],
    ]);
  }
  return out;
}

/** Signed-area centroid of a closed polygon: [area, centroidY]. */
function polyCentroid(poly: number[][]): [number, number] {
  let a = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    const cr = x0 * y1 - x1 * y0;
    a += cr;
    cy += (y0 + y1) * cr;
  }
  a /= 2;
  return [Math.abs(a), cy / (6 * a)];
}

/**
 * The rigid sprite's centre of mass along its own axis, in drawn sprite units.
 * Every part is left/right symmetric, so the centroid's x is always 0 and this
 * along-axis value is the whole story.
 *
 * The flame is deliberately excluded. It is exhaust, and it grows with thrust,
 * so including it makes the centre walk backwards as the rocket accelerates -
 * a glow that visibly trails the sprite during a fast move. The rigid centroid
 * is a constant, so the halo stays pinned where the rocket's mass is.
 */
function spriteCentroid(): number {
  const body: number[][] = [
    [0, -NOSE],
    ...quadPts([0, -NOSE], [5.2, -2], [4.4, 6]),
    [-4.4, 6],
    ...quadPts([-4.4, 6], [-5.2, -2], [0, -NOSE]),
  ];
  const finR: number[][] = [
    [2.6, 2],
    [6.4, 8],
    [2.6, 7],
  ];
  const finL: number[][] = [
    [-2.6, 2],
    [-6.4, 8],
    [-2.6, 7],
  ];
  let area = 0;
  let moment = 0;
  for (const poly of [body, finL, finR]) {
    const [a, cy] = polyCentroid(poly);
    area += a;
    moment += a * cy;
  }
  return moment / area;
}

export default function RocketCursor(props: { size?: number; idleFlame?: number }) {
  let canvas!: HTMLCanvasElement;
  let raf = 0;

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Overall rocket scale. Set `--rocket-size` in CSS (e.g. 2 for twice as
    // big) or pass <RocketCursor size={2} />; the prop wins.
    const cssSize = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--rocket-size')
    );
    const SIZE =
      props.size ?? (Number.isFinite(cssSize) && cssSize > 0 ? cssSize : 1);

    /*
     * Idle flame floor (0..1). The plume never fully goes out: at rest the
     * engine keeps this fraction of thrust, so the rocket always has a small
     * flame instead of a dead tail. Configure with `--rocket-idle-flame` in
     * CSS, or the `idleFlame` prop.
     */
    const cssIdle = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--rocket-idle-flame')
    );
    const IDLE =
      props.idleFlame ?? (Number.isFinite(cssIdle) ? Math.min(1, Math.max(0, cssIdle)) : 0.22);

    let W = 0;
    let H = 0;
    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // rocket state
    let tx = -100;
    let ty = -100;
    let cx = -100;
    let cy = -100;
    let angle = -Math.PI / 2; // facing up at rest
    let speed = 0;
    let visible = false;

    const trail: Pt[] = [];
    const TRAIL_MAX = 25;

    // Accent colour, so the plume re-themes with the rest of the site.
    const readAccent = (): [number, number, number] => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
      // accepts #rgb, #rgba, #rrggbb and #rrggbbaa (alpha is ignored for the flame)
      const hx = v.match(/^#([0-9a-f]{3,8})$/i);
      if (hx) {
        let s = hx[1];
        if (s.length === 3 || s.length === 4) s = s.split('').map((c) => c + c).join('');
        return [
          parseInt(s.slice(0, 2), 16),
          parseInt(s.slice(2, 4), 16),
          parseInt(s.slice(4, 6), 16),
        ];
      }
      const m = v.match(/hsla?\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i);
      if (m) {
        const h = Number(m[1]) / 360;
        const s = Number(m[2]) / 100;
        const l = Number(m[3]) / 100;
        const f = (p: number, q: number, t: number) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1 / 6) return p + (q - p) * 6 * t;
          if (t < 1 / 2) return q;
          if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        return [
          Math.round(f(p, q, h + 1 / 3) * 255),
          Math.round(f(p, q, h) * 255),
          Math.round(f(p, q, h - 1 / 3) * 255),
        ];
      }
      return [117, 235, 112];
    };
    let flame = readAccent();
    const retheme = () => {
      flame = readAccent();
    };
    const accentObs = new MutationObserver(retheme);
    accentObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style'],
    });
    // Immediate, explicit notification from the theme picker.
    window.addEventListener('wob:themechange', retheme);

    /*
     * Hotspot.
     *
     * The sprite's nose sits at local y = -NOSE and its tail at +TAIL. The
     * translate below shifts by +NOSE, which lands the NOSE TIP exactly on the
     * pointer - and since the pointer is where clicks register, that is the
     * focus point.
     *
     * This is what makes it behave as a cursor: the leading edge of the thing
     * you are aiming is the thing that clicks. The alternative, centring the
     * bounding box on the pointer, leaves the pointer ~19px behind the nose,
     * so aiming a thin target with the *tip* misses on the side the body is
     * hanging off - which is why the dock handle and small links were so hard
     * to hit.
     *
     * The consequence is that the whole sprite trails behind the pointer. That
     * is correct for a cursor, and it is what the trail, the flame and the
     * glow's anchor are all measured against.
     */
    const HOTSPOT_OFFSET = NOSE * SIZE;

    function onMove(e: PointerEvent) {
      tx = e.clientX;
      ty = e.clientY;
      visible = true;
    }
    /*
     * A focused <select> opens a native popup that renders OUTSIDE the page,
     * which fires pointerleave. We would hide the rocket - and since the page
     * sets `cursor: none` globally, the user would be left with no cursor at
     * all. So while a select is focused we keep the rocket drawn (parked at
     * the select) instead of letting it disappear.
     */
    let selectFocus = false;
    function onLeave() {
      if (selectFocus) return;
      visible = false;
    }
    function onFocusIn(e: FocusEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'SELECT' || t.closest('select'))) {
        selectFocus = true;
        // park the rocket over the control so it doesn't vanish mid-click
        const r = t.getBoundingClientRect();
        tx = r.x + r.width / 2;
        ty = r.y + r.height / 2;
        cx = tx;
        cy = ty;
        visible = true;
      }
    }
    function onFocusOut(e: FocusEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'SELECT' || t.closest('select'))) {
        selectFocus = false;
      }
    }
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('focus', () => {
      // native popup closed and focus returned to the page
      selectFocus = false;
    });
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    // The sprite is drawn in its own local space; drawRocket's transforms move
    // it so the nose tip lands on the pointer (see HOTSPOT_OFFSET).
    function drawRocket() {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.translate(0, HOTSPOT_OFFSET); // put the nose tip on the cursor
      const s = SIZE;
      const [fr, fg, fb] = flame;

      // accent-tinted flame at the tail. Never drops to zero - the idle
      // floor keeps a small plume burning while the cursor is at rest.
      const thrust = IDLE + (1 - IDLE) * Math.min(1, speed / 16);
      if (thrust > 0.02) {
        const flick = 0.72 + Math.random() * 0.4;
        const len = (7 + 10 * thrust) * flick * s;
        const g = ctx.createLinearGradient(0, PLUME_BASE * s, 0, (PLUME_BASE * s + len));
        g.addColorStop(0, `rgba(255,255,255,0.9)`);
        g.addColorStop(0.3, `rgba(${fr},${fg},${fb},0.75)`);
        g.addColorStop(0.7, `rgba(${fr},${fg},${fb},0.3)`);
        g.addColorStop(1, `rgba(${fr},${fg},${fb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-3.8 * s, PLUME_BASE * s);
        ctx.quadraticCurveTo(-2 * s, (11 + len / s / 2) * s, 0, (PLUME_BASE * s + len));
        ctx.quadraticCurveTo(2 * s, (11 + len / s / 2) * s, 3.8 * s, PLUME_BASE * s);
        ctx.closePath();
        ctx.fill();
      }

      // fins
      ctx.fillStyle = `rgba(${fr},${fg},${fb},0.95)`;
      ctx.beginPath();
      ctx.moveTo(-2.6 * s, 2 * s);
      ctx.lineTo(-6.4 * s, 8 * s);
      ctx.lineTo(-2.6 * s, 7 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2.6 * s, 2 * s);
      ctx.lineTo(6.4 * s, 8 * s);
      ctx.lineTo(2.6 * s, 7 * s);
      ctx.closePath();
      ctx.fill();

      // body
      const bg = ctx.createLinearGradient(-5 * s, 0, 5 * s, 0);
      bg.addColorStop(0, '#c9d4ee');
      bg.addColorStop(0.5, '#f2f5ff');
      bg.addColorStop(1, '#8ea2cc');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(0, -NOSE * s);
      ctx.quadraticCurveTo(5.2 * s, -2 * s, 4.4 * s, 6 * s);
      ctx.lineTo(-4.4 * s, 6 * s);
      ctx.quadraticCurveTo(-5.2 * s, -2 * s, 0, -NOSE * s);
      ctx.closePath();
      ctx.fill();

      // window
      ctx.fillStyle = '#0b1020';
      ctx.beginPath();
      ctx.arc(0, -1.2 * s, 2.3 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(180,215,255,0.8)';
      ctx.beginPath();
      ctx.arc(-0.7 * s, -2 * s, 0.9 * s, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    /*
     * Where the halo goes, and how far it has to reach.
     *
     * The halo is anchored to the sprite's centre of mass, not to the hotspot.
     * The body is a teardrop - most of its area is forward of the bounding-box
     * middle - so that point sits ~3.9px behind the hotspot at the default
     * size, and a halo centred on the hotspot rides ahead of the rocket. It
     * reads as the glow not being *on* it.
     *
     * The flame is deliberately excluded from the centroid. It is exhaust, and
     * it grows with thrust, so including it would make the centre walk
     * backwards as the rocket accelerates - a halo that visibly trails the
     * sprite during a fast move. The rigid centroid is a constant, measured
     * once at mount.
     *
     * Local +y maps to world (-sin, cos) under the rotation applied above,
     * which is what turns the along-axis offset into a screen position.
     *
     * HALO_RADIUS is measured from that glow centre out to the furthest point
     * of the sprite - the nose, since the glow centre now sits well behind it.
     * Deriving it from the geometry rather than reusing the bounding-circle
     * half-diagonal keeps it honest as the angle changes.
     */
    const CENTROID_Y = (spriteCentroid() + HOTSPOT_OFFSET / SIZE) * SIZE;
    const HALO_RADIUS =
      Math.max(Math.abs(-NOSE - spriteCentroid()), Math.hypot(6.4, TAIL - spriteCentroid())) *
      SIZE;

    let last = performance.now();
    let frames = 0;
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Backstop: re-read a couple of times a second so the plume can never
      // stay on a stale accent.
      if (++frames % 30 === 0) retheme();

      ctx.clearRect(0, 0, W, H);
      if (!visible) return;

      // smooth follow
      const lerp = 1 - Math.pow(0.0008, dt);
      const px = cx;
      const py = cy;
      cx += (tx - cx) * lerp;
      cy += (ty - cy) * lerp;

      const vx = (cx - px) / Math.max(dt, 0.001);
      const vy = (cy - py) / Math.max(dt, 0.001);
      speed = Math.hypot(vx, vy);

      // bank into the direction of travel
      if (speed > 0.6) {
        const target = Math.atan2(vy, vx) + Math.PI / 2;
        let d = target - angle;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        angle += d * Math.min(1, dt * 12);
      }

      drawRocket();

      /*
       * The halo is anchored to the sprite's centre of mass, and published
       * exactly where the sprite was drawn - no prediction, so nothing can fling
       * it ahead of the rocket during a fast move.
       */
      setRocket(
        cx - Math.sin(angle) * CENTROID_Y,
        cy + Math.cos(angle) * CENTROID_Y,
        tx,
        ty,
        visible,
        HALO_RADIUS
      );

      /*
       * Trail: a ribbon of recent positions drawn behind the rocket.
       * No sparks, no flame - just the path it flew through, fading out.
       */
      // record the TAIL position, not the pointer, so the ribbon emerges
      // from the engine rather than from under the nose. The tail sits
      // NOSE + TAIL behind the pointer, since the nose itself is the pointer.
      const backX = -Math.sin(angle);
      const backY = Math.cos(angle);
      const tailX = cx + backX * (NOSE + TAIL) * SIZE;
      const tailY = cy + backY * (NOSE + TAIL) * SIZE;
      trail.unshift({ x: tailX, y: tailY });
      if (trail.length > TRAIL_MAX) trail.length = TRAIL_MAX;

      if (trail.length > 2 && visible) {
        const [tr, tg, tb] = flame;
        // three passes: wide+dim halo, then two tighter brighter cores
        const passes = [
          { w: 6 * SIZE, a: 0.12 },
          { w: 2.6 * SIZE, a: 0.3 },
          { w: 1.1 * SIZE, a: 0.62 },
        ];
        for (const { w, a } of passes) {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          for (let i = 1; i < trail.length; i++) {
            const k = 1 - i / trail.length;
            const a2 = a * k * k;
            if (a2 <= 0.004) continue;
            ctx.strokeStyle = `rgba(${tr},${tg},${tb},${a2})`;
            ctx.lineWidth = w * (0.35 + k * 0.65);
            ctx.beginPath();
            ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
            ctx.lineTo(trail[i].x, trail[i].y);
            ctx.stroke();
          }
        }
      }
    }
    raf = requestAnimationFrame(frame);

    onCleanup(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      accentObs.disconnect();
      window.removeEventListener('wob:themechange', retheme);
    });
  });

  return (
    <canvas
      ref={canvas}
      class="fixed inset-0 pointer-events-none"
      style={{ 'z-index': '9999' }}
      aria-hidden="true"
    />
  );
}