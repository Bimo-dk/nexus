import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Bimo-Nexus',
  tagline: 'Angular 19 micro frontend platform built on Native Federation',
  favicon: 'img/favicon.ico',

  url: 'https://bimo-dk.github.io',
  baseUrl: '/nexus/',

  // GitHub Pages deployment
  organizationName: 'Bimo-dk',
  projectName: 'nexus',
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
          editUrl: 'https://github.com/Bimo-dk/nexus/edit/main/',
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
    navbar: {
      title: 'Bimo-Nexus',
      logo: {
        alt: 'Bimo-Nexus',
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
          href: 'https://github.com/Bimo-dk',
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
            { label: '@bimo-dk/nexus-core', to: '/packages/nexus-core' },
            { label: '@bimo-dk/nexus-client', to: '/packages/nexus-client' },
            { label: '@bimo-dk/nexus-cli (bnx)', to: '/packages/nexus-cli' },
          ],
        },
        {
          title: 'More',
          items: [
            { label: 'GitHub Bimo-dk', href: 'https://github.com/Bimo-dk' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Bimo. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'nginx', 'docker', 'yaml', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
