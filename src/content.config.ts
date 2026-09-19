import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/blog',
  }),

  schema: z.object({
    // Required
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),

    // Optional
    updatedDate: z.coerce.date().optional(),

    author: z.string().default('Devendra Choudhary'),

    tags: z.array(z.string()).default([]),

    heroImage: z.string().optional(),

    heroImageAlt: z.string().optional(),

    canonicalUrl: z.url().optional(),
  }),
});

export const collections = {
  blog,
};

