import { createSignal, createEffect } from 'solid-js';

interface Project {
  title: string;
  description: string;
  tags: string[];
  link: string;
}

const projects: Project[] = [
  { title: 'Project Alpha', description: 'A placeholder project exploring modern web technologies.', tags: ['solidjs', 'web'], link: '#' },
  { title: 'Project Beta', description: 'An experimental design system built with utility-first CSS.', tags: ['astro', 'css'], link: '#' },
  { title: 'Project Gamma', description: 'A high-performance tool compiled to WebAssembly.', tags: ['rust', 'wasm'], link: '#' },
  { title: 'Project Delta', description: 'A real-time collaboration platform with offline support.', tags: ['typescript', 'pwa'], link: '#' },
  { title: 'Project Epsilon', description: 'An open-source CLI tool for developer productivity.', tags: ['go', 'cli'], link: '#' },
  { title: 'Project Zeta', description: 'A distributed systems experiment with CRDTs.', tags: ['elixir', 'dist'], link: '#' },
];

interface Props {
  scrollProgress: number;
}

export default function ParallaxProjects(props: Props) {
  let strip!: HTMLDivElement;
  const [offset, setOffset] = createSignal(0);

  createEffect(() => {
    // Use the scroll progress from parent (0 to 1 within projects section)
    const progress = props.scrollProgress;
    if (!strip) return;
    const maxScroll = strip.scrollWidth - strip.parentElement!.clientWidth;
    setOffset(progress * maxScroll * -1);
  });

  return (
    <div class="overflow-hidden w-full">
      <div
        ref={strip}
        class="flex gap-6 py-4 will-change-transform"
        style={{
          transform: `translateX(${offset()}px)`,
          transition: 'transform 60ms linear',
        }}
      >
        {projects.map((project) => (
          <a
            href={project.link}
            class="flex-shrink-0 w-72 block bg-dark-light border border-white/10 rounded-xl p-5 h-full hover:border-accent/40 transition-all duration-300 group no-underline"
          >
            <h3 class="text-light font-semibold text-lg group-hover:text-accent transition-colors">
              {project.title}
            </h3>
            <p class="text-muted text-sm mt-2 leading-relaxed">
              {project.description}
            </p>
            <div class="flex flex-wrap gap-2 mt-3">
              {project.tags.map((tag) => (
                <span class="text-xs px-20 py-0.5 rounded-full bg-accent/10 text-accent">
                  {tag}
                </span>
              ))}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
