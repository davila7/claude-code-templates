---
name: motion-canvas
description: Complete production-ready guide for Motion Canvas with ESM/CommonJS workarounds, full setup templates, and troubleshooting for programmatic video creation using TypeScript
version: 2.0.0
author: motion-canvas
repo: https://github.com/motion-canvas/motion-canvas
license: MIT
tags: [Video, TypeScript, Animation, Motion Canvas, Signals, Generators, Canvas API, Vector, Audio Sync, Vite, ESM]
dependencies: [@motion-canvas/core>=3.0.0, @motion-canvas/2d>=3.0.0, @motion-canvas/ui>=3.0.0, @motion-canvas/vite-plugin>=3.0.0]
---

# Motion Canvas - Production-Ready Video Creation with TypeScript

Complete production-ready skill for creating programmatic videos using Motion Canvas, including critical ESM/CommonJS workarounds, full configuration templates, and comprehensive troubleshooting.

## ⚠️ CRITICAL: ESM/CommonJS Interoperability Issue

**IMPORTANT**: The `@motion-canvas/vite-plugin` package is distributed as CommonJS, which causes import errors in modern ESM projects. The standard `import motionCanvas from '@motion-canvas/vite-plugin'` **WILL NOT WORK**.

You MUST use the `createRequire` workaround documented in the Setup section below.

## When to use

Use this skill whenever you are dealing with Motion Canvas code to obtain domain-specific knowledge about:

- Creating animated videos using TypeScript and generator functions
- Building animations with signals and reactive values
- Working with vector graphics and Canvas API
- Synchronizing animations with voice-overs and audio
- Using the real-time preview editor for instant feedback
- Implementing procedural animations with flow control
- Creating informative visualizations and diagrams
- Animating text, shapes, and custom components
- **Setting up Motion Canvas projects from scratch with correct configuration**
- **Troubleshooting common setup and build errors**

## Core Concepts

Motion Canvas allows you to create videos using:
- **Generator Functions**: Describe animations using JavaScript generators with `yield*` syntax
- **Signals**: Reactive values that automatically update dependent properties
- **Real-time Preview**: Live editor with instant preview powered by Vite
- **TypeScript-First**: Write animations in TypeScript with full IDE support
- **Canvas API**: Leverage 2D Canvas for high-performance vector rendering
- **Audio Synchronization**: Sync animations precisely with voice-overs

## Complete Setup Guide

### Step 1: Initialize Project

```bash
# Create project directory
mkdir my-motion-canvas-project
cd my-motion-canvas-project

# Initialize package.json
npm init -y
```

### Step 2: Configure package.json for ESM

**CRITICAL**: Add `"type": "module"` to enable ESM imports.

```json
{
  "name": "my-motion-canvas-project",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### Step 3: Install ALL Required Dependencies

**CRITICAL**: Must include `@motion-canvas/ui` - the plugin will fail without it.

```bash
npm install --save-dev @motion-canvas/core @motion-canvas/2d @motion-canvas/vite-plugin @motion-canvas/ui vite typescript
```

### Step 4: Create Project Structure

```
my-motion-canvas-project/
├── package.json          # "type": "module" required
├── vite.config.js        # Use .js NOT .ts (see Step 5)
├── tsconfig.json         # TypeScript configuration
├── index.html            # HTML entry point
└── src/
    ├── project.ts        # Project configuration with scenes
    └── scenes/
        └── example.tsx   # Animation scene
```

### Step 5: Create vite.config.js with ESM/CommonJS Workaround

**CRITICAL**: Use `vite.config.js` (NOT `.ts`) with the `createRequire` workaround.

**File: `vite.config.js`**
```javascript
import {defineConfig} from 'vite';
import {createRequire} from 'module';

// WORKAROUND: @motion-canvas/vite-plugin is CommonJS, must use require
const require = createRequire(import.meta.url);
const motionCanvasModule = require('@motion-canvas/vite-plugin');
const motionCanvas = motionCanvasModule.default || motionCanvasModule;

export default defineConfig({
  plugins: [
    motionCanvas({
      project: './src/project.ts',
    }),
  ],
});
```

**Why .js instead of .ts?**
- Vite config runs before TypeScript compilation
- The `createRequire` workaround works reliably in plain JavaScript
- Avoids additional type resolution complexity

### Step 6: Create tsconfig.json

**CRITICAL**: Include `esModuleInterop` and `allowSyntheticDefaultImports`.

**File: `tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "jsxImportSource": "@motion-canvas/2d/lib",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### Step 7: Create index.html

**File: `index.html`**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Motion Canvas Project</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/project.ts"></script>
</body>
</html>
```

### Step 8: Create src/project.ts

**File: `src/project.ts`**
```typescript
import {makeProject} from '@motion-canvas/core';
import example from './scenes/example?scene';

export default makeProject({
  scenes: [example],
});
```

### Step 9: Create First Animation Scene

**File: `src/scenes/example.tsx`**
```typescript
import {makeScene2D} from '@motion-canvas/2d/lib/scenes';
import {Circle} from '@motion-canvas/2d/lib/components';
import {createRef} from '@motion-canvas/core/lib/utils';
import {all} from '@motion-canvas/core/lib/flow';

