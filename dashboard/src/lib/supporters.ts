// Programs that support the project. Shown on /supporters and (footerLabel) in the site footer.
// Only list programs the project has actually joined.
export interface SupportProgram {
  org: string;
  program: string;
  kind: string;
  description: string;
  url: string;
  linkLabel: string;
  /** Logo URL. Omit when the brand's rules don't allow a recolored or unofficial mark. */
  icon?: string;
  /** Icon is a single-color mark that should invert with the theme. */
  monochrome?: boolean;
  /** Short name shown in the site footer; omit to keep the program off the footer. */
  footerLabel?: string;
}

export const SUPPORT_PROGRAMS: SupportProgram[] = [
  {
    org: 'NVIDIA',
    program: 'NVIDIA Inception',
    kind: 'Startup program',
    description: "NVIDIA's program for companies building with AI. Claude Code Templates was accepted in November 2026.",
    url: 'https://www.nvidia.com/en-us/startups/',
    linkLabel: 'nvidia.com/startups',
    footerLabel: 'NVIDIA Inception',
  },
  {
    org: 'Anthropic',
    program: 'Claude for Open Source',
    kind: 'Open source program',
    description: 'Claude access for maintainers of open source projects, used to build and maintain the catalog.',
    url: 'https://claude.com/contact-sales/claude-for-oss',
    linkLabel: 'claude.com',
    icon: 'https://cdn.simpleicons.org/anthropic/ffffff',
    monochrome: true,
    footerLabel: 'Claude',
  },
  {
    org: 'Anthropic',
    program: 'Anthropic OSS Scanner',
    kind: 'Security',
    description: "Anthropic's free scanner for open source projects. It scans this repository and reports findings privately so they can be fixed before disclosure.",
    url: 'https://red.anthropic.com/oss-scanner',
    linkLabel: 'red.anthropic.com',
    icon: 'https://cdn.simpleicons.org/anthropic/ffffff',
    monochrome: true,
  },
  {
    org: 'Vercel',
    program: 'Vercel Open Source Program',
    kind: 'Open source program',
    description: 'Hosting credits and support for open source projects.',
    url: 'https://vercel.com/open-source-program',
    linkLabel: 'vercel.com',
    icon: 'https://cdn.simpleicons.org/vercel/ffffff',
    monochrome: true,
    footerLabel: 'Vercel',
  },
  {
    org: 'Neon',
    program: 'Neon Open Source Program',
    kind: 'Open source program',
    description: 'Serverless Postgres for open source projects. Neon stores the release monitoring and collections data behind aitmpl.com.',
    url: 'https://neon.tech/open-source',
    linkLabel: 'neon.tech',
    icon: 'https://neon.tech/favicon/favicon.svg',
    footerLabel: 'Neon',
  },
];
