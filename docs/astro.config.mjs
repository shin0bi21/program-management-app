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
  redirects: {
    '/workflows/delivery/deployment/': '/workflows/production/deployment/',
    '/workflows/production/manual-deployment/': '/workflows/production/deployment/',
    '/workflows/production/email-recovery/': '/workflows/production/common-issues/email-recovery/',
    '/workflows/production/certificate-renewal/': '/workflows/production/common-issues/certificate-renewal/',
    '/workflows/production/github/access/': '/workflows/production/common-issues/github/access/',
    '/workflows/production/github/github-authentication/': '/workflows/production/common-issues/github/github-authentication/',

    '/workflows/production/nginx-and-tls/': '/workflows/production/common-issues/certificate-renewal/',
    '/workflows/production/access/': '/workflows/production/common-issues/github/access/',
    '/workflows/production/github-authentication/': '/workflows/production/common-issues/github/github-authentication/',
    '/workflows/admin/manual-deployment/': '/workflows/production/deployment/',
    '/workflows/': '/#documentation',
    '/frontend/pages/message-overlays/': '/frontend/components/message-overlays/',
    '/frontend/scaffolding/': '/frontend/pages/scaffolding/',
    '/website/': '/workflows/local-development/',
    '/frontend/components/badges/': '/frontend/components/#type-and-status-labels',
    '/backend/policies/': '/backend/authorization/',
    '/backend/reports/': '/backend/services/#render-reports',
    '/workflows/review/': '/workflows/delivery/review-and-merge/#review',
    '/workflows/shipping/': '/workflows/delivery/review-and-merge/#shipping',
    '/workflows/github-credentials/': '/workflows/production/common-issues/github/github-authentication/#server-github-access',
    '/workflows/setup/': '/workflows/local-development/setup/',
    '/workflows/debugging/': '/workflows/local-development/debugging/',
    '/workflows/data-snapshots/': '/workflows/delivery/refresh-data/',
    '/workflows/local-development/refresh-data/': '/workflows/delivery/refresh-data/',
    '/workflows/testing/': '/workflows/delivery/testing/',
    '/workflows/changes/': '/workflows/delivery/review-and-merge/',
    '/workflows/ci/': '/workflows/delivery/ci/',
    '/workflows/reports/': '/workflows/delivery/reports/',
    '/workflows/deployment/': '/workflows/production/deployment/',
    '/workflows/access/': '/workflows/production/common-issues/github/access/',
  },
  markdown: {
    processor: unified({ remarkPlugins: [[remarkRepositoryLinks, { manifest, gitRef }]] }),
  },
  integrations: [
    {
      name: 'canonical-documentation-reload',
      hooks: {
        'astro:server:setup': ({ server, logger }) => {
          const sources = ['../README.md', './backend/', './frontend/', './workflows/']
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
      sidebar: manifest.sidebar,
    }),
  ],
});
