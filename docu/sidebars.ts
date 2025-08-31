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
      label: 'Project Setup & Configuration',
      items: [
        'project-setup/interactive-setup',
        'project-setup/framework-specific-setup',
        'project-setup/what-gets-installed',
        'project-setup/supported-languages-frameworks',
        'project-setup/automation-hooks',
        'project-setup/mcp-integration',
      ],
    },
    {
      type: 'category',
      label: 'Individual Components',
      items: [
        'components/overview',
        'components/agents',
        'components/commands',
        'components/mcps',
        'components/settings',
        'components/hooks',
        {
          type: 'category',
          label: 'Notifications',
          items: [
            'components/telegram-notifications',
            'components/slack-notifications',
            'components/discord-notifications',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Analytics Dashboard',
      items: [
        'analytics/overview',
        'analytics/real-time-monitoring',
        'analytics/agent-chats-manager',
        'analytics/analysis-tools',
      ],
    },
    {
      type: 'category',
      label: 'Health Check',
      items: [
        'health-check/overview',
      ],
    },
    {
      type: 'category',
      label: 'Usage Examples',
      items: [
        'usage-examples/interactive-setup',
        'usage-examples/framework-specific-quick-setup',
        'usage-examples/advanced-options',
        'usage-examples/alternative-commands',
      ],
    },
    'cli-options',
    'safety-features',
    'contributing',
    'support',
  ],
};

export default sidebars;
