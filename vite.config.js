import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { injectMarkup } from './scripts/html.js';

export default defineConfig(({ isSsrBuild }) => ({
  base: '/',
  plugins: [
    react(),
    {
      name: 'prerender-homepage-in-dev',
      apply: 'serve',
      transformIndexHtml: {
        order: 'post',
        async handler(html, { server }) {
          const { render } = await server.ssrLoadModule('/src/entry-server.jsx');
          return injectMarkup(html, render());
        },
      },
    },
  ],
  build: { copyPublicDir: !isSsrBuild },
}));
