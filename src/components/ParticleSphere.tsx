import { createSignal, onMount, onCleanup } from 'solid-js';
import * as THREE from 'three';

/*
 * Particle sphere.
 *
 * - Draws N points on a fibonacci sphere.
 * - Expands from a tight shell into a wide cloud as the page scrolls, and the
 *   expansion drives the per-particle "snow" fall: the further a particle has
 *   been pushed out, the more it drifts.
 * - Pointer parallax tilts the whole cloud so it feels interactive.
 */

interface Props {
  /** Scroll distance (in viewport heights) over which the sphere expands. */
  span?: number;
  /**
   * Point size in world units at rest (it grows a little as the sphere expands).
   * Also settable without touching code via the CSS custom property
   * `--particle-size`, e.g. in global.css:
   *     :root { --particle-size: 0.09; }
   * The `size` prop wins if you pass one.
   */
  size?: number;
}

const SIZE_PROP = '--particle-size';
const DEFAULT_SIZE = 0.052;

function resolveSize(p: Props): number {
  const css = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(SIZE_PROP));
  const v = p.size ?? (Number.isFinite(css) && css > 0 ? css : DEFAULT_SIZE);
  return v > 0 ? v : DEFAULT_SIZE;
}

export default function ParticleSphere(props: Props) {
  let host!: HTMLDivElement;

  onMount(() => {
    const COUNT = 3500;
    const R0 = 1.2; // compact radius
    const R1 = 4.5; // expanded radius
    const baseSize = resolveSize(props);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
    camera.position.z = 6.4;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    // ---- geometry: fibonacci sphere ----
    const positions = new Float32Array(COUNT * 3);
    const base = new Float32Array(COUNT * 3); // unit directions
    const sizes = new Float32Array(COUNT);
    const phases = new Float32Array(COUNT);
    const GA = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < COUNT; i++) {
      const y = 1 - (i / (COUNT - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const th = GA * i;
      const x = Math.cos(th) * r;
      const z = Math.sin(th) * r;
      base[i * 3] = x;
      base[i * 3 + 1] = y;
      base[i * 3 + 2] = z;
      sizes[i] = 0.6 + Math.random() * 2.2;
      phases[i] = Math.random() * Math.PI * 2;
    }

    // ---- material: round, accent-tinted, additive ----
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const readAccent = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
      const m = v.match(/^#([0-9a-f]{6})$/i) || v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
      let c = new THREE.Color(0x769ff0);
      if (m && m[1].length === 6) c = new THREE.Color(parseInt(m[1], 16));
      else if (m) c = new THREE.Color(parseInt(m[1] + m[1], 16), parseInt(m[2] + m[2], 16), parseInt(m[3] + m[3], 16));
      else {
        const h = v.match(/hsl\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i);
        if (h) c.setHSL(Number(h[1]) / 360, Number(h[2]) / 100, Number(h[3]) / 100);
      }
      return c;
    };
    let accent = readAccent();

    // soft round sprite so points read as snow, not squares
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    {
      const c2 = sprite.getContext('2d')!;
      const g = c2.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c2.fillStyle = g;
      c2.fillRect(0, 0, 64, 64);
    }
    const spriteTex = new THREE.CanvasTexture(sprite);

    const mat = new THREE.PointsMaterial({
      size: baseSize,
      map: spriteTex,
      color: accent,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geom, mat);
    scene.add(points);

    // ---- resize ----
    function resize() {
      const w = host.clientWidth || window.innerWidth;
      const h = host.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    // ---- pointer parallax ----
    let px = 0,
      py = 0,
      tx = 0,
      ty = 0;
    function onMove(e: PointerEvent) {
      const r = host.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    }
    window.addEventListener('pointermove', onMove, { passive: true });

    const obs = new MutationObserver(() => {
      accent = readAccent();
      mat.color.copy(accent);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });

    // ---- scroll drives expansion ----
    const span = props.span ?? 0.8; // viewport heights
    let scrolled = 0;
    let ticking = false;
    function readScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const max = Math.max(1, window.innerHeight * span);
        scrolled = Math.min(1, Math.max(0, window.scrollY / max));
        ticking = false;
      });
    }
    readScroll();
    window.addEventListener('scroll', readScroll, { passive: true });

    // ---- loop ----
    const target = () => scrolled;
    let p = scrolled;
    let raf = 0;
    const clock = new THREE.Clock();

    function frame() {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      // ease scroll progress
      p += (target() - p) * Math.min(1, dt * 6);

      const radius = R0 + (R1 - R0) * p;
      const spread = (R1 - R0) * p; // how far particles have flown out

      for (let i = 0; i < COUNT; i++) {
        const bx = base[i * 3],
          by = base[i * 3 + 1],
          bz = base[i * 3 + 2];
        // per-particle variance so the shell is soft, not a hard surface
        const n = (Math.sin(phases[i] * 12.9898 + i * 0.1) * 0.5 + 0.5) * 0.55 + 0.72;
        const r = radius * n;
        // snow drift: outward particles fall more
        const drift = spread * n * (0.35 + 0.65 * (by * 0.5 + 0.5));
        const fall = Math.sin(t * 0.5 + phases[i]) * 0.05 * (0.4 + n);
        positions[i * 3] = bx * r;
        positions[i * 3 + 1] = by * r + fall - drift * 0.22;
        positions[i * 3 + 2] = bz * r;
      }
      geom.attributes.position.needsUpdate = true;

      // size/opacity: stay subtle so text over the cloud stays readable
      mat.size = baseSize * (0.9 + 0.5 * p);
      mat.opacity = 0.5 + 0.28 * p;

      // smooth pointer tilt
      px += (tx - px) * Math.min(1, dt * 3);
      py += (ty - py) * Math.min(1, dt * 3);
      points.rotation.y = t * 0.06 + px * 0.45;
      points.rotation.x = -py * 0.35;

      renderer.render(scene, camera);
    }
    frame();

    onCleanup(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', readScroll);
      window.removeEventListener('pointermove', onMove);
      obs.disconnect();
      geom.dispose();
      mat.dispose();
      spriteTex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    });
  });

  return <div ref={host} class="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />;
}