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
        'getting-started/productivity',
        'getting-started/overview',
        'getting-started/installation',
        'getting-started/architecture',
        'getting-started/ports-and-urls',
        'getting-started/quick-start-angular',
        'getting-started/quick-start-vue',
        'getting-started/quick-start-react',
      ],
    },
    {
      type: 'category',
      label: 'Services',
      collapsed: true,
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
      collapsed: true,
      items: [
        'workflows/create-remote-angular',
        'workflows/create-remote-vue',
        'workflows/create-remote-react',
        'workflows/dev-mode',
        'workflows/zero-downtime',
        'workflows/deployment',
        'workflows/multi-domain-setup',
        'workflows/hosts-and-gates-setup',
        'workflows/gate-host-swap',
        'workflows/rollback',
        'workflows/protection-setup',
        'workflows/component-catalog',
        'workflows/loading-patterns',
      ],
    },
    'about',
    'commercial-license',
  ],

  guidesSidebar: [
    {
      type: 'category',
      label: 'Framework guides',
      collapsed: false,
      items: [
        'guides/guide-mixed-stack',
        'guides/guide-angular-remote',
        'guides/guide-vue-remote',
        'guides/guide-react-remote',
        'guides/guide-angular-host',
        'guides/guide-vue-host',
        'guides/guide-react-host',
      ],
    },
  ],

  infraSidebar: [
    {
      type: 'category',
      label: 'Infrastructure',
      collapsed: false,
      items: [
        'infrastructure/infra-registry',
        'infrastructure/infra-gateway',
        'infrastructure/infra-portal',
        'infrastructure/infra-hosts-and-gates',
        'infrastructure/infra-protection',
        'infrastructure/infra-high-availability',
        'infrastructure/infra-prometheus-metrics',
      ],
    },
  ],

  packagesSidebar: [
    'packages/overview',
    'packages/nexus-core',
    'packages/nexus-client',
    'packages/nexus-runtime-core',
    'packages/nexus-runtime',
    'packages/nexus-runtime-vue',
    'packages/nexus-runtime-react',
    'packages/nexus-build',
    'packages/nexus-cli',
    'packages/nexus-testing',
    'packages/nexus-ui',
  ],

  referenceSidebar: [
    'reference/environment',
    'reference/configuration',
    'reference/api-reference',
    'reference/websocket-messages',
    'reference/security',
    'reference/troubleshooting',
  ],

  compareSidebar: [
    'compare/compare-module-federation',
    'compare/compare-single-spa',
    'compare/compare-bit',
    'compare/compare-nx-monorepo',
  ],

  internalsSidebar: [
    {
      type: 'category',
      label: 'nexus-gateway',
      collapsed: false,
      items: [
        'internals/nexus-gateway/architecture',
        'internals/nexus-gateway/code-map',
      ],
    },
    {
      type: 'category',
      label: 'nexus-registry',
      collapsed: false,
      items: [
        'internals/nexus-registry/architecture',
        'internals/nexus-registry/code-map',
      ],
    },
  ],
};

export default sidebars;
