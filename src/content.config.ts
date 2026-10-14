import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { BLOG_DIR } from './lib/paths';

/*
 * `base` comes from src/lib/paths.ts so it matches the Org integration's source
 * directory - the two cannot drift apart, which is how posts went missing.
 *
 * The pattern is recursive: posts can sit directly in that directory or be
 * grouped into sub-directories alongside their images. Either way the URL is
 * flat - see src/lib/slug.ts.
 */
const blog = defineCollection({
  loader: glob({ base: `./${BLOG_DIR}`, pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    series: z.string().optional(),
    lang: z.string().default('en'),
    cover: z.string().optional(),
    toot: z.string().url().optional(),
  }),
});

export const collections = { blog };
