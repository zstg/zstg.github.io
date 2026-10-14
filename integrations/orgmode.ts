import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { watch } from 'node:fs';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { BLOG_DIR as BLOG_DIR_NAME } from '../src/lib/paths';
import { slugFor } from '../src/lib/slug';

/*
 * Org-mode source for blog posts.
 *
 * Posts are written in Org-mode and converted to Markdown at build time. The
 * repository holds the .org sources; the generated .md files are build artefacts
 * and are git-ignored at every depth (see .gitignore).
 *
 * This puts a hard dependency on pandoc, which is deliberate: pandoc's Org
 * reader handles the parts that matter in practice - source blocks, tables,
 * footnotes, links, image references - better than anything hand-rolled.
 *
 * The .org frontmatter is parsed here rather than by pandoc, because pandoc
 * swallows keywords it knows (#+TITLE, #+DATE) and emits the ones it does not as
 * raw org blocks in the body. Neither is acceptable: the collection needs exact
 * control over which keys exist.
 */

const exec = promisify(execFile);

/** Directory holding the Org sources and their generated Markdown. */
const BLOG_DIR = resolve(process.cwd(), BLOG_DIR_NAME);

/** Where per-post image assets are staged for the browser to fetch. */
const PUBLIC_DIR = resolve(process.cwd(), 'public/blog');

/** Org keyword -> content-collection field. Unlisted keywords are ignored. */
const KEY_MAP: Record<string, string> = {
  TITLE: 'title',
  DATE: 'date',
  TAGS: 'tags',
  FILETAGS: 'tags',
  SERIES: 'series',
  LANG: 'lang',
  COVER: 'cover',
  TOOT: 'toot',
};

const TAG_SPLIT = /[\s,:]+/;

/* --------------------------------------------------------------- parsing --- */

/**
 * Split an Org file into its keyword header and its body.
 *
 * The header is the run of `#+KEY: value` lines at the top of the file. Org
 * allows blank lines inside it, so the scan continues through them and stops at
 * the first non-blank, non-keyword line.
 */
function splitOrg(text: string): { header: string; body: string } {
  const lines = text.split(/\r?\n/);
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;
    if (!/^#\+[A-Za-z0-9_-]+:/.test(line)) break;
  }
  if (i === 0) return { header: '', body: text };
  return { header: lines.slice(0, i).join('\n'), body: lines.slice(i).join('\n') };
}

function readKeywords(header: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const line of header.split(/\r?\n/)) {
    const m = line.match(/^\s*#\+([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    // Hugo-derived headers arrive as `#+tags[]:`; the bracket suffix is noise
    const field = KEY_MAP[m[1].replace(/\[\]$/, '').toUpperCase()];
    if (!field) continue;
    const value = m[2].trim();
    if (!out.has(field)) out.set(field, []);
    out.get(field)!.push(value);
  }
  return out;
}

