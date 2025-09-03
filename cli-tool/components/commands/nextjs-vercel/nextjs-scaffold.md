---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [project-name] [--typescript] [--tailwind] [--app-router]
description: Create a new Next.js application with best practices and optimal configuration
model: sonnet
---

## Next.js Application Scaffolding

**Project Name**: $ARGUMENTS

## Environment Analysis

- Current directory: !`pwd`
- Node.js version: !`node --version`
- npm version: !`npm --version`
- Existing package.json: @package.json (if exists)

## Scaffolding Requirements

### 1. Project Initialization
Based on provided arguments, determine setup options:
- **TypeScript**: Check for `--typescript` flag or detect existing TS config
- **Tailwind CSS**: Check for `--tailwind` flag or detect existing config
- **App Router**: Check for `--app-router` flag (default for new projects)
- **ESLint/Prettier**: Always include for code quality

### 2. Next.js Configuration
Create optimized `next.config.js` with:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@heroicons/react'],
  },
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
};
```

### 3. Essential Dependencies
Install core dependencies:
- **Production**: `next`, `react`, `react-dom`
- **Development**: `eslint`, `eslint-config-next`, `typescript` (if TS), `@types/*` (if TS)
- **Optional**: `tailwindcss`, `prettier`, `husky`, `lint-staged`

### 4. Project Structure
Create optimal directory structure:
```
project-name/
├── app/                    # App Router (Next.js 13+)
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   └── api/
├── components/             # Reusable components
│   └── ui/                # UI primitives
├── lib/                   # Utilities and configurations
├── public/                # Static assets
├── types/                 # TypeScript type definitions
├── .env.local             # Environment variables
├── .env.example           # Environment template
├── .gitignore
├── next.config.js
├── package.json
├── README.md
└── tsconfig.json          # If TypeScript
```

### 5. Configuration Files

#### ESLint Configuration
```json
{
  "extends": ["next/core-web-vitals"],
  "rules": {
    "@next/next/no-img-element": "error",
    "@next/next/no-html-link-for-pages": "error"
  }
}
```

#### TypeScript Configuration (if applicable)
```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 6. Starter Components

#### Root Layout
```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Project Name',
  description: 'Generated with Claude Code Next.js scaffolding',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

#### Home Page
```typescript
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold">Welcome to Your Next.js App</h1>
        <p className="mt-4 text-lg">
          Built with Claude Code scaffolding
        </p>
      </div>
    </main>
  );
}
```

### 7. Development Scripts
Update package.json with optimized scripts:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

### 8. Documentation
Create comprehensive README.md with:
- Project overview and features
- Installation and setup instructions
- Development workflow
- Deployment guidelines
- Contributing guidelines

## Implementation Steps

1. **Initialize Project**: Create project directory and basic structure
2. **Install Dependencies**: Set up Next.js with chosen options
3. **Configure TypeScript**: Set up TypeScript if requested
4. **Setup Tailwind**: Configure Tailwind CSS if requested
5. **Create Components**: Generate starter components and layouts
6. **Setup Development Tools**: Configure ESLint, Prettier, and scripts
7. **Environment Configuration**: Create .env files and examples
8. **Generate Documentation**: Create README and setup guides

## Quality Checklist

- [ ] Next.js configured with App Router
- [ ] TypeScript setup (if requested)
- [ ] Tailwind CSS configured (if requested)
- [ ] ESLint and Prettier configured
- [ ] Security headers configured
- [ ] Image optimization enabled
- [ ] Development scripts working
- [ ] Environment variables template created
- [ ] README documentation complete
- [ ] Project builds successfully

## Post-Scaffolding Tasks

After scaffolding, run these commands to verify setup:
```bash
cd [project-name]
npm install
npm run build
npm run lint
npm run type-check  # If TypeScript
```

Provide specific next steps based on the project requirements and any additional features needed.