# PC/Console Game Development

> Engine selection and platform-specific principles.

---

## 1. Engine Selection

### Decision Tree

```
What are you building?
│
├── 2D Game
│   ├── Open source important? → Godot
│   └── Large team/assets? → Unity
│
├── 3D Game
│   ├── AAA visual quality? → Unreal
│   ├── Cross-platform priority? → Unity
│   └── Indie/open source? → Godot
│
└── Specific Needs
    ├── DOTS performance? → Unity
    ├── Nanite/Lumen? → Unreal
    └── Lightweight? → Godot
```

### Comparison

| Factor | Unity | Godot | Unreal |
|--------|---------|---------|----------|
| 2D | Good | Excellent | Limited |
| 3D | Good | Good | Excellent |
| Learning | Medium | Easy | Hard |
| Cost | Free Personal tier under a revenue cap, then per-seat plans | Free (MIT) | 5% royalty on gross revenue above USD 1M per product |
| Team | Any | Solo-Medium | Medium-Large |

Licensing terms change: check the engine's current pricing page before recommending one on cost.

---

## 2. Platform Features

### Steam Integration

| Feature | Purpose |
|---------|---------|
| Achievements | Player goals |
| Cloud Saves | Cross-device progress |
| Leaderboards | Competition |
| Workshop | User mods |
| Rich Presence | Show in-game status |

### Console Requirements

| Platform | Certification |
|----------|--------------|
| PlayStation | TRC compliance |
| Xbox | XR compliance |
| Nintendo | Lotcheck |

---

## 3. Controller Support

### Input Abstraction

```
Map ACTIONS, not buttons:
- "confirm" → A (Xbox), Cross (PS), B (Nintendo)
- "cancel" → B (Xbox), Circle (PS), A (Nintendo)
```

### Haptic Feedback

| Intensity | Use |
|-----------|-----|
| Light | UI feedback |
| Medium | Impacts |
| Heavy | Major events |

---

## 4. Performance Optimization

### Profiling First

| Engine | Tool |
|--------|------|
| Unity | Profiler Window |
| Godot | Debugger → Profiler |
| Unreal | Unreal Insights |

### Common Bottlenecks

| Bottleneck | Solution |
|------------|----------|
| Draw calls | Batching, atlases |
| GC spikes | Object pooling |
| Physics | Simpler colliders |
| Shaders | LOD shaders |

---

## 5. Engine-Specific Principles

### Unity

- DOTS for performance-critical systems
- Burst compiler for hot paths
- Addressables for asset streaming

### Godot

- GDScript for rapid iteration
- C# for complex logic
- Signals for decoupling

### Unreal

- Blueprint for designers
- C++ for performance
- Nanite for high-poly environments
- Lumen for dynamic lighting

---

## 6. Anti-Patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| Choose engine by hype | Choose by project needs |
| Ignore platform guidelines | Study certification requirements |
| Hardcode input buttons | Abstract to actions |
| Skip profiling | Profile early and often |

---

> **Remember:** Engine is a tool. Master the principles, then adapt to any engine.