/** One YAML scalar. Quoted unless it is plainly safe as a bare word. */
function yamlScalar(v: string): string {
  const needsQuotes = /[:#{}\[\],&*?|<>=!%@`"'\n]/.test(v) || v === '' || v !== v.trim();
  if (!needsQuotes && /^[A-Za-z0-9_./ -]+$/.test(v)) return v;
  return JSON.stringify(v);
}

/** Org dates are `[2026-07-26 Sun]`, `<2026-07-26>`, or a full timestamp. */
function normaliseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function frontmatter(kw: Map<string, string[]>, fallbackTitle: string, fallbackDate: string): string {
  const lines: string[] = [];
  const title = kw.get('title')?.[0]?.trim();
  lines.push(`title: ${yamlScalar(title || fallbackTitle)}`);
  lines.push(`date: ${yamlScalar(normaliseDate(kw.get('date')?.[0]) ?? fallbackDate)}`);

  const tags = kw.get('tags')?.flatMap((v) => v.split(TAG_SPLIT)).filter(Boolean);
  if (tags && tags.length > 0) {
    // quoted individually: a tag holding a colon or bracket would break the
    // flow sequence
    lines.push(`tags: [${tags.map(yamlScalar).join(', ')}]`);
  }

  for (const key of ['series', 'lang', 'cover', 'toot'] as const) {
    const v = kw.get(key)?.[0]?.trim();
    if (v) lines.push(`${key}: ${yamlScalar(v)}`);
  }
  return `---\n${lines.join('\n')}\n---\n`;
}

/* ------------------------------------------------------------ conversion --- */

/**
 * Rewrite Markdown links in an Org body as Org links.
 *
 * These posts were migrated from Hugo, so their bodies are full of
 * `[text](https://...)` - Markdown syntax, not Org. Pandoc's Org reader treats
 * that as literal text and the gfm writer escapes the brackets back out, so what
 * renders is the literal string `[here](url)` instead of a link.
 *
 * Only URLs with a scheme are touched: a bracketed phrase in prose is far more
 * likely to be punctuation. Fenced blocks are skipped so code samples keep
 * whatever they contain.
 */
function markdownLinksToOrg(body: string): string {
  const held: string[] = [];
  const mask = (m: string) => {
    held.push(m);
    return `\u0000${held.length - 1}\u0000`;
  };

  return body
    .split('\n')
    .map((line) => {
      if (/^\s*```/.test(line) || /^\s*#\+(BEGIN_SRC|END_SRC)/i.test(line)) return line;
      // protect =verbatim= and ~code~ spans, then put them back
      const masked = line
        .replace(/=[^=\n]+=/g, mask)
        .replace(/~[^~\n]+~/g, mask);
      const converted = masked.replace(
        /!?\[([^\]\n]*)\]\(([^)\s]+)\)/g,
        (m, text: string, url: string) => {
          if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) return m;
          return text ? `[[${url}][${text}]]` : `[[${url}]]`;
        }
      );
      return converted.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => held[Number(i)] ?? '');
    })
    .join('\n');
}

/**
 * Run pandoc over `input`.
 *
 * `spawn` rather than `execFile`: pandoc reads its input from stdin, so an
 * execFile call with no stdin blocks forever waiting for EOF. That hung the
 * whole build hook with no error - pandoc was simply sitting there.
 */
function runPandoc(input: string): Promise<string> {
  return new Promise((resolveP, rejectP) => {
    const proc = spawn('pandoc', [
      '-f', 'org',
      // gfm, not markdown: the markdown writer emits pandoc-only attribute
      // syntax and writes Org simple tables as indented blocks rather than
      // tables. gfm gives fenced code, pipe tables and clean inline code.
      '-t', 'gfm',
      '--wrap=none',
      // The page renders the post title as its <h1>, so Org's `*` headings
      // become `##` rather than fighting it for the top level.
      '--shift-heading-level-by=1',
    ]);
    let out = '';
    let err = '';
    proc.stdout.on('data', (d: Buffer) => { out += d.toString('utf8'); });
    proc.stderr.on('data', (d: Buffer) => { err += d.toString('utf8'); });
    proc.on('error', rejectP);
    proc.on('close', (code) => {
      // pandoc warns to stderr but exits 0, so only a non-zero exit is fatal
      if (code === 0) resolveP(out);
      else rejectP(new Error(err.trim() || `pandoc exited ${code}`));
    });
    proc.stdin.end(input, 'utf8');
  });
}

/**
 * Rewrite relative image references and stage those images.
 *
 * An image sits beside the Org file that references it, but the post is served
 * from /blog/<slug>/, so a relative path would resolve against the page and 404.
 * Each image is copied to public/blog/<slug>/ and the reference rewritten to the
 * absolute URL.
 *
 * Pandoc emits two shapes: `![](image)` for a bare link, and raw
 * `<img src="image">` when the Org line carries an #+CAPTION, because a captioned
 * image becomes a figure. Both are matched.
 */
async function stageImages(md: string, orgDir: string, slug: string, log: (m: string) => void) {
  const dest = join(PUBLIC_DIR, slug);
  await mkdir(dest, { recursive: true });
  const wanted: string[] = [];
  const staged: Promise<void>[] = [];

  const DEBUG = process.env.ORG_DEBUG === '1';

  const stage = (src: string) => {
    if (wanted.includes(src)) return;
    wanted.push(src);
    const from = join(orgDir, src);
    if (!existsSync(from)) {
      // A missing image is the normal case: post assets are kept beside the Org
      // source and are not committed, so every build would otherwise print a
      // warning per file. ORG_DEBUG=1 brings them back when investigating.
      if (DEBUG) log(`  ${slug}: missing image "${src}"`);
      return;
    }
    staged.push(cp(from, join(dest, src), { force: true }));
  };

  // Already addressed = has a scheme, a leading slash or a fragment. Comparing
  // against basename() would be wrong: for a bare filename the two are equal.
  const isAddressed = (src: string) => /^[a-z][a-z0-9+.-]*:|^\/|^#/i.test(src);

  const rewritten = md
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, src: string) => {
      if (isAddressed(src)) return `![${alt}](${src})`;
      stage(basename(src));
      return `![${alt}](/blog/${slug}/${basename(src)})`;
    })
    .replace(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/gi, (m, src: string) => {
      if (isAddressed(src)) return m;
      stage(basename(src));
      return m.replace(src, `/blog/${slug}/${basename(src)}`);
    });

  await Promise.all(staged);
  // nothing referenced -> nothing staged, so drop the empty directory
  if (wanted.length === 0) await rm(dest, { recursive: true, force: true });
  return rewritten;
}

