import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { watch } from 'node:fs';
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';

/*
 * Org-mode source for blog posts.
 *
 * Posts are written in Org-mode and converted to Markdown at build time, so the
 * repository only ever contains .org files and the generated .md files are
 * build artefacts (see .gitignore). Astro's content collection is told to load
 * the .md side of that pair, which keeps every downstream consumer - the schema,
 * prev/next ordering, Pagefind - unaware that Org exists.
 *
 * This does put a hard dependency on pandoc, which is deliberate: pandoc's Org
 * reader is far better than anything hand-rolled, and it handles the parts that
 * matter most in practice - source blocks, tables, footnotes, links.
 *
 * The .org frontmatter is parsed here rather than by pandoc, because pandoc
 * swallows keys it knows (#+TITLE, #+DATE) and emits the ones it does not as
 * raw org blocks in the body. Neither is acceptable: the collection needs
 * exact control over which keys exist.
 */

const exec = promisify(execFile);

/** Directory holding both the Org sources and their generated Markdown. */
const BLOG_DIR = join(process.cwd(), 'src/content/blog');

/*
 * Org keyword -> content-collection field. Anything not listed is ignored, so
 * an unknown keyword is a no-op rather than a schema error.
 */
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

/**
 * Split an Org file into its keyword header and its body.
 *
 * The header is the run of `#+KEY: value` lines at the top of the file. Org
 * allows blank lines inside it, so the scan continues through them and stops at
 * the first non-blank, non-keyword line - which is the start of the document.
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
    const field = KEY_MAP[m[1].toUpperCase()];
    if (!field) continue;
    const value = m[2].trim();
    if (!out.has(field)) out.set(field, []);
    out.get(field)!.push(value);
  }
  return out;
}

/** One YAML scalar. Quoted unless it is plainly safe as a bare word. */
function yamlScalar(v: string): string {
  const needsQuotes =
    /[:#{}\[\],&*?|<>=!%@`"'\n]/.test(v) || v === '' || /^\s|\s$/.test(v) || v !== v.trim();
  if (!needsQuotes && /^[A-Za-z0-9_./ -]+$/.test(v)) return v;
  return JSON.stringify(v);
}

/** Build the YAML frontmatter block from parsed keywords. */
function frontmatter(kw: Map<string, string[]>, fallbackTitle: string, fallbackDate: string): string {
  const lines: string[] = [];
  const title = kw.get('title')?.[0]?.trim();
  lines.push(`title: ${yamlScalar(title || fallbackTitle)}`);

  const date = normaliseDate(kw.get('date')?.[0]) ?? fallbackDate;
  lines.push(`date: ${yamlScalar(date)}`);

  const tags = kw
    .get('tags')
    ?.flatMap((v) => v.split(TAG_SPLIT))
    .filter(Boolean);
  if (tags && tags.length > 0) {
    // quoted individually: a tag holding a colon or a bracket would otherwise
    // break the flow sequence
    lines.push(`tags: [${tags.map(yamlScalar).join(', ')}]`);
  }

  for (const key of ['series', 'lang', 'cover', 'toot'] as const) {
    const v = kw.get(key)?.[0]?.trim();
    if (v) lines.push(`${key}: ${yamlScalar(v)}`);
  }

  return `---\n${lines.join('\n')}\n---\n`;
}

/** Org dates are `[2026-07-26 Sun]`, `<2026-07-26>`, or plain `2026-07-26`. */
function normaliseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

async function convertOne(orgPath: string, log: (m: string) => void): Promise<boolean> {
  const mdPath = orgPath.replace(/\.org$/i, '.md');
  const text = await readFile(orgPath, 'utf8');
  const { header, body } = splitOrg(text);
  const kw = readKeywords(header);

  if (!body.trim()) {
    log(`  skip ${basename(orgPath)} - no body`);
    await rm(mdPath, { force: true });
    return false;
  }

  const md = await pandocMarkdown(body);
  if (md === null) {
    log(`  WARN pandoc failed on ${basename(orgPath)} - keeping the previous .md`);
    return false;
  }

  const st = await stat(orgPath);
  const fm = frontmatter(
    kw,
    basename(orgPath, '.org'),
    new Date(st.mtime).toISOString().slice(0, 10)
  );

  await writeFile(mdPath, fm + '\n' + md.replace(/^\n+/, ''), 'utf8');
  return true;
}

/**
 * Run pandoc over `input`, reading from stdin and writing to stdout.
 *
 * `spawn` rather than `execFile`: pandoc reads its input from stdin, so an
 * execFile call with no stdin to hand it blocks forever waiting for EOF. That
 * hung the whole build hook with no error - pandoc was simply sitting there.
 */
function runPandoc(input: string): Promise<string> {
  return new Promise((resolveP, rejectP) => {
    const proc = spawn('pandoc', [
      '-f', 'org',
      // gfm, not markdown: the markdown writer emits pandoc-only attribute
      // syntax (`{.verbatim}`, `{.commonlisp org-language="..."}`) and writes
      // Org simple tables as indented blocks rather than tables. gfm produces
      // the fenced code, pipe tables and inline code that Astro's renderer and
      // its GFM plugin expect.
      '-t', 'gfm',
      '--wrap=none',
      // The page already renders the post title as its <h1>, so Org's `*`
      // headings become `##` rather than fighting it for the top level.
      '--shift-heading-level-by=1',
    ]);
    let out = '';
    let err = '';
    proc.stdout.on('data', (d: Buffer) => {
      out += d.toString('utf8');
    });
    proc.stderr.on('data', (d: Buffer) => {
      err += d.toString('utf8');
    });
    proc.on('error', rejectP);
    proc.on('close', (code) => {
      // pandoc warns to stderr but exits 0, so only a non-zero exit is fatal
      if (code === 0) resolveP(out);
      else rejectP(new Error(err.trim() || `pandoc exited ${code}`));
    });
    proc.stdin.end(input, 'utf8');
  });
}

async function pandocMarkdown(body: string): Promise<string | null> {
  try {
    return await runPandoc(body);
  } catch {
    return null;
  }
}

async function listOrg(): Promise<string[]> {
  if (!existsSync(BLOG_DIR)) return [];
  const entries = await readdir(BLOG_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isFile() && /\.org$/i.test(e.name)).map((e) => join(BLOG_DIR, e.name));
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
    const files = await listOrg();
    let n = 0;
    for (const f of files) {
      if (await convertOne(f, log)) n++;
    }
    if (n) log(`converted ${n} Org file(s)`);
  }

  return {
    name: 'wob-orgmode',
    hooks: {
      /*
       * config:setup, not build:start: the content collection syncs between
       * those two hooks, so converting in build:start wrote the Markdown after
       * Astro had already decided which posts existed and the post silently
       * disappeared from the build. Config setup is before any of that, in dev
       * as well as at build time, which also means the dev server starts with
       * the Markdown already generated.
       */
      'astro:config:setup': async () => {
        await convertAll();
      },

      'astro:server:setup': async () => {

        // Org is not a format Astro's glob loader watches, so its generated
        // Markdown is driven from here instead: an edit to an .org file has to
        // re-run pandoc before the collection reloads.
        if (!existsSync(BLOG_DIR)) return;
        let timer: NodeJS.Timeout | undefined;
        const schedule = (file: string) => {
          if (!/\.org$/i.test(file)) return;
          clearTimeout(timer);
          timer = setTimeout(async () => {
            const path = join(BLOG_DIR, basename(file));
            if (!existsSync(path)) {
              await rm(path.replace(/\.org$/i, '.md'), { force: true });
              log(`removed ${basename(path)}`);
              return;
            }
            await convertOne(path, log);
            log(`updated ${basename(path)}`);
          }, 120);
        };

        watch(BLOG_DIR, { recursive: false }, (_event, file) => {
          if (file) schedule(file);
        });
      },
    },
  };
}