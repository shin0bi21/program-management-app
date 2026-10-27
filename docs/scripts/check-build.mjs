import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../dist/', import.meta.url));
const pages = [];

async function collectPages(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collectPages(path);
    else if (entry.isFile() && entry.name.endsWith('.html')) pages.push(path);
  }
}

await collectPages(output);
const failures = [];

for (const page of pages) {
  const html = await readFile(page, 'utf8');
  const route = `/${relative(output, page).replace(/index\.html$/, '')}`;

  for (const match of html.matchAll(/\bhref="([^"]+)"/g)) {
    const href = match[1].replaceAll('&amp;', '&');
    const url = new URL(href, `https://docs.local${route}`);
    if (url.origin !== 'https://docs.local') continue;

    let target = resolve(output, `.${decodeURIComponent(url.pathname)}`);
    try {
      if ((await stat(target)).isDirectory()) target = join(target, 'index.html');
      await stat(target);
      if (url.hash && target.endsWith('.html')) {
        const content = await readFile(target, 'utf8');
        const anchor = decodeURIComponent(url.hash.slice(1));
        if (!content.includes(`id="${anchor}"`)) failures.push(`${route}: missing anchor ${href}`);
      }
    } catch {
      failures.push(`${route}: missing target ${href}`);
    }
  }
}

await stat(join(output, 'pagefind/pagefind.js'));
if (failures.length) throw new Error(failures.join('\n'));
console.log(`Verified ${pages.length} HTML pages, local links, anchors, and the Pagefind bundle.`);
