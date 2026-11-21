import { readFile, writeFile } from 'node:fs/promises';
import { render } from '../.prerender/entry-server.js';
import { injectMarkup } from './html.js';

const index = new URL('../dist/index.html', import.meta.url);
const html = await readFile(index, 'utf8');
await writeFile(index, injectMarkup(html, render()));
