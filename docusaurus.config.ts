import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const GITHUB_ORG = process.env.GITHUB_ORG ?? 'Bimo-dk';
const GITHUB_REPO = process.env.GITHUB_REPO ?? 'nexus';
const CUSTOM_DOMAIN = 'nexus.bimo.dk';
const SITE_URL = `https://${CUSTOM_DOMAIN}`;

const DESCRIPTION =
  'Nexus is the open-source micro frontend platform for Angular, Vue, and React. ' +
  'Rust-powered registry and gateway, dynamic remote loading, multi-domain gates, ' +
  'built-in DDoS protection, live configuration, and zero-downtime deploys.';

const KEYWORDS = [
  'micro frontend',
  'micro frontend platform',
  'micro frontend framework',
  'Angular micro frontend',
  'Vue micro frontend',
  'React micro frontend',
  'multi-framework micro frontend',
  'module federation',
  'module federation alternative',
  'native federation',
  'micro frontend registry',
  'micro frontend gateway',
  'component federation Angular Vue React',
  'Rust web server',
  'high availability frontend',
  'zero downtime deployment',
  'frontend platform',
  'Bimo Nexus',
].join(', ');

const JSON_LD_SOFTWARE: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Nexus',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Any',
  description: DESCRIPTION,
  url: SITE_URL,
  author: { '@type': 'Organization', name: 'Bimo', url: 'https://bimo.dk' },
  license: `https://github.com/${GITHUB_ORG}/${GITHUB_REPO}/blob/main/LICENSE`,
  programmingLanguage: ['Rust', 'TypeScript'],
  runtimePlatform: ['Linux', 'Docker'],
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
  title: 'Nexus',
  tagline: 'The production micro frontend platform for Angular, Vue, and React.',
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

  markdown: {
    mermaid: true,
  },

  themes: [
    '@docusaurus/theme-mermaid',
    [
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        language: ['en'],
        indexDocs: true,
        indexBlog: false,
        indexPages: false,
        docsRouteBasePath: '/',
        highlightSearchTermsOnTargetPage: true,
        searchResultLimits: 12,
      },
    ],
  ],

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
      disableSwitch: false,
    },
    mermaid: {
      theme: { light: 'neutral', dark: 'dark' },
    },
    metadata: [
      { name: 'description', content: DESCRIPTION },
      { name: 'keywords', content: KEYWORDS },
      { name: 'author', content: 'Bimo' },
      {
        name: 'robots',
        content: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Nexus' },
      { property: 'og:title', content: 'Nexus — micro frontends for Angular, Vue, and React' },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:image', content: `${SITE_URL}/img/social-card.png` },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: 'Nexus — micro frontend platform for Angular, Vue, and React' },
      { property: 'og:url', content: SITE_URL },
      { property: 'og:locale', content: 'en_US' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Nexus — micro frontends for Angular, Vue, and React' },
      { name: 'twitter:description', content: DESCRIPTION },
      { name: 'twitter:image', content: `${SITE_URL}/img/social-card.png` },
      { name: 'twitter:image:alt', content: 'Nexus — micro frontend platform for Angular, Vue, and React' },
      { name: 'llms', content: `${SITE_URL}/llms.txt` },
    ],
    announcementBar: {
      id: 'open-source-v1',
      content:
        'Nexus 1.0 is here — Rust registry and gateway, Angular &middot; Vue &middot; React. <a href="https://github.com/Bimo-dk/nexus" target="_blank">Star on GitHub</a>.',
      backgroundColor: '#1f2937',
      textColor: '#e5e7eb',
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
          sidebarId: 'guidesSidebar',
          position: 'left',
          label: 'Guides',
        },
        {
          type: 'docSidebar',
          sidebarId: 'infraSidebar',
          position: 'left',
          label: 'Infrastructure',
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
          type: 'docSidebar',
          sidebarId: 'compareSidebar',
          position: 'left',
          label: 'Compare',
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
            { label: 'Ports and URLs', to: '/getting-started/ports-and-urls' },
          ],
        },
        {
          title: 'Quick starts',
          items: [
            { label: 'Angular', to: '/getting-started/quick-start-angular' },
            { label: 'Vue', to: '/getting-started/quick-start-vue' },
            { label: 'React', to: '/getting-started/quick-start-react' },
            { label: 'Mixed stack', to: '/guides/guide-mixed-stack' },
          ],
        },
        {
          title: 'Infrastructure',
          items: [
            { label: 'Registry', to: '/infrastructure/infra-registry' },
            { label: 'Gateway', to: '/infrastructure/infra-gateway' },
            { label: 'Portal', to: '/infrastructure/infra-portal' },
            { label: 'Hosts and gates', to: '/infrastructure/infra-hosts-and-gates' },
            { label: 'Protection', to: '/infrastructure/infra-protection' },
            { label: 'High availability', to: '/infrastructure/infra-high-availability' },
          ],
        },
        {
          title: 'Compare',
          items: [
            { label: 'vs Module Federation', to: '/compare/compare-module-federation' },
            { label: 'vs single-spa', to: '/compare/compare-single-spa' },
            { label: 'vs Bit', to: '/compare/compare-bit' },
            { label: 'vs Nx monorepo', to: '/compare/compare-nx-monorepo' },
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
            { label: 'llms.txt', href: 'pathname:///llms.txt' },
          ],
        },
      ],
      copyright: `Nexus — the open-source micro frontend platform for Angular, Vue, and React. Built by Bimo. © ${new Date().getFullYear()}`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: [
        'bash',
        'json',
        'jsx',
        'tsx',
        'nginx',
        'docker',
        'yaml',
        'toml',
        'rust',
        'typescript',
        'scss',
      ],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
