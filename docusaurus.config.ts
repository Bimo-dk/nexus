import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const GITHUB_ORG = process.env.GITHUB_ORG ?? 'Bimo-dk';
const GITHUB_REPO = process.env.GITHUB_REPO ?? 'nexus';
const CUSTOM_DOMAIN = 'nexus.bimo.dk';
const SITE_URL = `https://${CUSTOM_DOMAIN}`;

const DESCRIPTION =
  'Nexus is an open-source Angular 19 micro frontend platform built on Native Federation. ' +
  'Zero-config federation, live remote registration over WebSocket, one-command local dev, ' +
  'cross-team component catalog, zero-downtime deploys — all out of the box.';

const KEYWORDS = [
  'Angular micro frontend',
  'Angular Native Federation',
  'micro frontend platform',
  'Angular 19 micro frontend',
  'module federation Angular',
  'micro frontend registry',
  'micro frontend architecture',
  'Angular federation',
  'micro frontend docker',
  'bnx cli',
  'Native Federation',
  'Angular micro frontend framework',
  'open source Angular',
  'Bimo Nexus',
].join(', ');

const JSON_LD_SOFTWARE: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Nexus',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Linux, macOS, Windows',
  description: DESCRIPTION,
  url: SITE_URL,
  author: { '@type': 'Organization', name: 'Bimo', url: 'https://bimo.dk' },
  license: `https://github.com/${GITHUB_ORG}/${GITHUB_REPO}/blob/main/LICENSE`,
  programmingLanguage: 'TypeScript',
  runtimePlatform: 'Node.js, Docker',
  keywords: KEYWORDS,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  sameAs: [`https://github.com/${GITHUB_ORG}/${GITHUB_REPO}`],
  releaseNotes: `https://github.com/${GITHUB_ORG}/${GITHUB_REPO}/releases`,
  isAccessibleForFree: true,
  isFamilyFriendly: true,
};

const JSON_LD_ORGANIZATION: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Bimo',
  url: 'https://bimo.dk',
  logo: `${SITE_URL}/img/logo.svg`,
  sameAs: [`https://github.com/${GITHUB_ORG}`],
};

const JSON_LD_WEBSITE: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Nexus Documentation',
  url: SITE_URL,
  description: DESCRIPTION,
  publisher: { '@type': 'Organization', name: 'Bimo' },
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
};

const config: Config = {
  title: 'Nexus — Angular Micro Frontend Platform',
  tagline: 'Zero-config federation. Live remote registration. One-command local dev.',
  favicon: 'img/favicon.ico',

  url: SITE_URL,
  baseUrl: '/',

  organizationName: GITHUB_ORG,
  projectName: GITHUB_REPO,
  trailingSlash: false,

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  headTags: [
    {
      tagName: 'script',
      attributes: { type: 'application/ld+json' },
      innerHTML: JSON.stringify(JSON_LD_SOFTWARE),
    },
    {
      tagName: 'script',
      attributes: { type: 'application/ld+json' },
      innerHTML: JSON.stringify(JSON_LD_ORGANIZATION),
    },
    {
      tagName: 'script',
      attributes: { type: 'application/ld+json' },
      innerHTML: JSON.stringify(JSON_LD_WEBSITE),
    },
    {
      tagName: 'link',
      attributes: { rel: 'preconnect', href: 'https://github.com' },
    },
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: `https://github.com/${GITHUB_ORG}/${GITHUB_REPO}/edit/main/`,
          showLastUpdateTime: true,
          showLastUpdateAuthor: false,
        },
        blog: false,
        sitemap: {
          changefreq: 'weekly',
          priority: 0.8,
          ignorePatterns: ['/tags/**'],
          filename: 'sitemap.xml',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.png',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    metadata: [
      // Core description
      { name: 'description', content: DESCRIPTION },
      { name: 'keywords', content: KEYWORDS },
      { name: 'author', content: 'Bimo' },
      { name: 'robots', content: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' },
      // Open Graph
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Nexus' },
      { property: 'og:title', content: 'Nexus — Angular Micro Frontend Platform' },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:image', content: `${SITE_URL}/img/social-card.png` },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: 'Nexus — Angular Micro Frontend Platform' },
      { property: 'og:url', content: SITE_URL },
      { property: 'og:locale', content: 'en_US' },
      // Twitter / X
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Nexus — Angular Micro Frontend Platform' },
      { name: 'twitter:description', content: DESCRIPTION },
      { name: 'twitter:image', content: `${SITE_URL}/img/social-card.png` },
      { name: 'twitter:image:alt', content: 'Nexus — Angular Micro Frontend Platform' },
      // AI crawlers / LLM indexing
      { name: 'llms', content: `${SITE_URL}/llms.txt` },
    ],
    announcementBar: {
      id: 'open-source',
      content:
        'Nexus is an open-source project developed by <strong>Bimo</strong>. Contributions welcome — <a href="https://github.com/Bimo-dk/nexus" target="_blank">star us on GitHub</a>.',
      backgroundColor: '#6366f1',
      textColor: '#ffffff',
      isCloseable: true,
    },
    navbar: {
      title: 'Nexus',
      logo: {
        alt: 'Nexus micro frontend platform logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'mainSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          type: 'docSidebar',
          sidebarId: 'packagesSidebar',
          position: 'left',
          label: 'Packages',
        },
        {
          type: 'docSidebar',
          sidebarId: 'referenceSidebar',
          position: 'left',
          label: 'Reference',
        },
        {
          href: `https://github.com/${GITHUB_ORG}/${GITHUB_REPO}`,
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Getting started',
          items: [
            { label: 'Why Nexus', to: '/getting-started/why-nexus' },
            { label: 'Overview', to: '/getting-started/overview' },
            { label: 'Installation', to: '/getting-started/installation' },
            { label: 'Architecture', to: '/getting-started/architecture' },
          ],
        },
        {
          title: 'Guides',
          items: [
            { label: 'Create a remote', to: '/workflows/create-remote' },
            { label: 'Loading patterns', to: '/workflows/loading-patterns' },
            { label: 'Component catalog', to: '/workflows/component-catalog' },
            { label: 'Local dev (hot reload)', to: '/workflows/dev-mode' },
          ],
        },
        {
          title: 'Packages',
          items: [
            { label: '@bimo-dk/nexus-runtime', to: '/packages/nexus-runtime' },
            { label: '@bimo-dk/nexus-build', to: '/packages/nexus-build' },
            { label: '@bimo-dk/nexus-cli (bnx)', to: '/packages/nexus-cli' },
            { label: 'All packages', to: '/packages/overview' },
          ],
        },
        {
          title: 'Project',
          items: [
            { label: 'GitHub', href: `https://github.com/${GITHUB_ORG}/${GITHUB_REPO}` },
            {
              label: 'npm packages',
              href: `https://github.com/orgs/${GITHUB_ORG}/packages`,
            },
            {
              label: 'License (MIT)',
              href: `https://github.com/${GITHUB_ORG}/${GITHUB_REPO}/blob/main/LICENSE`,
            },
            { label: 'llms.txt', to: '/llms.txt' },
          ],
        },
      ],
      copyright: `Nexus — open-source Angular micro frontend platform developed by Bimo. © ${new Date().getFullYear()}`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'nginx', 'docker', 'yaml', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
