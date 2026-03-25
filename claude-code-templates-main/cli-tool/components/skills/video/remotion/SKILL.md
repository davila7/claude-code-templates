---
name: remotion
description: Best practices and comprehensive guide for Remotion - programmatic video creation in React with animations, compositions, and media handling
version: 1.0.0
author: remotion-dev
repo: https://github.com/remotion-dev/skills
license: MIT
tags: [Video, React, Animation, Remotion, Composition, Media, 3D, Audio, Captions, Charts, Lottie, Tailwind]
dependencies: [remotion>=4.0.0, react>=18.0.0]
---

# Remotion - Video Creation in React

Comprehensive skill set for creating programmatic videos using Remotion, a framework for creating videos programmatically using React.

## When to use

Use this skill whenever you are dealing with Remotion code to obtain domain-specific knowledge about:

- Creating video compositions with React components
- Animating elements using frame-based animations
- Working with audio, video, and image assets
- Building charts and data visualizations
- Implementing text animations and captions
- Using 3D content with Three.js
- Applying transitions and sequencing
- Integrating Tailwind CSS and Lottie animations

## Core Concepts

Remotion allows you to create videos using:
- **React Components**: Build video content with familiar React syntax
- **Frame-based Animations**: All animations driven by `useCurrentFrame()` hook
- **Compositions**: Define video compositions with duration, dimensions, and props
- **Assets**: Import and manipulate images, videos, audio, and fonts
- **Rendering**: Export videos programmatically with customizable settings

## Key Features

- Frame-by-frame control over animations
- Dynamic metadata calculation
- Media processing (trimming, volume, speed, pitch)
- Caption generation and display
- Data visualization with charts
- 3D content integration
- Professional text animations
- Scene transitions and sequencing

## How to use

Read individual rule files for detailed explanations and code examples:

### Core Animation & Timing
- **[references/animations.md](references/animations.md)** - Fundamental animation techniques for Remotion
- **[references/timing.md](references/timing.md)** - Interpolation curves: linear, easing, spring animations
- **[references/sequencing.md](references/sequencing.md)** - Delay, trim, and limit duration of items
- **[references/trimming.md](references/trimming.md)** - Cut the beginning or end of animations

### Compositions & Metadata
- **[references/compositions.md](references/compositions.md)** - Defining compositions, stills, folders, default props
- **[references/calculate-metadata.md](references/calculate-metadata.md)** - Dynamically set composition duration, dimensions, and props

### Assets & Media
- **[references/assets.md](references/assets.md)** - Importing images, videos, audio, and fonts
- **[references/images.md](references/images.md)** - Embedding images using the Img component
- **[references/videos.md](references/videos.md)** - Embedding videos with trimming, volume, speed, looping, pitch
- **[references/audio.md](references/audio.md)** - Using audio and sound with trimming, volume, speed, pitch
- **[references/gifs.md](references/gifs.md)** - Displaying GIFs synchronized with timeline

### Text & Typography
- **[references/text-animations.md](references/text-animations.md)** - Typography and text animation patterns
- **[references/measuring-text.md](references/measuring-text.md)** - Measuring text dimensions, fitting text, checking overflow
- **[references/fonts.md](references/fonts.md)** - Loading Google Fonts and local fonts

### Captions & Transcription
- **[references/display-captions.md](references/display-captions.md)** - Displaying captions with TikTok-style pages and word highlighting
- **[references/import-srt-captions.md](references/import-srt-captions.md)** - Importing .srt subtitle files using @remotion/captions
- **[references/transcribe-captions.md](references/transcribe-captions.md)** - Transcribing audio to generate captions

### Data Visualization
- **[references/charts.md](references/charts.md)** - Chart and data visualization patterns

### Advanced Features
- **[references/3d.md](references/3d.md)** - 3D content using Three.js and React Three Fiber
- **[references/lottie.md](references/lottie.md)** - Embedding Lottie animations
- **[references/transitions.md](references/transitions.md)** - Scene transition patterns

### Styling & Layout
- **[references/tailwind.md](references/tailwind.md)** - Using TailwindCSS in Remotion
- **[references/measuring-dom-nodes.md](references/measuring-dom-nodes.md)** - Measuring DOM element dimensions

### Media Processing (Mediabunny)
- **[references/can-decode.md](references/can-decode.md)** - Check if a video can be decoded by the browser
- **[references/extract-frames.md](references/extract-frames.md)** - Extract frames from videos at specific timestamps
- **[references/get-audio-duration.md](references/get-audio-duration.md)** - Getting the duration of an audio file
- **[references/get-video-dimensions.md](references/get-video-dimensions.md)** - Getting the width and height of a video file
- **[references/get-video-duration.md](references/get-video-duration.md)** - Getting the duration of a video file

## Quick Start Example

```tsx
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export const MyComposition = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 2 * fps], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ opacity }}>
      <h1>Hello Remotion!</h1>
    </div>
  );
};
```

## Best Practices

1. **Always use `useCurrentFrame()`** - Drive all animations from the current frame
2. **Avoid CSS animations** - They won't render correctly in videos
3. **Think in seconds** - Multiply time in seconds by `fps` for frame calculations
4. **Use interpolate for smooth animations** - Built-in interpolation with easing functions
5. **Clamp extrapolation** - Prevent values from exceeding intended ranges
6. **Test frequently** - Preview in Remotion Studio before rendering

## Resources

- **Documentation**: https://www.remotion.dev/docs
- **Repository**: https://github.com/remotion-dev/remotion
- **Skills Repository**: https://github.com/remotion-dev/skills
- **Community**: Discord and GitHub Discussions
- **License**: MIT
