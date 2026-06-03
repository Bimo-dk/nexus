import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  mainSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting started',
      collapsed: false,
      items: [
        'getting-started/why-nexus',
        'getting-started/overview',
        'getting-started/installation',
        'getting-started/architecture',
        'getting-started/ports',
      ],
    },
    {
      type: 'category',
      label: 'Services',
      collapsed: false,
      items: [
        'services/gateway',
        'services/registry',
        'services/portal',
        'services/host',
        'services/remotes',
        'services/proxy',
        'services/base-image',
      ],
    },
    {
      type: 'category',
      label: 'Workflows',
      collapsed: false,
      items: [
        'workflows/create-remote',
        'workflows/dev-mode',
        'workflows/zero-downtime',
        'workflows/deploy',
        'workflows/example-playground',
        'workflows/component-catalog',
        'workflows/loading-patterns',
      ],
    },
  ],

  packagesSidebar: [
    'packages/overview',
    'packages/nexus-core',
    'packages/nexus-client',
    'packages/nexus-build',
    'packages/nexus-runtime',
    'packages/nexus-ui',
    'packages/nexus-testing',
    'packages/nexus-cli',
  ],

  referenceSidebar: [
    'reference/environment',
    'reference/security',
    'reference/api',
    'reference/troubleshooting',
  ],
};

export default sidebars;
