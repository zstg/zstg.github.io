import { createSignal, createEffect, For } from 'solid-js';

interface Project {
  title: string;
  description: string;
  tags: string[];
  link: string;
}

const projects: Project[] = [
  { title: 'StratOS Linux', description: 'A WIP Linux meta-distro', tags: ['linux', 'operating-systems'], link: 'https://github.com/stratos-linux' },
  { title: 'Nixpkgs maintainer', description: 'I maintain custom Nix packages and flakes', tags: ['Nix', 'nixos'], link: 'https://github.com/nixpkgs' },
];

interface Props {
  /** 0..1 across the projects scroll range. */
  scrollProgress: number;
}

const N = projects.length;

/**
 * One project at a time.
 *
 * `scrollProgress` is remapped so the full 0..1 sweep walks the list
 * card-by-card: the active index moves continuously, and each card is
 * positioned relative to that index. That keeps the horizontal parallax
 * motion of the old strip while only ever showing a single card in the
 * centre - neighbours are pushed off to the sides and faded/scaled back.
 */
export default function ParallaxProjects(props: Props) {
  // continuous position in "card" units: 0 = first card centred, N-1 = last
  const [pos, setPos] = createSignal(0);

  /*
   * Dwell easing.
   *
   * A purely linear mapping spends the entire scroll budget moving, so each
   * card is only centred for an instant and reads as a flicker. Instead each
   * card gets a HOLD slice of the scroll where it sits still and centred and
   * is fully readable, and the remainder is a smoothstep glide to the next
   * one. The result reads as "one project at a time" rather than "a strip
   * flying past".
   */
  const HOLD = 0.68; // share of each card's scroll spent parked
  const smoothstep = (t: number) => t * t * (3 - 2 * t);

  createEffect(() => {
    const p = Math.min(1, Math.max(0, props.scrollProgress));
    const raw = p * (N - 1);
    if (N <= 1) {
      setPos(0);
      return;
    }
    const seg = Math.min(N - 2, Math.floor(raw));
    const f = raw - seg;
    setPos(f < HOLD ? seg : seg + smoothstep((f - HOLD) / (1 - HOLD)));
  });

  /** Per-card transform/opacity from its distance to the current position. */
  const styleFor = (i: number) => {
    // d = 0 when centred, +/-1 when one card away
    const d = i - pos();
    const ad = Math.abs(d);

    // Beyond the immediate neighbours there is nothing to see.
    if (ad > 1.2) {
      return {
        transform: `translateX(${d * 90}%) scale(0.85)`,
        opacity: '0',
        pointerEvents: 'none',
      };
    }

    // Parallax: cards drift sideways at slightly different rates and sink
    // back in depth as they leave the centre.
    const x = d * 82; // % of the card's own width
    const y = ad * 24; // px, a slight downward drift off-centre
    const scale = 1 - Math.min(ad, 1) * 0.14;
    // Fade out over the glide only; the dwell keeps this at full opacity.
    const opacity = Math.max(0, 1 - ad * 1.9);

    return {
      transform: `translate(${x}%, ${y}px) scale(${scale})`,
      opacity: String(opacity),
      pointerEvents: ad < 0.45 ? 'auto' : 'none',
    };
  };

  return (
    <div class="relative w-full h-80 overflow-hidden">
      <For each={projects}>
        {(project, i) => (
          /* The wrapper centres the card with flex, so the parallax
             transform can own the <a> outright — no -50% centring maths
             to fight the transform over. */
          <div class="absolute inset-0 flex items-center justify-center">
            <a
              href={project.link}
              class="group glass-card border border-white/10 rounded-xl p-6
                     w-[min(20rem,80vw)] h-52 no-underline will-change-transform"
              style={styleFor(i())}
            >
            <h3 class="text-light font-semibold text-lg group-hover:text-accent transition-colors">
              {project.title}
            </h3>
            <p class="text-muted text-sm mt-2 leading-relaxed">
              {project.description}
            </p>
            <div class="flex flex-wrap gap-2 mt-3">
              <For each={project.tags}>
                {(tag) => (
                  <span class="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                    {tag}
                  </span>
                )}
              </For>
            </div>
          </a>
          </div>
        )}
      </For>

      {/* progress dots: which project is centred right now */}
      <div class="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2">
        <For each={projects}>
          {(_, i) => (
            <span
              class="h-1.5 rounded-full transition-all duration-200"
              style={{
                width: Math.abs(i() - pos()) < 0.5 ? '1.5rem' : '0.375rem',
                background:
                  Math.abs(i() - pos()) < 0.5
                    ? 'var(--color-accent)'
                    : 'color-mix(in srgb, var(--color-light) 22%, transparent)',
              }}
            />
          )}
        </For>
      </div>
    </div>
  );
}