import { createSignal, onMount, onCleanup } from 'solid-js';
import ParallaxProjects from './ParallaxProjects';

const doWhat = [
  { icon: '✌️❤️💛', title: '', desc: 'CS Grad @ USC' },
  { icon: '', title: 'Programmer at heart', desc: 'I love exploring new frameworks, languages, and paradigms' },
  { icon: '', title: 'FOSS Guy', desc: 'Avid user of, and loves contributing to, open source' },
];

export default function Homepage() {
  const [scrollProgress, setScrollProgress] = createSignal(0);
  // pixels scrolled past the point where the sticky viewport unpins
  const [unpinSlack, setUnpinSlack] = createSignal(0);

  onMount(() => {
    let ticking = false;
    // Cached: the sticky child stays pinned while scrollY < unpinAt.
    // Measured only on mount/resize — reading layout on every scroll frame
    // caused forced reflow and made this transform lag (visible jitter).
    let unpinAt = 0;
    function measure() {
      const vh = window.innerHeight;
      const wrapper = document.querySelector('main > astro-island > div') as HTMLElement | null;
      unpinAt = wrapper ? wrapper.offsetHeight - vh : 0;
      setUnpinSlack(Math.max(0, window.scrollY - unpinAt));
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrollProgress(y / window.innerHeight);
        // pure arithmetic against the cached value - no DOM read here
        setUnpinSlack(Math.max(0, y - unpinAt));
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    measure();
    onCleanup(() => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
    });
  });

  // Hero: fades out from 0 to 0.8
  const heroTransform = () => {
    const p = scrollProgress();
    if (p <= 0) return 'translateY(0%)';
    if (p >= 0.8) return 'translateY(-100%)';
    return `translateY(${-p * 125}%)`;
  };
  const heroOpacity = () => {
    const p = scrollProgress();
    if (p <= 0) return 1;
    if (p >= 0.8) return 0;
    return 1 - p / 0.8;
  };

  // Projects: fades in 0.35->0.85, then holds fully lit until 2.15,
  // then hands off to misc over 2.15->2.6
  const projectsOpacity = () => {
    const p = scrollProgress();
    if (p < 0.35) return 0;
    if (p < 0.85) return (p - 0.35) * 2;
    if (p < 2.15) return 1;
    if (p < 2.6) return 1 - (p - 2.15) * (1 / 0.45);
    return 0;
  };
  const projectsTransform = () => {
    const p = scrollProgress();
    if (p < 2.15) return 'translateY(0px)';
    if (p < 2.6) return `translateY(${-(p - 2.15) * 90}px)`;
    return 'translateY(-40px)';
  };

  // Misc: only after projects are gone (2.6), in over 2.7->3.2
  const miscOpacity = () => {
    const p = scrollProgress();
    if (p < 2.7) return 0;
    if (p < 3.2) return (p - 2.7) * 2;
    return 1;
  };
  /*
   * The sticky viewport unpins once the wrapper's bottom reaches the viewport
   * bottom, after which the whole layer drifts up by however far you scroll.
   * Nudge it back down by that same amount so the group stays optically
   * centred at rest instead of riding up under the footer.
   */
  const miscTransform = () => {
    const p = scrollProgress();
    let base: number;
    if (p < 2.7) base = 50;
    else if (p < 3.2) base = 50 - (p - 2.7) * 100;
    else base = 0;
    return `translateY(${base + unpinSlack()}px)`;
  };

  const parallaxProgress = () => {
    const p = scrollProgress();
    if (p < 0.85) return 0;
    // Walk the projects one at a time. This runs all the way to just before
    // the hand-off at 2.15, so each of the six cards gets ~0.21 of a viewport
    // of scrolling — ParallaxProjects then spends most of that holding the
    // card centred rather than gliding.
    return Math.min(1, (p - 0.85) / 1.25);
  };

  // sphere expands across the hero scroll (0 -> 0.8)
  const sphereProgress = () => {
    const p = scrollProgress();
    if (p <= 0) return 0;
    if (p >= 0.8) return 1;
    return p / 0.8;
  };
  void sphereProgress;

  return (
    <div class="relative w-full" style={{ height: '460vh' }}>
      <div
        class="sticky top-0 w-full overflow-hidden"
        style={{ height: '100vh', display: 'block' }}
      >

        {/* HERO */}
        <div
          class="absolute inset-0"
          style={{
            transform: heroTransform(),
            opacity: heroOpacity(),
            transition: 'transform 80ms linear, opacity 80ms linear',
            'pointer-events': heroOpacity() < 0.1 ? 'none' : 'auto',
          }}
        >
          <div class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <h1 class="font-display text-5xl md:text-6xl font-bold text-light text-center animate-[fade-in_1s_ease-out_0.2s_both]">
            zstg
          </h1>
          <p class="text-muted text-lg mt-3 italic text-center animate-[fade-in_1s_ease-out_0.3s_both]">
            Welcome to my little corner of the internet!
          </p>
          <div class="flex items-center gap-4 mt-8 text-base animate-[fade-in_1s_ease-out_0.6s_both] pointer-events-auto">
            <a href="/blog" class="btn">/blog</a>
            <a href="/about" class="btn-outlined">/about</a>
          </div>
          </div>
        </div>

        {/* PROJECTS — fades in, then hides (replaced by misc) */}
        <div
          class="absolute inset-0 flex flex-col items-center justify-center"
          style={{
            opacity: projectsOpacity(),
            transform: projectsTransform(),
            transition: 'opacity 300ms ease-out, transform 300ms ease-out',
            'pointer-events': projectsOpacity() < 0.1 ? 'none' : 'auto',
          }}
        >
          <div class="w-full max-w-5xl mx-auto px-6">
            <h2 class="font-display text-3xl font-semibold text-light mb-2 text-center">Projects</h2>
            <p class="text-muted text-sm mb-8 text-center">scroll to explore</p>
            <ParallaxProjects scrollProgress={parallaxProgress()} />
          </div>
        </div>

        {/* MISC — replaces projects, centered finale */}
        <div
          class="absolute inset-0 flex flex-col items-center justify-center"
          style={{
            opacity: miscOpacity(),
            transform: miscTransform(),
            // NO transform transition here: this transform is rewritten every
            // scroll frame to cancel the sticky unpin drift. Easing it makes
            // the rendered position lag the true one, which reads as jitter.
            // Opacity is still eased.
            transition: 'opacity 300ms ease-out',
            'pointer-events': miscOpacity() < 0.1 ? 'none' : 'auto',
          }}
        >
          <div class="w-full max-w-4xl mx-auto px-6">
            <h2 class="font-display text-3xl font-semibold text-light mb-8 text-center">What I Do</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              {doWhat.map((item) => (
                <div class="glass-card border border-white/10 rounded-xl p-6 text-center">
                  <div class="text-3xl mb-3">{item.icon}</div>
                  <h3 class="text-light font-semibold text-lg mb-2">{item.title}</h3>
                  <p class="text-muted text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