export default makeScene2D(function* (view) {
  const circleRef = createRef<Circle>();

  view.add(
    <Circle
      ref={circleRef}
      size={70}
      fill="#e13238"
    />,
  );

  // Animate circle size and position
  yield* circleRef().size(140, 1);
  yield* circleRef().position.x(300, 1);
  yield* circleRef().fill('#e6a700', 1);

  // Parallel animations
  yield* all(
    circleRef().scale(1.5, 0.5),
    circleRef().rotation(360, 1)
  );
});
```

### Step 10: Run Development Server

```bash
npm run dev
```

Open browser at `http://localhost:5173` to see the Motion Canvas editor.

## Troubleshooting

### Error: `TypeError: motionCanvas is not a function`

**Cause**: ESM/CommonJS interoperability issue with `@motion-canvas/vite-plugin`

**Solution**: Use the `createRequire` workaround in `vite.config.js` (see Step 5)

```javascript
// ❌ WRONG - Will not work
import motionCanvas from '@motion-canvas/vite-plugin';

// ✅ CORRECT - Use createRequire
import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const motionCanvasModule = require('@motion-canvas/vite-plugin');
const motionCanvas = motionCanvasModule.default || motionCanvasModule;
```

### Error: `Cannot find module '@motion-canvas/ui'`

**Cause**: Missing required dependency

**Solution**: Install the UI package:
```bash
npm install --save-dev @motion-canvas/ui
```

### Error: `Property 'default' does not exist on type ...`

**Cause**: TypeScript configuration missing ESM interop settings

**Solution**: Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  }
}
```

### Warning: `The CJS build of Vite's Node API is deprecated`

**Status**: This is a known warning and can be safely ignored. It appears because `@motion-canvas/vite-plugin` is CommonJS. The workaround ensures functionality despite the warning.

### Error: `Failed to resolve import "*.tsx?scene"`

**Cause**: Vite plugin not properly loaded or configured

**Solution**:
1. Verify `vite.config.js` has the correct workaround
2. Check `project` path points to correct file: `'./src/project.ts'`
3. Ensure scene imports use `?scene` suffix: `import example from './scenes/example?scene';`

### Build fails with TypeScript errors

**Solution**:
1. Verify `tsconfig.json` includes all required options (see Step 6)
2. Check `jsxImportSource` is set to `@motion-canvas/2d/lib`
3. Ensure all dependencies are installed

## How to use

Read individual rule files for detailed explanations and code examples:

### Core Animation Concepts
- **[references/generators.md](references/generators.md)** - Generator functions for describing animations
- **[references/signals.md](references/signals.md)** - Reactive signals for dynamic properties and dependencies
- **[references/animations.md](references/animations.md)** - Tweening properties and creating smooth animations

For additional topics like scenes, shapes, text rendering, audio synchronization, and advanced features, refer to the comprehensive [Motion Canvas official documentation](https://motioncanvas.io/docs).

## Complete Working Example

This is a complete, tested project structure that works out of the box:

```
my-motion-canvas-project/
├── package.json
│   {
│     "name": "my-motion-canvas-project",
│     "type": "module",
│     "scripts": {
│       "dev": "vite",
│       "build": "vite build"
│     },
│     "devDependencies": {
│       "@motion-canvas/core": "^3.0.0",
│       "@motion-canvas/2d": "^3.0.0",
│       "@motion-canvas/vite-plugin": "^3.0.0",
│       "@motion-canvas/ui": "^3.0.0",
│       "vite": "^5.0.0",
│       "typescript": "^5.0.0"
│     }
│   }
│
├── vite.config.js (with createRequire workaround)
├── tsconfig.json (with esModuleInterop)
├── index.html
└── src/
    ├── project.ts (makeProject with scenes array)
    └── scenes/
        └── example.tsx (makeScene2D with animations)
```

## Best Practices

1. **Always use the createRequire workaround** - Don't try standard ESM imports for the Vite plugin
2. **Use vite.config.js not .ts** - Avoids additional compilation complexity
3. **Include all dependencies** - Don't forget `@motion-canvas/ui`
4. **Use generator functions** - All scene animations should use `function*` and `yield*` syntax
5. **Leverage signals** - Create reactive dependencies between properties
6. **Think in durations** - Specify animation duration in seconds as the second parameter
7. **Use refs for control** - Create references to nodes for precise animation control
8. **Preview frequently** - Take advantage of the real-time editor for instant feedback
9. **Organize scenes** - Break complex animations into multiple scenes
10. **Type everything** - Use TypeScript for better IDE support and fewer errors

## Common Pitfalls to Avoid

1. ❌ Forgetting `"type": "module"` in package.json
2. ❌ Using standard import for `@motion-canvas/vite-plugin`
3. ❌ Not installing `@motion-canvas/ui`
4. ❌ Missing `esModuleInterop` in tsconfig.json
5. ❌ Using `vite.config.ts` instead of `vite.config.js`
6. ❌ Forgetting `?scene` suffix in scene imports

## Resources

- **Documentation**: https://motioncanvas.io/docs
- **Repository**: https://github.com/motion-canvas/motion-canvas
- **Examples**: https://motioncanvas.io/docs/quickstart
- **Community**: Discord and GitHub Discussions
- **License**: MIT
