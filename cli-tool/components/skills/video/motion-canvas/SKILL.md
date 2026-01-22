---
name: motion-canvas
description: Comprehensive guide for Motion Canvas - programmatic video creation using TypeScript with generator functions, signals, and real-time preview editor
version: 1.0.0
author: motion-canvas
repo: https://github.com/motion-canvas/motion-canvas
license: MIT
tags: [Video, TypeScript, Animation, Motion Canvas, Signals, Generators, Canvas API, Vector, Audio Sync]
dependencies: [@motion-canvas/core>=3.0.0, @motion-canvas/2d>=3.0.0]
---

# Motion Canvas - Programmatic Video Creation with TypeScript

Comprehensive skill set for creating programmatic videos using Motion Canvas, a TypeScript library for creating animated videos using the Canvas API with generator functions and real-time preview.

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

## Core Concepts

Motion Canvas allows you to create videos using:
- **Generator Functions**: Describe animations using JavaScript generators with `yield*` syntax
- **Signals**: Reactive values that automatically update dependent properties
- **Real-time Preview**: Live editor with instant preview powered by Vite
- **TypeScript-First**: Write animations in TypeScript with full IDE support
- **Canvas API**: Leverage 2D Canvas for high-performance vector rendering
- **Audio Synchronization**: Sync animations precisely with voice-overs

## Key Features

- Generator-based animation flow control
- Signal-driven reactive animations
- Real-time preview with hot module reloading
- Frame-accurate timeline control
- Property-based animation system
- Voice-over synchronization tools
- Vector graphics and text rendering
- Extensible plugin architecture
- Web-based editor interface

## How to use

Read individual rule files for detailed explanations and code examples:

### Core Animation Concepts
- **[references/generators.md](references/generators.md)** - Generator functions for describing animations
- **[references/signals.md](references/signals.md)** - Reactive signals for dynamic properties and dependencies
- **[references/animations.md](references/animations.md)** - Tweening properties and creating smooth animations

For additional topics like scenes, shapes, text rendering, audio synchronization, and advanced features, refer to the comprehensive [Motion Canvas official documentation](https://motioncanvas.io/docs).

## Quick Start Example

```typescript
import {makeScene2D} from '@motioncanvas/2d/lib/scenes';
import {Circle} from '@motioncanvas/2d/lib/components';
import {createRef} from '@motioncanvas/core/lib/utils';

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
});
```

## Best Practices

1. **Use generator functions** - All scene animations should use `function*` and `yield*` syntax
2. **Leverage signals** - Create reactive dependencies between properties
3. **Think in durations** - Specify animation duration in seconds as the second parameter
4. **Use refs for control** - Create references to nodes for precise animation control
5. **Preview frequently** - Take advantage of the real-time editor for instant feedback
6. **Organize scenes** - Break complex animations into multiple scenes
7. **Type everything** - Use TypeScript for better IDE support and fewer errors

## Resources

- **Documentation**: https://motioncanvas.io/docs
- **Repository**: https://github.com/motion-canvas/motion-canvas
- **Examples**: https://motioncanvas.io/docs/quickstart
- **Community**: Discord and GitHub Discussions
- **License**: MIT
