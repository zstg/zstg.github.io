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
  /**
   * Where the sphere is at its biggest, as a fraction (0..1) of the page's
   * total scroll range. 0 = never expands, 1 = never shrinks back.
   * Default 0.25 -> fully expanded about a quarter of the way down.
   */
  peak?: number;
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
const DEFAULT_PEAK = 0.25;
/*
 * Extra brightness applied at the very top of the page, faded out as the
 * page is scrolled. The sphere reads a little brighter on first paint and
 * settles back to its normal level once content starts sharing the screen.
 * Configure with `--sphere-bright-boost` (0 = no boost, current behaviour).
 */
const BRIGHT_PROP = '--sphere-bright-boost';
const DEFAULT_BOOST = 0.5;

function resolveSize(p: Props): number {
  const css = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(SIZE_PROP));
  const v = p.size ?? (Number.isFinite(css) && css > 0 ? css : DEFAULT_SIZE);
  return v > 0 ? v : DEFAULT_SIZE;
}

function resolveBoost(): number {
  const css = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(BRIGHT_PROP));
  return Number.isFinite(css) ? Math.max(0, css) : DEFAULT_BOOST;
}

function resolvePeak(p: Props): number {
  const v = p.peak ?? DEFAULT_PEAK;
  return Math.min(1, Math.max(0.001, v));
}

export default function ParticleSphere(props: Props) {
  let host!: HTMLDivElement;

  onMount(() => {
    const COUNT = 1800;
    const R0 = 1.2; // compact radius
    const R1 = 4.5; // expanded radius
    const baseSize = resolveSize(props);
    const peak = resolvePeak(props);
    const boost = resolveBoost();

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
      let c = new THREE.Color(0x75eb70);
      const hex = v.match(/^#([0-9a-f]{3,8})$/i);
      // must match BOTH hsl( and hsla( - custom accents may be either
      const hsl = v.match(/hsla?\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i);
      if (hex) {
        // accepts #rgb, #rgba, #rrggbb and #rrggbbaa.
        // Use setStyle/setHex so three does the sRGB->linear conversion;
        // the 3-arg Color(r,g,b) constructor expects 0..1 working-space
        // floats and blows out 0..255 inputs.
        let hx = hex[1];
        if (hx.length === 3 || hx.length === 4) hx = hx.split('').map((ch) => ch + ch).join('');
        c = new THREE.Color().setStyle('#' + hx.slice(0, 6));
      } else if (hsl) {
        c = new THREE.Color();
        c.setHSL(Number(hsl[1]) / 360, Number(hsl[2]) / 100, Number(hsl[3]) / 100, THREE.SRGBColorSpace);
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

    const retheme = () => {
      accent = readAccent();
      mat.color.copy(accent);
    };
    const obs = new MutationObserver(retheme);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
    // Immediate notification from the theme picker (polling remains a backstop).
    window.addEventListener('wob:themechange', retheme);

    // ---- scroll drives expansion ----
    // Triangle wave over the page's full scroll range:
    //   0 at the top  ->  1 at the peak  ->  0 at the bottom.
    // So the sphere swells while you scroll down, then sinks back to its
    // resting size once you keep going (and again if you scroll back up).
    let scrolled = 0;
    // Monotonic 0..1 brightness decay: 1 at the very top, 0 by the expansion
    // peak. Unlike `scrolled` it never climbs back, so the sphere does not
    // re-brighten at the bottom of the page.
    let brightTarget = 1 + boost;
    let ticking = false;
    function readScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = Math.max(0, window.scrollY);
        const doc = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        // total scrollable distance
        const total = doc;
        const frac = y / total;
        const climb = Math.min(1, frac / peak);
        // once past the peak point, run back down to 0
        const down = Math.max(0, 1 - (frac - peak) / (1 - peak || 1));
        scrolled = Math.min(1, Math.max(0, Math.min(climb, down)));
        brightTarget = 1 + boost * (1 - climb);
        ticking = false;
      });
    }
    readScroll();
    window.addEventListener('scroll', readScroll, { passive: true });
    window.addEventListener('resize', readScroll);

    // ---- loop ----
    const target = () => scrolled;
    let p = scrolled;
    let bright = brightTarget; // start at the boosted level (first paint)
    let raf = 0;
    let frames = 0;
    const clock = new THREE.Clock();

    function frame() {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      // ease scroll progress
      p += (target() - p) * Math.min(1, dt * 4.5);

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
      bright += (brightTarget - bright) * Math.min(1, dt * 3);
      mat.size = baseSize * (0.9 + 0.5 * p);
      // `bright` is >1 only near the top of the page, so the sphere opens a
      // little brighter and settles back to its normal level as you scroll.
      mat.opacity = Math.min(1, (0.5 + 0.28 * p) * bright);

      // smooth pointer tilt
      px += (tx - px) * Math.min(1, dt * 3);
      py += (ty - py) * Math.min(1, dt * 3);
      points.rotation.y = t * 0.06 + px * 0.45;
      points.rotation.x = -py * 0.35;

      // Belt-and-braces accent sync: the MutationObserver can miss updates
      // (e.g. when the inline custom property is rewritten to the same
      // string), so re-read a couple of times a second as well.
      if (++frames % 30 === 0) {
        const c = readAccent();
        if (!c.equals(accent)) {
          accent = c;
          mat.color.copy(c);
        }
      }

      renderer.render(scene, camera);
    }
    frame();

    onCleanup(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', readScroll);
      window.removeEventListener('pointermove', onMove);
      obs.disconnect();
      window.removeEventListener('wob:themechange', retheme);
      geom.dispose();
      mat.dispose();
      spriteTex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    });
  });

  return <div ref={host} class="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />;
}