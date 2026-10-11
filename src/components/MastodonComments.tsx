import { createSignal, onMount, Show, For } from 'solid-js';

interface Props {
  toot?: string;
}

interface Account {
  acct: string;
  display_name: string;
  avatar: string;
  url: string;
}

interface Status {
  id: string;
  url: string;
  created_at: string;
  content: string;
  account: Account;
  in_reply_to_id: string | null;
  replies_count: number;
  reblogs_count: number;
  favourites_count: number;
}

const ALLOWED_TAGS = new Set(['a', 'p', 'br', 'code', 'pre', 'span', 'b', 'i', 'em', 'strong', 'ul', 'ol', 'li', 'blockquote']);

function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  const bad: Element[] = [];
  while (walker.nextNode()) {
    const el = walker.currentNode as Element;
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      bad.push(el);
      continue;
    }
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (tag === 'a') {
        if (name !== 'href') el.removeAttribute(attr.name);
        else if (/^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
      } else if (name !== 'class') {
        el.removeAttribute(attr.name);
      }
    }
    if (tag === 'a') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'nofollow noopener');
    }
  }
  for (const el of bad) {
    const parent = el.parentNode;
    if (!parent) continue;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  }
  return doc.body.innerHTML;
}

function parseToot(toot: string): { origin: string; id: string } | null {
  try {
    const u = new URL(toot);
    const segs = u.pathname.split('/').filter(Boolean);
    const id = segs[segs.length - 1];
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
    return { origin: u.origin, id };
  } catch {
    return null;
  }
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function MastodonComments(props: Props) {
  const [status, setStatus] = createSignal<Status | null>(null);
  const [replies, setReplies] = createSignal<Status[]>([]);
  const [state, setState] = createSignal<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const parsed = () => (props.toot ? parseToot(props.toot) : null);

  onMount(async () => {
    const p = parsed();
    if (!p) return;
    setState('loading');
    try {
      const [sRes, cRes] = await Promise.all([
        fetch(`${p.origin}/api/v1/statuses/${p.id}`),
        fetch(`${p.origin}/api/v1/statuses/${p.id}/context`),
      ]);
      if (!sRes.ok || !cRes.ok) throw new Error(`HTTP ${sRes.status}/${cRes.status}`);
      const s = (await sRes.json()) as Status;
      const c = (await cRes.json()) as { descendants: Status[] };
      setStatus(s);
      const seen = new Set<string>();
      setReplies(
        (c.descendants || []).filter((r) => {
          if (!r?.id || seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        })
      );
      setState('ready');
    } catch {
      setState('error');
    }
  });

  function depthOf(r: Status, byId: Map<string, Status>, memo = new Map<string, number>()): number {
    if (memo.has(r.id)) return memo.get(r.id)!;
    let d = 0;
    let cur: Status | undefined = r;
    const chain = new Set<string>();
    while (cur?.in_reply_to_id && byId.has(cur.in_reply_to_id) && !chain.has(cur.id)) {
      chain.add(cur.id);
      cur = byId.get(cur!.in_reply_to_id);
      d += 1;
    }
    memo.set(r.id, d);
    return d;
  }

  return (
    <div class="mt-4">
      <h3 class="text-light font-semibold text-lg mb-4">Comments</h3>

      <Show when={!props.toot || !parsed()}>
        <div class="rounded-xl border border-white/10 bg-dark-light p-5 text-sm text-muted leading-relaxed">
          <p>
            Comments live on the Fediverse. No discussion thread is linked for this post yet —{' '}
            <a href="https://fedia.social/@zstg" rel="me" class="text-accent hover:underline">
              follow me
            </a>{' '}
            and reply to the announcement toot once it's linked here.
          </p>
        </div>
      </Show>

      <Show when={(props.toot && parsed()) as boolean}>
        <Show when={state() === 'loading'}>
          <p class="text-muted text-sm">Loading Fediverse replies…</p>
        </Show>

        <Show when={state() === 'error'}>
          <div class="rounded-xl border border-white/10 bg-dark-light p-5 text-sm text-muted leading-relaxed">
            <p>
              Couldn't fetch replies right now.{' '}
              <a href={props.toot} target="_blank" rel="noopener" class="text-accent hover:underline">
                Join the discussion on the Fediverse
              </a>
              .
            </p>
          </div>
        </Show>

        <Show when={state() === 'ready'}>
          <Show
            when={replies().length > 0}
            fallback={
              <div class="rounded-xl border border-white/10 bg-dark-light p-5 text-sm text-muted leading-relaxed">
                <p>
                  No replies yet —{' '}
                  <a href={props.toot} target="_blank" rel="noopener" class="text-accent hover:underline">
                    be the first to reply on the Fediverse
                  </a>
                  .
                </p>
              </div>
            }
          >
            <div class="space-y-4">
              <For each={(() => {
                const list = replies();
                const byId = new Map(list.map((r) => [r.id, r]));
                return list.map((r) => ({ r, depth: Math.min(depthOf(r, byId), 4) }));
              })()}>
                {({ r, depth }) => (
                  <article
                    class="rounded-xl border border-white/10 bg-dark-light p-4"
                    style={{ 'margin-left': depth > 0 ? `${Math.min(depth, 3) * 1.25}rem` : '0' }}
                  >
                    <header class="flex items-center gap-3 mb-2">
                      <img
                        src={r.account.avatar}
                        alt=""
                        width="32"
                        height="32"
                        loading="lazy"
                        class="w-8 h-8 rounded-full object-cover"
                      />
                      <div class="min-w-0">
                        <a
                          href={r.account.url}
                          target="_blank"
                          rel="noopener"
                          class="block truncate text-sm font-medium text-light hover:text-accent"
                          innerHTML={sanitize(r.account.display_name || r.account.acct)}
                        />
                        <span class="block truncate text-xs text-muted">@{r.account.acct} · {timeAgo(r.created_at)}</span>
                      </div>
                    </header>
                    <div
                      class="text-sm text-light/90 leading-relaxed [&_a]:text-accent [&_p]:my-1"
                      innerHTML={sanitize(r.content)}
                    />
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener"
                      class="inline-block mt-2 text-xs text-muted hover:text-accent"
                    >
                      {r.replies_count > 0 ? `${r.replies_count} ${r.replies_count === 1 ? 'reply' : 'replies'} · ` : ''}
                      view on Fediverse →
                    </a>
                  </article>
                )}
              </For>
            </div>
          </Show>

          <div class="mt-5 flex flex-wrap items-center gap-3">
            <a href={props.toot} target="_blank" rel="noopener" class="btn">
              Reply on the Fediverse
            </a>
            <Show when={status()}>
              <span class="text-xs text-muted">
                {status()!.replies_count} {status()!.replies_count === 1 ? 'reply' : 'replies'} ·{' '}
                {status()!.reblogs_count} boosts · {status()!.favourites_count} likes
              </span>
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  );
}
