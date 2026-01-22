---
name: manim
description: Comprehensive guide for Manim Community - Python framework for creating mathematical animations and educational videos with programmatic control
version: 1.0.0
author: manim-community
repo: https://github.com/ManimCommunity/manim
license: MIT
tags: [Video, Python, Animation, Manim, Mathematical, Educational, Visualization, LaTeX, 3Blue1Brown]
dependencies: [manim>=0.19.0, python>=3.8]
---

# Manim Community - Mathematical Animation Engine

Comprehensive skill set for creating mathematical animations using Manim Community, a Python framework for creating explanatory math videos programmatically, popularized by 3Blue1Brown.

## When to use

Use this skill whenever you are dealing with Manim code to obtain domain-specific knowledge about:

- Creating mathematical animations and visualizations
- Building educational video content programmatically
- Working with geometric shapes and transformations
- Animating LaTeX equations and mathematical formulas
- Creating graphs, charts, and coordinate systems
- Implementing scene-based animation sequences
- Rendering high-quality mathematical diagrams
- Building explanatory visual content for teaching

## Core Concepts

Manim allows you to create animations using:
- **Scenes**: Canvas for your animations where you orchestrate mobjects
- **Mobjects**: Mathematical objects that can be displayed (shapes, text, equations)
- **Animations**: Transformations applied to mobjects (Write, Create, Transform, FadeIn)
- **Transforms**: Morphing between different states of mobjects
- **LaTeX Integration**: Native support for rendering mathematical notation
- **Python Simplicity**: Use Python to programmatically specify animation behavior

## Key Features

- Precise mathematical object positioning and transformations
- Native LaTeX rendering for equations and formulas
- Extensive shape library (circles, rectangles, arrows, polygons)
- Coordinate systems and function graphing
- Boolean operations on geometric shapes
- Camera controls and scene management
- High-quality video rendering
- IPython/Jupyter notebook integration
- VS Code extension with live preview

## How to use

Read individual rule files for detailed explanations and code examples:

### Core Concepts
- **[references/scenes.md](references/scenes.md)** - Creating scenes and organizing animations
- **[references/mobjects.md](references/mobjects.md)** - Understanding mathematical objects and shapes
- **[references/animations.md](references/animations.md)** - Core animation types and techniques
- **[references/latex.md](references/latex.md)** - Rendering LaTeX equations and formulas

For additional topics including transforms, timing, shapes, coordinate systems, 3D animations, camera movement, and advanced features, refer to the comprehensive [Manim Community documentation](https://docs.manim.community/).

## Quick Start Example

```python
from manim import *

class SquareToCircle(Scene):
    def construct(self):
        # Create a square
        square = Square()
        square.set_fill(BLUE, opacity=0.5)

        # Create a circle
        circle = Circle()
        circle.set_fill(RED, opacity=0.5)

        # Animate square creation
        self.play(Create(square))
        self.wait(1)

        # Transform square into circle
        self.play(Transform(square, circle))
        self.wait(1)

        # Fade out
        self.play(FadeOut(square))
```

Render with: `manim -pql script.py SquareToCircle`

## Best Practices

1. **Inherit from Scene** - All animations should be in a class inheriting from Scene
2. **Use construct() method** - Place all animation code inside the construct() method
3. **Think in layers** - Add mobjects to the scene before animating them
4. **Use self.play()** - Animate mobjects using self.play(Animation(...))
5. **Test with low quality** - Use `-ql` flag for faster preview renders
6. **Leverage LaTeX** - Use Tex() and MathTex() for mathematical notation
7. **Group related objects** - Use VGroup to manage multiple mobjects together
8. **Preview frequently** - Use `-p` flag to automatically open rendered videos

## Command Line Usage

```bash
# Preview at low quality (fast)
manim -pql script.py SceneName

# Render at high quality
manim -pqh script.py SceneName

# Save last frame as image
manim -s script.py SceneName

# Render multiple scenes
manim script.py Scene1 Scene2
```

## Resources

- **Documentation**: https://docs.manim.community/
- **Repository**: https://github.com/ManimCommunity/manim
- **Examples Gallery**: https://docs.manim.community/en/stable/examples.html
- **Discord Community**: https://www.manim.community/discord/
- **3Blue1Brown Channel**: https://www.youtube.com/c/3blue1brown
- **License**: MIT
