import { fileURLToPath } from 'node:url';

import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

import { baseLinks } from './src/plugins/base-links.mjs';

const repositoryUrl = 'https://github.com/drslid/nidomark';
const site = 'https://drslid.github.io';
const base = '/nidomark';
const repo = (dir) => fileURLToPath(new URL(`../${dir}`, import.meta.url));

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  markdown: {
    rehypePlugins: [baseLinks(base)],
  },
  vite: {
    resolve: {
      alias: {
        // One source for the screenshots, the font, the icons and the categories: the extension's own files.
        '@repo-docs': repo('docs'),
        '@fonts': repo('public/fonts'),
        '@lib': repo('lib'),
      },
    },
    server: { fs: { allow: ['..'] } },
  },
  integrations: [
    sitemap(),
    starlight({
      title: 'Nidomark',
      description: 'Recreate all your browser bookmarks in a few clear folders, your most visited sites first, with a small AI that runs in your browser.',
      logo: {
        src: './src/assets/brand-mark.svg',
        alt: '',
      },
      favicon: '/favicon.svg',
      social: [
        {
          icon: 'github',
          label: 'Nidomark on GitHub',
          href: repositoryUrl,
        },
      ],
      editLink: {
        baseUrl: `${repositoryUrl}/edit/main/website/`,
      },
      customCss: ['./src/styles/custom.css'],
      lastUpdated: true,
      locales: {
        root: {
          label: 'English',
          lang: 'en',
        },
      },
      head: [
        { tag: 'meta', attrs: { name: 'theme-color', content: '#eff5f3', media: '(prefers-color-scheme: light)' } },
        { tag: 'meta', attrs: { name: 'theme-color', content: '#161d1c', media: '(prefers-color-scheme: dark)' } },
        { tag: 'meta', attrs: { property: 'og:image', content: `${site}${base}/images/social-card.png` } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
      ],
      sidebar: [
        {
          label: 'Getting started',
          items: [
            { label: 'Overview', slug: 'getting-started/overview' },
            { label: 'Install', slug: 'getting-started/install' },
            { label: 'Your first sort', slug: 'getting-started/first-sort' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Review the new tree', slug: 'guides/review' },
            { label: 'Quick access and names', slug: 'guides/names-and-bar' },
            { label: 'Sites, dead links, duplicates', slug: 'guides/sites-and-duplicates' },
            { label: 'Backup and undo', slug: 'guides/backup-and-undo' },
            { label: 'Settings', slug: 'guides/settings' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'How sorting works', slug: 'reference/how-it-works' },
            { label: 'Categories', slug: 'reference/categories' },
            { label: 'Privacy and permissions', slug: 'reference/privacy' },
            { label: 'Requirements and performance', slug: 'reference/performance' },
          ],
        },
        {
          label: 'Project',
          items: [
            { label: 'Status and roadmap', slug: 'project/status' },
            { label: 'Build from source', slug: 'project/development' },
          ],
        },
      ],
    }),
  ],
});
