# Web Browser Game Development

> Framework selection and browser-specific principles.

---

## 1. Framework Selection

### Decision Tree

```
What type of game?
│
├── 2D Game
│   ├── Full game engine features? → Phaser
│   └── Raw rendering power? → PixiJS
│
├── 3D Game
│   ├── Full engine (physics, XR)? → Babylon.js
│   └── Rendering focused? → Three.js
│
└── Hybrid / Canvas
    └── Custom → Raw Canvas/WebGL
```

### Comparison

| Framework | Type | Best For |
|-----------|------|----------|
| **Phaser** | 2D | Full game features |
| **PixiJS** | 2D | Rendering, UI |
| **Three.js** | 3D | Visualizations, lightweight |
| **Babylon.js** | 3D | Full engine, XR |

---

## 2. WebGPU Adoption

### Browser Support

WebGPU shipped in Chrome and Edge 113 (desktop), later on Android, in Firefox 141 (Windows first) and in Safari 26. Coverage still varies by OS and GPU, so check [caniuse.com/webgpu](https://caniuse.com/webgpu) for the target audience and never assume it is present.

### Decision

- **New projects**: Use WebGPU with WebGL fallback
- **Legacy support**: Start with WebGL
- **Feature detection**: `navigator.gpu` can exist while `requestAdapter()` returns `null`; fall back to WebGL in that case too

---

## 3. Performance Principles

### Browser Constraints

| Constraint | Strategy |
|------------|----------|
| No local file access | Asset bundling, CDN |
| Tab throttling | Pause on `visibilitychange`; `requestAnimationFrame` stops in background tabs, so clamp the frame delta on resume |
| Mobile data limits | Compress assets |
| Audio autoplay | Require user interaction |

### Optimization Priority

1. **Asset compression** - KTX2, Draco, WebP
2. **Lazy loading** - Load on demand
3. **Object pooling** - Avoid GC
4. **Draw call batching** - Reduce state changes
5. **Web Workers** - Offload heavy computation

---

## 4. Asset Strategy

### Compression Formats

| Type | Format |
|------|--------|
| Textures | KTX2 + Basis Universal |
| Audio | WebM/Opus (fallback: MP3) |
| 3D Models | glTF + Draco/Meshopt |

### Loading Strategy

| Phase | Load |
|-------|------|
| Startup | Core assets, <2MB |
| Gameplay | Stream on demand |
| Background | Prefetch next level |

---

## 5. PWA for Games

### Benefits

- Offline play
- Install to home screen
- Full screen mode
- Push notifications

### Requirements

- Service worker for caching
- Web app manifest
- HTTPS

---

## 6. Audio Handling

### Browser Requirements

- Audio context requires user interaction
- Create AudioContext on first click/tap
- Resume context if suspended

### Best Practices

- Use Web Audio API
- Pool audio sources
- Preload common sounds
- Compress with WebM/Opus

---

## 7. Anti-Patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| Load all assets upfront | Progressive loading |
| Ignore tab visibility | Pause when hidden |
| Block on audio load | Lazy load audio |
| Skip compression | Compress everything |
| Assume fast connection | Handle slow networks |

---

> **Remember:** Browser is the most accessible platform. Respect its constraints.
