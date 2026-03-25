# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- X/Twitter scraper skill (#390)
- Git context controller skill (#380)
- Vercel Speed Insights integration with deployer agent updates
- Interview toolkit (6 components)
- Worktree-ghostty hook component
- Agirails agent payments skill (#358)
- Desktop notification hook on Stop event (#360)
- Garry's Mod addon code helper skill (#370)
- Manifest observability skill (#371)
- AI Maestro skill suite (6 skills for agent orchestration) (#373)
- Collections API endpoints with improved dashboard proxy
- Dashboard source code (app.aitmpl.com) — Astro + React + Tailwind
- Deploy scripts and CI/CD for dual Vercel projects (www + dashboard)
- Deployer agent for safe Vercel production deploys
- Beta dashboard banner on docs site
- FootballBin predictions MCP and skill (#369)
- Company-announcements settings component
- Spinner-tips-override settings component
- Design-to-code skill (#356)
- DevPlan MCP server (#362)
- 3 daily Discord bots (blog, general, community help) (#361)
- Telegram Bot Builder skill (#359)
- FastMCP 3.0 server development skill with 30 reference files
- 3 planning-first skills (FastAPI, Rust CLI, Playwright E2E)
- Daily component pick Discord notification workflow
- Monitoring points P1-P5 (installation outcomes, website events, API health)
- Neon database context statusline
- Component page redesign with GitHub PR-style tabs and Giscus comments (#351)
- GitHub Actions creator skill

### Changed
- Group My Components items by type in sidebar and right panel
- Docs link updated to docs.aitmpl.com
- Dashboard icons simplified and data loading streamlined
- GitHub Actions upgraded for Node 24 compatibility (#368)

### Fixed
- SEO: H1 tag, structured data, accessibility, and robots.txt sitemap URL (#383)
- Vercel Speed Insights script tag and localStorage quota handling
- Dangerous-command-blocker hook script path reference (#367)
- Trending page fetching data from production URL
- CORS headers for components.json and trending-data.json
- Dashboard prebuild hack removed, uses standard Astro public/ dir
- Forum channel thread_name for community help bot (#363)
- Daily component workflow rewritten using jq for JSON payload
- Neon statusline endpoint matching default branch
- Sidebar sticky position to clear header
- Security audit made non-blocking for deploys
- Missing js-yaml and qrcode dependencies added to package.json

### Security
- XSS vulnerabilities fixed in docs site and dashboard
- Hardcoded Vercel IDs removed from deploy scripts
- Security policy extended to prohibit all hardcoded IDs

## [1.28.16] - 2026-02-08

### Fixed
- Missing js-yaml dependency in package.json
- Missing qrcode dependency in package.json

### Changed
- npm publishing instructions updated with granular token workflow

## [1.28.14] - 2026-02-08

### Added
- Agent Teams Dashboard (`--teams`) for reviewing multi-agent collaboration sessions
- 119 agents migrated from VoltAgent/awesome-claude-code-subagents (#340)
- 21 skills migrated from OpenAI skills repository (#343)
- Telegram PR webhook hook for PR creation notifications (#342)
- Technical Debt Manager agent (#335)
- Blog article for Hackathon AI Strategist agent (#334)
- Blog article for Vercel Deployment Monitor statusline (#331)
- Cloudflare Workers: docs-monitor and pulse weekly KPI report
- 6 web quality skills migrated from addyosmani/web-quality-skills (#325)
- Friday deploy warning spinner
- ClaudeKit featured card on homepage (#320)
- Console.log cleaner for production branches (#310)
- Rootly Incident Responder agent (#315)
- 7 AI research skills migrated (#319)
- Claude Code PR tracking dashboard (#317)
- Neon Open Source Program partnership (#284)
- Security hooks secrets detection blog article (#311, #312)
- npm download metrics to pulse weekly report (#332)
- Secret scanner hook improvements with stdin JSON parsing and expanded patterns

### Changed
- Footer reorganized into columns with updated copyright year (#333)
- Vercel statusline updated with clickable deploy link
- Z.AI partnership removed from website and README (#339, #347)
- Blog standardization and .gitignore fixes (#341)

### Fixed
- X/Twitter preview images for Neon pages (#316)
- Social preview images and meta tags across all pages (#313)
- Neon install commands using comma-separated format
- Debug: removed 90 console.log statements from docs/js/

## [1.28.3] - 2025-11-15

### Added
- Skills Dashboard with progressive context loading visualization
- Plugin skills support in Skills Manager Dashboard
- Automatic port fallback for Skills Dashboard
- Growth Kit content marketing automation plugin (#129)
- ElevenLabs MCP (#125)
- GitHub Actions workflow for daily JSON data updates

### Changed
- `--skills` renamed to `--skills-manager` to avoid conflict with component installation
- Data processing limit increased from 200k to 1M records

### Fixed
- Windows Python command compatibility (#118)
- Generate scripts removed from gitignore for GitHub Actions

## [1.27.0] - 2025-11-02

### Added
- Docker Sandbox Provider for local Claude Code execution
- Command usage tracking system to Neon Database
- Comprehensive API testing and deployment documentation
- Claude Code changelog monitor with Discord notifications
- Session Analytics modal (Beta)

### Fixed
- Duplicate shutdown handlers and memory leaks in chats server
- gtag config moved to preset options for Docusaurus

## [1.26.0] - 2025-10-30

### Added
- Discord bot with Vercel Functions (`/search`, `/info`, `/install`, `/popular`)
- Clickable links in all Discord bot responses
- Command examples in download modal
- Context download feature (replacing session sharing)

### Changed
- Context file format updated to be Claude Code-friendly

### Fixed
- Resume command and project name in session sharing
- Category included in component URLs
- Code block formatting and URL improvements in search results
- Discord bot: ES module compatibility, dependency resolution
- GitHub Actions workflows optimized

## [1.25.0] - 2025-10-27

### Added
- Component browser website at aitmpl.com
- Download tracking via Supabase
- Component catalog generation (`docs/components.json`)
- Search, filtering, and batch installation in the CLI
- Blog system with terminal-themed articles

## Earlier Releases

For changes prior to v1.25.0, see the [commit history](https://github.com/davila7/claude-code-templates/commits/main).

[Unreleased]: https://github.com/davila7/claude-code-templates/compare/v1.28.16...HEAD
[1.28.16]: https://github.com/davila7/claude-code-templates/compare/v1.28.14...v1.28.16
[1.28.14]: https://github.com/davila7/claude-code-templates/compare/v1.28.3...v1.28.14
[1.28.3]: https://github.com/davila7/claude-code-templates/compare/v1.27.0...v1.28.3
[1.27.0]: https://github.com/davila7/claude-code-templates/compare/v1.26.0...v1.27.0
[1.26.0]: https://github.com/davila7/claude-code-templates/compare/v1.25.0...v1.26.0
[1.25.0]: https://github.com/davila7/claude-code-templates/releases/tag/v1.25.0
