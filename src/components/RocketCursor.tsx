import { onMount, onCleanup } from 'solid-js';

/*
 * Rocket cursor.
 *
 * A rocket sprite that banks into the direction of travel, trailing a fire
 * plume: short-lived particles emitted from the tail, cooling from white-hot
 * through yellow/orange to a dark red smoke before dying.
 */

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

export default function RocketCursor() {
  let canvas!: HTMLCanvasElement;
  let raf = 0;

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

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
    let x = -100;
    let y = -100;
    let tx = -100;
    let ty = -100;
    let cx = -100;
    let cy = -100;
    let angle = -Math.PI / 2; // facing up at rest
    let speed = 0;
    let visible = false;
    let emit = 0;

    const sparks: Spark[] = [];
    const MAX_SPARKS = 160;

    function onMove(e: PointerEvent) {
      tx = e.clientX;
      ty = e.clientY;
      visible = true;
    }
    function onLeave() {
      visible = false;
    }
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    // Rocket geometry, drawn pointing "up" (nose at -1) in local space.
    function drawRocket() {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      const s = 1;

      // exhaust cone (behind the body)
      const thrust = Math.min(1, speed / 14);
      if (thrust > 0.02) {
        const flick = 0.75 + Math.random() * 0.5;
        const len = (10 + 16 * thrust) * flick;
        const g = ctx.createLinearGradient(0, 8 * s, 0, (8 + len) * s);
        g.addColorStop(0, 'rgba(255,255,235,0.95)');
        g.addColorStop(0.35, 'rgba(255,205,80,0.8)');
        g.addColorStop(0.7, 'rgba(255,120,30,0.45)');
        g.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-4.2 * s, 8 * s);
        ctx.quadraticCurveTo(-2.2 * s, (12 + len * 0.5) * s, 0, (8 + len) * s);
        ctx.quadraticCurveTo(2.2 * s, (12 + len * 0.5) * s, 4.2 * s, 8 * s);
        ctx.closePath();
        ctx.fill();
      }

      // fins
      ctx.fillStyle = 'rgba(118,159,240,0.95)';
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
      ctx.moveTo(0, -11 * s);
      ctx.quadraticCurveTo(5.2 * s, -2 * s, 4.4 * s, 6 * s);
      ctx.lineTo(-4.4 * s, 6 * s);
      ctx.quadraticCurveTo(-5.2 * s, -2 * s, 0, -11 * s);
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

    function drawSpark(s: Spark) {
      const k = s.life / s.maxLife; // 1 -> 0
      const r = s.size * (0.35 + k * 0.65);
      // white-hot -> yellow -> orange -> dark red
      let col: string;
      if (k > 0.7) col = `rgba(255,255,240,${k})`;
      else if (k > 0.4) col = `rgba(255,206,90,${k * 0.95})`;
      else if (k > 0.18) col = `rgba(255,132,32,${k * 0.8})`;
      else col = `rgba(190,54,16,${k * 0.5})`;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    let last = performance.now();
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

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

      // emit from the tail. The rocket is drawn nose-up in local space, and
      // local (0,+1) maps to world (-sin a, cos a) after rotate(a).
      const backX = -Math.sin(angle);
      const backY = Math.cos(angle);
      const tailX = cx + backX * 7;
      const tailY = cy + backY * 7;
      const rate = 0.02 + Math.min(speed / 18, 1) * 0.09;
      emit += dt * (1 + speed * 0.35);
      while (emit > rate && sparks.length < MAX_SPARKS) {
        emit -= rate;
        const jitter = (Math.random() - 0.5) * 3.2;
        sparks.push({
          x: tailX + (Math.random() - 0.5) * 2,
          y: tailY + (Math.random() - 0.5) * 2,
          vx: backX * (40 + Math.random() * 90) + jitter,
          vy: backY * (40 + Math.random() * 90) + 16,
          life: 1,
          maxLife: 0.35 + Math.random() * 0.5,
          size: 1.6 + Math.random() * 3.2,
        });
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life -= dt / s.maxLife;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        s.vy += 90 * dt; // buoyancy
        s.vx *= 1 - 1.6 * dt;
        s.vy *= 1 - 1.1 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        drawSpark(s);
      }
    }
    raf = requestAnimationFrame(frame);

    onCleanup(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
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