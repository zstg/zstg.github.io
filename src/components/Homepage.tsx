import { createSignal, onMount, onCleanup } from 'solid-js';
import ParallaxProjects from './ParallaxProjects';

const doWhat = [
  { icon: '⚡', title: 'Build', desc: 'Creating web applications and tools with modern technologies' },
  { icon: '🔍', title: 'Learn', desc: 'Exploring new frameworks, languages, and paradigms' },
  { icon: '💬', title: 'Share', desc: 'Writing about experiences and contributing to open source' },
];

export default function Homepage() {
  const [scrollProgress, setScrollProgress] = createSignal(0);

  onMount(() => {
    let ticking = false;
    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrollProgress(window.scrollY / window.innerHeight);
          ticking = false;
        });
        ticking = true;
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onCleanup(() => window.removeEventListener('scroll', onScroll));
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

  // Projects: fades in 0.5->1, holds, then hides 1.2->1.7 (replaced by misc)
  const projectsOpacity = () => {
    const p = scrollProgress();
    if (p < 0.5) return 0;
    if (p < 1) return (p - 0.5) * 2;
    if (p < 1.2) return 1;
    if (p < 1.7) return 1 - (p - 1.2) * 2;
    return 0;
  };
  const projectsTransform = () => {
    const p = scrollProgress();
    if (p < 1.2) return 'translateY(0px)';
    if (p < 1.7) return `translateY(${-(p - 1.2) * 120}px)`;
    return 'translateY(-60px)';
  };

  // Misc: starts ONLY after projects fully gone (1.7), in 1.8->2.3, centered
  const miscOpacity = () => {
    const p = scrollProgress();
    if (p < 1.8) return 0;
    if (p < 2.3) return (p - 1.8) * 2;
    return 1;
  };
  const miscTransform = () => {
    const p = scrollProgress();
    if (p < 1.8) return 'translateY(60px)';
    if (p < 2.3) return `translateY(${60 - (p - 1.8) * 120}px)`;
    return 'translateY(0px)';
  };

  const parallaxProgress = () => {
    const p = scrollProgress();
    if (p < 1) return 0;
    return Math.min(1, (p - 1) / 0.7);
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
    <div class="relative w-full" style={{ height: '350vh' }}>
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
            developer, builder, curious
          </p>
          <div class="flex gap-4 mt-8 text-base animate-[fade-in_1s_ease-out_0.6s_both] pointer-events-auto">
            <a href="/blog" class="btn">/blog</a>
            <a href="/about" class="btn-ghost">/about</a>
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
            transition: 'opacity 300ms ease-out, transform 300ms ease-out',
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
