import { createSignal, createMemo, For, Show } from 'solid-js';
import {
  fediverseProfileUrl,
  fediverseInstance,
  fediverseHandle,
  FEDIVERSE,
} from '../data/fediverse';

/*
 * Fediverse comments.
 *
 * Renders the reply tree under a post's announcement toot. Deliberately lazy:
 * nothing is fetched until the reader asks for it, because this is the heaviest
 * thing on the page (one request per revealed reactor list) and most readers
 * never get to it.
 *
 * Notes on what the Mastodon API makes possible, since it constrains the
 * shape of this component:
 *
 *   - The full reply set comes from /statuses/:id/context, which returns
 *     `descendants` as a flat list carrying in_reply_to_id. There is no
 *     unauthenticated endpoint that lists every reply to a status directly, so
 *     a very long thread can be truncated by the instance. Everything we do get
 *     is shown, hierarchically, not just the root's immediate replies.
 *   - Who favourited and who boosted are /favourited_and /reblogged_by, fetched
 *     only when a reader hovers the indicator.
 *   - Per-emoji reactions are not part of the Mastodon API. Akkoma and some
 *     forks expose `emoji_reactions` on the status object, so that slot reads it
 *     when present and simply disappears when it isn't.
 */

interface Props {
  toot?: string;
}

interface Account {
  id: string;
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
  sensitive?: boolean;
  spoiler_text?: string;
  emoji_reactions?: { name: string; count: number; me: boolean; url?: string; static_url?: string }[];
  media_attachments?: { id: string; type: string; url: string; preview_url?: string; description?: string }[];
}

const ALLOWED_TAGS = new Set([
  'a', 'p', 'br', 'code', 'pre', 'span', 'b', 'i', 'em', 'strong', 'ul', 'ol', 'li',
  'blockquote', 'img', 'hr',
]);

/**
 * Mastodon hands back HTML with its own class names and inline styles. Only the
 * tags and attributes below are kept - everything else is dropped or unwrapped -
 * because the result is injected as innerHTML.
 */
