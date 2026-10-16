// @ts-check
import { defineConfig } from 'astro/config';

import solidJs from '@astrojs/solid-js';
import tailwindcss from '@tailwindcss/vite';
import orgmode from './integrations/orgmode';

// https://astro.build/config
export default defineConfig({
  integrations: [solidJs(), orgmode()],
  
  site: 'https://zstg.is-a.dev',
  output: 'static',
  
  vite: {
    plugins: [tailwindcss()]
  }
});
