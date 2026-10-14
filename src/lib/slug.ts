/**
 * URL slugs for blog posts.
 *
 * A post lives wherever its source lives - `src/content/Linux/Arch/Arch-part1.org`
 * or `src/content/Linux/NixOS/nixos-part-1/index.org` - but its URL has to be
 * flat and stable: /blog/<slug>/. The directory is for humans and their images;
 * it is not part of the address.
 *
 * Used by the Org integration, which needs the same slug to stage images at
 * public/blog/<slug>/, and by the page routes. One implementation so the two
 * cannot disagree.
 *
 * Rules, in order:
 *   1. a file named index takes the name of its parent directory, so
 *      "NixOS/nixos-part-1/index.org" is just "nixos-part-1"
 *   2. otherwise the filename
 *   3. lowercased, non-alphanumerics collapsed to a single hyphen, and a hyphen
 *      inserted between a letter and a digit - so "Arch-part1" becomes
 *      "arch-part-1" rather than "arch-part1"
 *   4. leading and trailing hyphens trimmed
 */

/** Turn any id or path into the flat slug a post is served at. */
export function slugFor(idOrPath: string): string {
  let base = idOrPath.replace(/\\/g, '/').replace(/\.(org|md|mdx)$/i, '');
  const parts = base.split('/').filter(Boolean);
  const name = parts.pop() ?? base;

  // "dir/index" -> "dir": the directory names the post
  const slugSource = /^index$/i.test(name) && parts.length ? parts[parts.length - 1]! : name;

  return (
    slugSource
      // letters next to digits get separated: Arch-part1 -> Arch-part-1
      .replace(/([A-Za-z])(\d)/g, '$1-$2')
      .replace(/(\d)([A-Za-z])/g, '$1-$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'post'
  );
}

/**
 * Map many ids to unique slugs, in input order.
 *
 * A collision gets a numeric suffix rather than silently shadowing a post.
 */
export function slugMap(ids: string[]): Map<string, string> {
  const out = new Map<string, string>();
  const taken = new Set<string>();
  for (const id of ids) {
    let slug = slugFor(id);
    if (taken.has(slug)) {
      let n = 2;
      while (taken.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
    }
    taken.add(slug);
    out.set(id, slug);
  }
  return out;
}