async function convertOne(orgPath: string, log: (m: string) => void): Promise<boolean> {
  const mdPath = orgPath.replace(/\.org$/i, '.md');
  const { header, body } = splitOrg(await readFile(orgPath, 'utf8'));

  if (!body.trim()) {
    log(`  skip ${basename(orgPath)} - no body`);
    await rm(mdPath, { force: true });
    return false;
  }

  let md: string;
  try {
    md = await runPandoc(markdownLinksToOrg(body));
  } catch (err) {
    log(`  WARN pandoc failed on ${basename(orgPath)}: ${String(err).slice(0, 120)}`);
    log(`       keeping the previous Markdown if there is one`);
    return false;
  }

  const slug = slugFor(orgPath.slice(BLOG_DIR.length + 1));
  md = await stageImages(md, orgPath.replace(/\/[^/]*$/, ''), slug, log);

  const st = await stat(orgPath);
  await writeFile(mdPath, frontmatter(readKeywords(header), basename(orgPath, '.org'), new Date(st.mtime).toISOString().slice(0, 10)) + '\n' + md.replace(/^\n+/, ''), 'utf8');
  return true;
}

/* ------------------------------------------------------------- traversal -- */

/**
 * Every .org file under the content directory, at any depth.
 *
 * Recursive on purpose: posts are grouped into sub-directories alongside their
 * images, so `Linux/NixOS/nixos-part-1/index.org` has to be found. A flat
 * readdir only sees the top level, matches nothing but directories, and so
 * silently converts nothing at all - which reads as "some blogs aren't being
 * detected".
 */
async function listOrg(): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.org$/i.test(entry.name)) out.push(full);
    }
  };
  await walk(BLOG_DIR);
  return out;
}

export default function orgmode() {
  const log = (m: string) => console.log(`  [org] ${m}`);

  async function convertAll() {
    let ok = false;
    try {
      await exec('pandoc', ['--version']);
      ok = true;
    } catch {
      ok = false;
    }
    if (!ok) {
      log('pandoc not found - install it from https://pandoc.org');
      log('Org posts cannot be converted to Markdown without it.');
      log('Markdown posts still build normally.');
      return;
    }

    // Staged images are generated, so clear them first: a renamed or removed
    // image would otherwise linger in public/ forever.
    await rm(PUBLIC_DIR, { recursive: true, force: true });

    const files = await listOrg();
    let n = 0;
    for (const f of files) {
      if (await convertOne(f, log)) n++;
    }
    if (files.length === 0) log('no .org files found under ' + BLOG_DIR_NAME);
    if (n) log(`converted ${n} Org file(s)`);
  }

  return {
    name: 'wob-orgmode',
    hooks: {
      /*
       * config:setup, not build:start: the content collection syncs between
       * those two hooks, so build:start writes the Markdown after Astro has
       * already decided which posts exist. Config setup is before any of that,
       * in dev as well as at build time.
       */
      'astro:config:setup': async () => {
        await convertAll();
      },

      'astro:server:setup': async () => {
        // The initial conversion already ran in config:setup; this is only the
        // live-edit path, since Astro's glob loader does not watch Org.
        if (!existsSync(BLOG_DIR)) return;
        let timer: NodeJS.Timeout | undefined;

        const onChange = async (file: string) => {
          const path = join(BLOG_DIR, file);
          if (!existsSync(path)) {
            await rm(path.replace(/\.org$/i, '.md'), { force: true });
            log(`removed ${file}`);
            return;
          }
          await convertOne(path, log);
          log(`updated ${file}`);
        };

        watch(BLOG_DIR, { recursive: true }, (_event, file) => {
          if (file && /\.org$/i.test(file)) {
            clearTimeout(timer);
            timer = setTimeout(() => void onChange(file), 120);
          }
        });
      },
    },
  };
}
