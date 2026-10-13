import { createEffect, createSignal, onCleanup, Show, For } from 'solid-js';

/*
 * Search box for the island.
 *
 * Pagefind is a static-search engine: it crawls the built HTML in `dist/` and
 * writes an index plus a JS API to `/pagefind/`. That means:
 *
 *   - it only exists after a production build, so the import is lazy and
 *     failure-handled; in `astro dev` the box says so instead of breaking
 *   - the URL is a literal that must survive bundling, hence the @vite-ignore
 *   - no network at runtime beyond the local index, so it is fast and private
 *
 * The island re-measures its width when the result list appears, so the
 * container refits instead of clipping the new content.
 */

export interface Hit {
  url: string;
  title: string;
  excerpt: string;
}

type Status = 'idle' | 'loading' | 'unavailable' | 'ready';

interface Props {
  /** Called when the result list changes size, so the island can refit. */
  onRefit?: () => void;
  /** Called when a result is chosen; the island closes before navigation. */
  onNavigate?: () => void;
}

const MAX_RESULTS = 8;
const DEBOUNCE_MS = 140;

/** Pagefind's excerpts carry <mark> and entity-escaped HTML. Strip to text. */
function toText(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export default function IslandSearch(props: Props) {
  const [query, setQuery] = createSignal('');
  const [hits, setHits] = createSignal<Hit[]>([]);
  const [status, setStatus] = createSignal<Status>('idle');

  let inputEl!: HTMLInputElement;
  let timer: number | undefined;
  // Null until first load; `false` once we know there is no index (dev mode).
  let pagefind: typeof import('/pagefind/pagefind.js') | null | false = null;

  async function ensureIndex() {
    if (pagefind !== null) return pagefind === false ? null : pagefind;
    /*
     * Don't even try in dev. Pagefind writes its index only when it crawls the
     * built output, so `astro dev` can't have one; attempting the import just
     * logs a 404 in the terminal. `import.meta.env.PROD` is the build-time flag
     * Astro exposes to client components.
     */
    if (!import.meta.env.PROD) {
      pagefind = false;
      setStatus('unavailable');
      return null;
    }
    try {
      /*
       * The path is held in a variable so the bundler cannot analyse it: a
       * literal would be resolved at build time and fail, since Pagefind only
       * emits this file when it indexes the output afterwards.
       */
      const script = '/pagefind/pagefind.js';
      pagefind = (await import(/* @vite-ignore */ script)) as typeof import('/pagefind/pagefind.js');
      return pagefind;
    } catch {
      pagefind = false;
      setStatus('unavailable');
      return null;
    }
  }

  async function run(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      setHits([]);
      setStatus('idle');
      return;
    }
    setStatus('loading');
    const pf = await ensureIndex();
    if (!pf) return;
    const search = await pf.search(trimmed);
    const top = search.results.slice(0, MAX_RESULTS);
    const data = await Promise.all(top.map((r) => r.data()));
    setHits(
      data.map((d) => ({
        // Pagefind emits root-relative paths already; make it safe as an href
        url: d.url.startsWith('/') ? d.url : `/${d.url}`,
        title: d.meta?.title || toText(d.excerpt).slice(0, 60) || d.url,
        excerpt: toText(d.excerpt).slice(0, 160),
      }))
    );
    setStatus('ready');
    props.onRefit?.();
  }

  createEffect(() => {
    const text = query();
    window.clearTimeout(timer);
    if (!text.trim()) {
      setHits([]);
      setStatus('idle');
      return;
    }
    timer = window.setTimeout(() => void run(text), DEBOUNCE_MS);
  });

  /*
   * onCleanup runs on the server as well as the client (Solid tears the
   * rendered tree down after serialising it), so window access has to be
   * guarded - a bare reference crashes the whole SSR pass.
   */
  onCleanup(() => {
    if (typeof window !== 'undefined') window.clearTimeout(timer);
  });

  return (
    <div class="island-search">
      <label for="wob-search" class="block text-xs text-muted mb-2">
        Search
      </label>
      <input
        ref={inputEl}
        id="wob-search"
        type="search"
        value={query()}
        onInput={(e) => setQuery(e.currentTarget.value)}
        placeholder="Search posts and pages…"
        autocomplete="off"
        spellcheck={false}
        class="m3-input island-search-input w-full text-sm"
      />

      <Show when={status() === 'unavailable'}>
        <p class="text-xs text-muted mt-1.5">
          Search only exists in a build — run{' '}
          <code class="text-accent">pnpm build</code> then{' '}
          <code class="text-accent">pnpm preview</code> to search the site.
        </p>
      </Show>

      <Show when={hits().length > 0}>
        <ul class="island-search-results mt-2">
          <For each={hits()}>
            {(hit) => (
              <li>
                <a
                  href={hit.url}
                  onClick={() => props.onNavigate?.()}
                  class="island-search-result block rounded-xl px-3 py-2"
                >
                  <span class="block text-sm text-light truncate">{hit.title}</span>
                  <span class="block text-xs text-muted line-clamp-2">{hit.excerpt}</span>
                </a>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <Show
        when={
          status() === 'ready' &&
          hits().length === 0 &&
          query().trim().length > 0 &&
          status() !== 'unavailable'
        }
      >
        <p class="text-xs text-muted mt-2">No matches for “{query().trim()}”.</p>
      </Show>

      <Show when={status() === 'loading'}>
        <p class="text-xs text-muted mt-2">Searching…</p>
      </Show>
    </div>
  );
}