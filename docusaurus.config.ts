import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// Used by the "Edit this page" links and the GitHub navbar/footer links.
// The workflow injects these from github.repository_owner and github.event.repository.name.
const GITHUB_ORG = process.env.GITHUB_ORG ?? 'your-org';
const GITHUB_REPO = process.env.GITHUB_REPO ?? 'nexus';

// Custom domain served by GitHub Pages.
// To deploy under a different domain, change CUSTOM_DOMAIN here AND update static/CNAME.
const CUSTOM_DOMAIN = 'nexus.bimo.dk';

const config: Config = {
  title: 'Nexus',
  tagline: 'Open-source Angular micro frontend platform — developed by Bimo',
  favicon: 'img/favicon.ico',

  url: `https://${CUSTOM_DOMAIN}`,
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

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: `https://github.com/${GITHUB_ORG}/${GITHUB_REPO}/edit/main/`,
        },
        blog: false,
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
      {
        name: 'description',
        content:
          'Nexus is an open-source Angular 19 micro frontend platform built on Native Federation — developed by Bimo. Includes gateway, host shell, registry, admin portal, dev proxy and a polished package ecosystem.',
      },
    ],
    announcementBar: {
      id: 'open-source',
      content:
        '⭐ Nexus is an open-source project developed by <strong>Bimo</strong>. Contributions welcome.',
      backgroundColor: '#6366f1',
      textColor: '#ffffff',
      isCloseable: true,
    },
    navbar: {
      title: 'Nexus',
      logo: {
        alt: 'Nexus',
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
          title: 'Docs',
          items: [
            { label: 'Overview', to: '/getting-started/overview' },
            { label: 'Installation', to: '/getting-started/installation' },
            { label: 'Architecture', to: '/getting-started/architecture' },
          ],
        },
        {
          title: 'Services',
          items: [
            { label: 'Gateway', to: '/services/gateway' },
            { label: 'Registry', to: '/services/registry' },
            { label: 'Portal', to: '/services/portal' },
            { label: 'Host', to: '/services/host' },
          ],
        },
        {
          title: 'Packages',
          items: [
            { label: 'nexus-core', to: '/packages/nexus-core' },
            { label: 'nexus-client', to: '/packages/nexus-client' },
            { label: 'nexus-cli (bnx)', to: '/packages/nexus-cli' },
          ],
        },
        {
          title: 'Project',
          items: [
            { label: 'GitHub', href: `https://github.com/${GITHUB_ORG}/${GITHUB_REPO}` },
            { label: 'License', href: `https://github.com/${GITHUB_ORG}/${GITHUB_REPO}/blob/main/LICENSE` },
          ],
        },
      ],
      copyright: `Nexus — open-source project developed by Bimo. © ${new Date().getFullYear()}. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'nginx', 'docker', 'yaml', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