function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  const dead: Element[] = [];
  while (walker.nextNode()) {
    const el = walker.currentNode as Element;
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      dead.push(el);
      continue;
    }
    for (const attr of [...el.attributes]) {
      const n = attr.name.toLowerCase();
      if (n.startsWith('on') || n === 'style') el.removeAttribute(attr.name);
      else if (tag === 'a' && n === 'href' && attr.value.trim().toLowerCase().startsWith('javascript:'))
        el.removeAttribute(attr.name);
      else if (tag !== 'a' && tag !== 'img' && n !== 'class') el.removeAttribute(attr.name);
    }
    if (tag === 'a') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'nofollow noopener');
    }
  }
  for (const el of dead) el.replaceWith(...Array.from(el.childNodes));
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
  const then = new Date(iso).getTime();
  const sec = Math.max(0, (Date.now() - then) / 1000);
  if (sec < 45) return 'just now';
  const min = sec / 60;
  if (min < 60) return `${Math.round(min)}m ago`;
  const hr = min / 60;
  if (hr < 24) return `${Math.round(hr)}h ago`;
  const day = hr / 24;
  if (day < 30) return `${Math.round(day)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ---------------------------------------------------------------- tree ---- */

interface Node {
  status: Status;
  children: Node[];
}

/**
 * Turn `descendants` into a tree rooted at the announcement toot.
 *
 * Orphans - replies whose parent is missing from the list, which happens when
 * an instance prunes a long thread - are re-pointed at the root rather than
 * dropped, so no reply silently disappears.
 */
function buildTree(rootId: string, flat: Status[]): Node {
  const byId = new Map(flat.map((s) => [s.id, s]));
  const kids = new Map<string, Status[]>();
  for (const s of flat) {
    const parent = s.in_reply_to_id ?? rootId;
    const known = parent === rootId || byId.has(parent);
    const key = known ? parent : rootId;
    const list = kids.get(key);
    if (list) list.push(s);
    else kids.set(key, [s]);
  }
  const walk = (s: Status): Node => ({ status: s, children: (kids.get(s.id) ?? []).map(walk) });
  return { status: { id: rootId } as Status, children: (kids.get(rootId) ?? []).map(walk) };
}

/* ------------------------------------------------------------- reactors --- */

type ReactorKind = 'fav' | 'boost' | 'react';

/** Who performed an action, fetched on demand and cached for the session. */
function Reactors(props: { origin: string; status: Status; kind: ReactorKind }) {
  const [people, setPeople] = createSignal<Account[] | null>(null);
  let started = false;

  const load = async () => {
    if (started) return;
    started = true;
    const { origin, status, kind } = props;
    try {
      if (kind === 'fav' || kind === 'boost') {
        const path = kind === 'fav' ? 'favourited_by' : 'reblogged_by';
        const res = await fetch(`${origin}/api/v1/statuses/${status.id}/${path}?limit=50`);
        if (!res.ok) throw new Error(String(res.status));
        setPeople((await res.json()) as Account[]);
      } else {
        // Reactions are not in the Mastodon API, so there is nothing to fetch:
        // the emoji and counts are already on the status object, and the API
        // carries no attribution for them to show.
        setPeople([]);
      }
    } catch {
      setPeople([]);
    }
  };

  /*
   * Reactions render as a row of emoji chips carrying their own counts. Mastodon
   * core has no reactions at all, so for most instances this renders nothing
   * and the slot disappears.
   */
  if (props.kind === 'react') {
    const reactions = props.status.emoji_reactions ?? [];
    return (
      <Show when={reactions.length > 0}>
        <span class="comments-emojis">
          <For each={reactions}>
            {(r) => (
              <span class="comments-emoji" title={`${r.name} ×${r.count}`}>
                {r.url ? <img src={r.url} alt={r.name} width="14" height="14" loading="lazy" /> : r.name}
                <span class="reactor-count">{r.count}</span>
              </span>
            )}
          </For>
        </span>
      </Show>
    );
  }

  const count = () => (props.kind === 'fav' ? props.status.favourites_count : props.status.reblogs_count);
  const verb = () => (props.kind === 'fav' ? 'liked' : 'boosted');

  return (
    <Show when={count() > 0}>
      <span class="reactor" role="button" tabindex="0" aria-label={`${count()} ${verb()}`}>
        {props.kind === 'fav' ? HEART : BOOST}
        <span class="reactor-count">{count()}</span>
        <span class="reactor-tip" role="tooltip">
          <Show when={people() === null}>
            <span class="reactor-tip-row">loading…</span>
          </Show>
          <Show when={people() !== null && people()!.length > 0}>
            <For each={people()!}>
              {(p) => (
                <span class="reactor-tip-row">
                  <img src={p.avatar} alt="" width="16" height="16" loading="lazy" />
                  {p.display_name || p.acct}
                </span>
              )}
            </For>
            {people()!.length >= 50 ? <span class="reactor-tip-row">…and more</span> : null}
          </Show>
          <Show when={people() !== null && people()!.length === 0}>
            <span class="reactor-tip-row">nobody yet</span>
          </Show>
        </span>
        {/* hover and focus both trigger it, so keyboard readers get the list */}
        <span class="reactor-probe" onPointerEnter={load} onFocusin={load} aria-hidden="true" />
      </span>
    </Show>
  );
}

/* ---------------------------------------------------------------- icons --- */

const HEART = (
  <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" aria-hidden="true">
    <path d="M12 21s-6.7-4.4-9.2-7C.9 11.9 1.5 8.5 4.5 7c2.2-1.1 4.8-.3 6 1.5C11.7 6.7 14.3 5.9 16.5 7c3 1.5 3.6 4.9 1.7 7-2.5 2.6-9.2 7-9.2 7z" />
  </svg>
);

const BOOST = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
       stroke-linecap="round" stroke-linejoin="round" width="13" height="13" aria-hidden="true">
    <path d="M17 2l4 4-4 4" />
    <path d="M3 6h18" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 18H3" />
  </svg>
);

/* --------------------------------------------------------------- the UI --- */

const PAGE = 5;

function Reply(props: { node: Node; origin: string; depth: number }) {
  const [shown, setShown] = createSignal(PAGE);
  const s = () => props.node.status;
  const kids = () => props.node.children;
  const more = () => kids().length > shown();

  return (
    <article class="comments-reply" data-depth={props.depth}>
      <header class="comments-reply-head">
        <img
          src={s().account.avatar}
          alt=""
          width="32"
          height="32"
          loading="lazy"
          class="comments-avatar"
        />
        <div class="min-w-0">
          <a
            href={s().account.url}
            target="_blank"
            rel="noopener"
            class="comments-name"
            innerHTML={sanitize(s().account.display_name || s().account.acct)}
          />
          <span class="comments-meta">
            @{s().account.acct} · {timeAgo(s().created_at)}
          </span>
        </div>
      </header>

      <div
        class="comments-body"
        innerHTML={sanitize(s().content)}
      />

      <Show when={s().media_attachments && s().media_attachments.length > 0}>
        <div class="comments-media">
          <For each={s().media_attachments!.filter((m) => m.type === 'image')}>
            {(m) => (
              <a href={m.url} target="_blank" rel="noopener">
                <img src={m.preview_url || m.url} alt={m.description || ''} loading="lazy" />
              </a>
            )}
          </For>
        </div>
      </Show>

      <footer class="comments-reply-foot">
        <a href={s().url} target="_blank" rel="noopener" class="comments-perma">
          view on Fediverse →
        </a>
        <span class="comments-reactors">
          <Reactors origin={props.origin} status={s()} kind="fav" />
          <Reactors origin={props.origin} status={s()} kind="boost" />
          <Reactors origin={props.origin} status={s()} kind="react" />
        </span>
      </footer>

      <Show when={kids().length > 0}>
        <div class="comments-branch" data-depth={props.depth + 1}>
          <For each={kids().slice(0, shown())}>
            {(child) => <Reply node={child} origin={props.origin} depth={props.depth + 1} />}
          </For>
          <Show when={more()}>
            <button type="button" class="comments-more" onClick={() => setShown(shown() + PAGE)}>
              Load {Math.min(PAGE, kids().length - shown())} more{' '}
              {kids().length - shown() === 1 ? 'reply' : 'replies'}…
            </button>
          </Show>
        </div>
      </Show>
    </article>
  );
}

export default function MastodonComments(props: Props) {
  const parsed = createMemo(() => (props.toot ? parseToot(props.toot) : null));
  const [active, setActive] = createSignal(false);
  const [root, setRoot] = createSignal<Status | null>(null);
  const [err, setErr] = createSignal(false);
  const [shown, setShown] = createSignal(PAGE);

  const [flat, setFlat] = createSignal<Status[]>([]);
  const top = createMemo(() => {
    const r = root();
    return r ? buildTree(r.id, flat()).children : [];
  });

  async function activate() {
    const p = parsed();
    if (!p) return;
    setActive(true);
    try {
      const [sRes, cRes] = await Promise.all([
        fetch(`${p.origin}/api/v1/statuses/${p.id}`),
        fetch(`${p.origin}/api/v1/statuses/${p.id}/context`),
      ]);
      if (!sRes.ok || !cRes.ok) throw new Error(`HTTP ${sRes.status}/${cRes.status}`);
      const s = (await sRes.json()) as Status;
      const c = (await cRes.json()) as { descendants: Status[] };
      setRoot(s);
      // de-dupe, and drop anything that claims the toot as its own parent
      // twice, which some instances return
      const seen = new Set<string>();
      setFlat((c.descendants || []).filter((r) => {
        if (!r?.id || seen.has(r.id) || r.id === s.id) return false;
        seen.add(r.id);
        return true;
      }));
    } catch {
      setErr(true);
    }
  }

  const total = createMemo(() => flat().length);
  const shownTop = createMemo(() => top().slice(0, shown()));
  const moreTop = createMemo(() => top().length > shown());

  return (
    <section class="comments" aria-label="Comments">
      <div class="comments-head">
        <h3 class="comments-title">Comments</h3>
        <span class="comments-count">
          <Show when={root()} fallback={total() > 0 ? `${total()} replies` : null}>
            {root()!.replies_count} replies · {root()!.reblogs_count} boosts ·{' '}
            {root()!.favourites_count} likes
          </Show>
        </span>
      </div>

      {/* closed state: nothing is fetched until asked */}
      <Show when={!parsed()}>
        <div class="comments-box">
          <p>{FEDIVERSE.blurb}</p>
          <p class="mt-2">
            <a href={fediverseProfileUrl()} rel="me" class="text-accent hover:underline">
              {fediverseHandle()} on {fediverseInstance()}
            </a>
          </p>
        </div>
      </Show>

      <Show when={parsed() && !active()}>
        <div class="comments-box comments-spread">
          <p>
            The reply thread lives on {fediverseInstance()}. Loading it pulls every
            reply to the announcement toot.
          </p>
          <button type="button" class="btn" onClick={activate}>
            Load comments
          </button>
        </div>
      </Show>

      <Show when={active()}>
        <Show when={err()}>
          <div class="comments-box">
            <p>
              Couldn't fetch replies right now.{' '}
              <a href={props.toot} target="_blank" rel="noopener" class="text-accent hover:underline">
                Join the discussion on the Fediverse
              </a>
              .
            </p>
          </div>
        </Show>

        <Show when={!err() && root() === null}>
          <p class="text-muted text-sm">Loading Fediverse replies…</p>
        </Show>

        <Show when={root() !== null}>
          <Show
            when={top().length > 0}
            fallback={
              <div class="comments-box">
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
            <div class="comments-thread">
              <For each={shownTop()}>
                {(node) => <Reply node={node} origin={new URL(props.toot!).origin} depth={0} />}
              </For>
              <Show when={moreTop()}>
                <button type="button" class="comments-more" onClick={() => setShown(shown() + PAGE)}>
                  Load {Math.min(PAGE, top().length - shown())} more{' '}
                  {top().length - shown() === 1 ? 'reply' : 'replies'}…
                </button>
              </Show>
            </div>
          </Show>

          <div class="comments-cta">
            <a href={props.toot} target="_blank" rel="noopener" class="btn">
              Reply on the Fediverse
            </a>
          </div>
        </Show>
      </Show>
    </section>
  );
}