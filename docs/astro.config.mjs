import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import { prepareContent } from './scripts/prepare-content.mjs';
import remarkRepositoryLinks from './scripts/remark-repository-links.mjs';

const gitRef = process.env.DOCS_GIT_REF || 'main';
const manifest = await prepareContent({ gitRef });

export default defineConfig({
  site: 'https://docs.be-original.ca',
  output: 'static',
  markdown: {
    processor: unified({ remarkPlugins: [[remarkRepositoryLinks, { manifest, gitRef }]] }),
  },
  integrations: [
    starlight({
      title: 'Be Original · Developer Docs',
      description: 'Architecture, development guides, and operational runbooks for Be Original.',
      customCss: ['./src/styles/custom.css'],
      head: [{ tag: 'meta', attrs: { name: 'robots', content: 'noindex, nofollow' } }],
      sidebar: [
        { label: 'Overview', slug: '' },
        { label: 'Docs website', slug: 'website' },
        { label: 'Frontend', items: [{ autogenerate: { directory: 'frontend' } }] },
        { label: 'Backend', items: [{ autogenerate: { directory: 'backend' } }] },
        { label: 'Workflows & runbooks', items: [{ autogenerate: { directory: 'workflows' } }] },
      ],
    }),
  ],
});
