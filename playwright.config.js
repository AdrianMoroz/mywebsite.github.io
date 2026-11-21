import { defineConfig } from '@playwright/test';

const url = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests',
  use: { baseURL: url },
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url,
  },
});
