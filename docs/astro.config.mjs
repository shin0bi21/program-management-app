import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import { prepareContent } from './scripts/prepare-content.mjs';
import remarkRepositoryLinks from './scripts/remark-repository-links.mjs';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';

const gitRef = process.env.DOCS_GIT_REF || 'main';
const manifest = await prepareContent({ gitRef });

export default defineConfig({
  output: 'static',
  markdown: {
    processor: unified({ remarkPlugins: [[remarkRepositoryLinks, { manifest, gitRef }]] }),
  },
  integrations: [
    {
      name: 'canonical-documentation-reload',
      hooks: {
        'astro:server:setup': ({ server, logger }) => {
          const sources = ['../README.md', './README.md', './backend/', './frontend/', './workflows/']
            .map(path => fileURLToPath(new URL(path, import.meta.url)));
          server.watcher.add(sources);
          let refresh = Promise.resolve();

          const onChange = (_event, path) => {
            if (!/\.(?:md|mmd)$/.test(path) || !sources.some(source => path === source || path.startsWith(source))) return;

            refresh = refresh.then(async () => {
              const updated = await prepareContent({ gitRef });
              Object.assign(manifest, updated);
              server.ws.send({ type: 'full-reload' });
            }).catch(error => logger.error(error.message));
          };

          server.watcher.on('all', onChange);
          server.httpServer?.once('close', () => server.watcher.off('all', onChange));
        },
      },
    },
    starlight({
      title: 'Be Original · Developer Docs',
      description: 'Architecture, development guides, and operational runbooks for Be Original.',
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        { label: 'Overview', slug: '' },
        { label: 'Docs Website', slug: 'website' },
        ...manifest.sidebar,
      ],
    }),
  ],
});
