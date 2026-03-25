import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Discover Components',
      items: [
        'components/overview',
        'components/agents',
        'components/commands',
        'components/settings',
        'components/hooks',
        'components/mcps',
        'components/templates',
      ],
    },
    {
      type: 'category',
      label: 'Additional Tools',
      items: [
        'tools/overview',
        'tools/analytics',
        'tools/health-check',
        'tools/chats',
        'tools/tunnel',
        'tools/sandbox',
      ],
    },
    'cli-options',
    'safety-features',
    'support',
  ],
};

export default sidebars;
