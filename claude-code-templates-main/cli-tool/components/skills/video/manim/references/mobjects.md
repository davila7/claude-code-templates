# Mobjects in Manim

Mobjects (Mathematical Objects) are the building blocks of Manim animations. They represent anything that can be displayed on screen.

## Basic Shapes

```python
from manim import *

class BasicShapes(Scene):
    def construct(self):
        # Circle
        circle = Circle(radius=1, color=BLUE)
        circle.set_fill(BLUE, opacity=0.5)

        # Square
        square = Square(side_length=2, color=RED)

        # Rectangle
        rectangle = Rectangle(width=3, height=1.5, color=GREEN)

        # Display them
        self.play(Create(circle))
        self.play(Create(square))
        self.play(Create(rectangle))
```

## Common Mobjects

### Geometric Shapes

```python
class GeometricShapes(Scene):
    def construct(self):
        # Basic shapes
        circle = Circle()
        square = Square()
        triangle = Triangle()
        pentagon = RegularPolygon(n=5)

        # Arrange in a row
        shapes = VGroup(circle, square, triangle, pentagon)
        shapes.arrange(RIGHT, buff=0.5)

        self.play(Create(shapes))
```

### Lines and Arrows

```python
class LinesAndArrows(Scene):
    def construct(self):
        # Line
        line = Line(start=LEFT, end=RIGHT, color=BLUE)

        # Arrow
        arrow = Arrow(start=LEFT, end=RIGHT, color=RED)

        # Double arrow
        double_arrow = DoubleArrow(start=LEFT * 2, end=RIGHT * 2)

        # Vector
        vector = Vector(direction=UP + RIGHT)

        arrows = VGroup(line, arrow, double_arrow, vector)
        arrows.arrange(DOWN, buff=0.5)

        self.play(Create(arrows))
```

## Mobject Properties

### Color and Opacity

```python
class ColorOpacity(Scene):
    def construct(self):
        circle = Circle()

        # Set stroke color
        circle.set_stroke(color=BLUE, width=5)

        # Set fill
        circle.set_fill(RED, opacity=0.7)

        self.play(Create(circle))
```

### Size and Position

```python
class SizePosition(Scene):
    def construct(self):
        square = Square()

        # Scale
        square.scale(2)

        # Move
        square.shift(UP * 2 + RIGHT * 3)

        # Rotate
        square.rotate(PI / 4)

        self.play(Create(square))
```

## Text and LaTeX

```python
class TextExample(Scene):
    def construct(self):
        # Regular text
        text = Text("Hello, Manim!")

        # LaTeX text
        formula = MathTex(r"e^{i\pi} + 1 = 0")

        # Equation
        equation = Tex(r"The famous equation: $E = mc^2$")

        group = VGroup(text, formula, equation)
        group.arrange(DOWN, buff=1)

        self.play(Write(text))
        self.play(Write(formula))
        self.play(Write(equation))
```

## Grouping Mobjects

```python
class GroupingExample(Scene):
    def construct(self):
        # Create multiple circles
        circles = VGroup(*[Circle(radius=0.5) for _ in range(5)])

        # Arrange them
        circles.arrange(RIGHT, buff=0.3)

        # Apply color gradient
        circles.set_color_by_gradient(BLUE, RED)

        # Animate all at once
        self.play(Create(circles))

        # Animate each individually
        self.play(*[circle.animate.shift(UP) for circle in circles])
```

## Custom Mobjects

```python
class CustomMobject(VMobject):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Add custom shape construction
        self.set_points_as_corners([
            LEFT, UP, RIGHT, DOWN, LEFT
        ])
        self.set_fill(BLUE, opacity=0.5)

class CustomExample(Scene):
    def construct(self):
        custom = CustomMobject()
        self.play(Create(custom))
```

## Resources

- [Mobjects Reference](https://docs.manim.community/en/stable/reference/manim.mobject.mobject.Mobject.html)
- [Geometry Documentation](https://docs.manim.community/en/stable/reference/manim.mobject.geometry.html)
