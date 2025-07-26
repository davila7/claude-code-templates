import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Claude Code Templates',
  tagline: 'Documentation for Claude Code Templates',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://davila7.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/claude-code-templates/docu/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'davila7', // Usually your GitHub org/user name.
  projectName: 'claude-code-templates', // Usually your repo name.

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/davila7/claude-code-templates/tree/main/docu/',
        },
        blog: false, // Disable blog functionality
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Social card for sharing
    image: 'img/logo.svg',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'Claude Code Templates',
      logo: {
        alt: 'Claude Code Templates Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://davila7.github.io/claude-code-templates/',
          label: 'Browse Templates',
          position: 'left',
        },
        {
          href: 'https://github.com/davila7/claude-code-templates',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/intro',
            },
            {
              label: 'CLI Usage',
              to: '/docs/cli-usage',
            },
            {
              label: 'Available Templates',
              to: '/docs/available-templates',
            },
          ],
        },
        {
          title: 'Resources',
          items: [
            {
              label: 'Browse Templates',
              href: 'https://davila7.github.io/claude-code-templates/',
            },
            {
              label: 'GitHub Repository',
              href: 'https://github.com/davila7/claude-code-templates',
            },
            {
              label: 'Issues & Support',
              href: 'https://github.com/davila7/claude-code-templates/issues',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Contribute',
              href: 'https://github.com/davila7/claude-code-templates/blob/main/CONTRIBUTING.md',
            },
            {
              label: 'License',
              href: 'https://github.com/davila7/claude-code-templates/blob/main/LICENSE',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Claude Code Templates. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
