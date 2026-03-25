# Animations in Manim

Animations are transformations applied to mobjects over time. Manim provides a rich set of built-in animations for creating smooth, professional-looking transitions.

## Basic Animation Pattern

```python
from manim import *

class BasicAnimation(Scene):
    def construct(self):
        circle = Circle()

        # Play an animation
        self.play(Create(circle))
        self.wait(1)
```

## Creation Animations

Animations for introducing mobjects:

```python
class CreationAnimations(Scene):
    def construct(self):
        square = Square()
        circle = Circle()
        text = Text("Hello")

        # Create (draw stroke)
        self.play(Create(square))
        self.wait(0.5)

        # Fade in
        self.play(FadeIn(circle))
        self.wait(0.5)

        # Write (for text)
        self.play(Write(text))
        self.wait(0.5)

        # Grow from center
        triangle = Triangle()
        self.play(GrowFromCenter(triangle))
```

## Removal Animations

Animations for removing mobjects:

```python
class RemovalAnimations(Scene):
    def construct(self):
        shapes = VGroup(*[Circle() for _ in range(4)])
        shapes.arrange(RIGHT, buff=0.5)
        self.add(shapes)

        # Fade out
        self.play(FadeOut(shapes[0]))

        # Shrink to center
        self.play(ShrinkToCenter(shapes[1]))

        # Uncreate (reverse of Create)
        self.play(Uncreate(shapes[2]))

        # Unwrite (reverse of Write)
        text = Text("Bye")
        self.add(text)
        self.play(Unwrite(text))
```

## Transform Animations

Morph one mobject into another:

```python
class TransformAnimations(Scene):
    def construct(self):
        square = Square()
        circle = Circle()

        self.play(Create(square))
        self.wait(0.5)

        # Transform (original mobject becomes target)
        self.play(Transform(square, circle))
        self.wait(0.5)

        # ReplacementTransform (replace with new mobject)
        triangle = Triangle()
        self.play(ReplacementTransform(square, triangle))
```

## Movement Animations

```python
class MovementAnimations(Scene):
    def construct(self):
        circle = Circle()
        self.add(circle)

        # Shift (relative movement)
        self.play(circle.animate.shift(RIGHT * 2))

        # Move to (absolute position)
        self.play(circle.animate.move_to(UP * 2))

        # Rotate
        self.play(circle.animate.rotate(PI / 2))

        # Scale
        self.play(circle.animate.scale(2))
```

## The .animate Syntax

Use `.animate` to smoothly interpolate property changes:

```python
class AnimateSyntax(Scene):
    def construct(self):
        square = Square()
        self.add(square)

        # Animate multiple properties at once
        self.play(
            square.animate
            .shift(RIGHT * 2)
            .rotate(PI / 4)
            .scale(1.5)
            .set_fill(BLUE, opacity=0.7)
        )
```

## Animation Timing

```python
class AnimationTiming(Scene):
    def construct(self):
        circle = Circle()
        self.add(circle)

        # Set animation duration (default is 1 second)
        self.play(circle.animate.shift(RIGHT * 3), run_time=2)

        # Add delay before next animation
        self.wait(1.5)

        # Fast animation
        self.play(circle.animate.shift(LEFT * 3), run_time=0.5)
```

## Rate Functions (Easing)

Control animation speed curves:

```python
class RateFunctions(Scene):
    def construct(self):
        circles = VGroup(*[Circle() for _ in range(3)])
        circles.arrange(DOWN, buff=1)
        self.add(circles)

        # Linear (constant speed)
        self.play(
            circles[0].animate.shift(RIGHT * 3),
            rate_func=linear
        )

        # Smooth (ease in and out)
        self.play(
            circles[1].animate.shift(RIGHT * 3),
            rate_func=smooth
        )

        # Bounce
        self.play(
            circles[2].animate.shift(RIGHT * 3),
            rate_func=there_and_back
        )
```

## Simultaneous Animations

Animate multiple mobjects at once:

```python
class SimultaneousAnimations(Scene):
    def construct(self):
        circle = Circle()
        square = Square()

        circle.shift(LEFT * 2)
        square.shift(RIGHT * 2)

        # Both animations play simultaneously
        self.play(
            Create(circle),
            Create(square)
        )

        self.play(
            circle.animate.shift(UP),
            square.animate.shift(DOWN)
        )
```

## Sequential vs Simultaneous

```python
class SequentialVsSimultaneous(Scene):
    def construct(self):
        # Sequential (one after another)
        c1 = Circle().shift(LEFT * 3)
        c2 = Circle()
        c3 = Circle().shift(RIGHT * 3)

        self.play(Create(c1))  # First
        self.play(Create(c2))  # Second
        self.play(Create(c3))  # Third

        # Simultaneous (all at once)
        s1 = Square().shift(LEFT * 3 + DOWN * 2)
        s2 = Square().shift(DOWN * 2)
        s3 = Square().shift(RIGHT * 3 + DOWN * 2)

        self.play(Create(s1), Create(s2), Create(s3))  # All together
```

## Resources

- [Animation Reference](https://docs.manim.community/en/stable/reference/manim.animation.animation.Animation.html)
- [Animation Examples](https://docs.manim.community/en/stable/examples.html)
