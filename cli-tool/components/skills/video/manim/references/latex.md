# LaTeX in Manim

Manim has native support for rendering LaTeX, making it perfect for mathematical animations and educational content.

## MathTex - Mathematical Formulas

```python
from manim import *

class BasicMath(Scene):
    def construct(self):
        # Simple equation
        equation = MathTex(r"E = mc^2")

        self.play(Write(equation))
        self.wait(2)
```

## Tex - Mixed Text and Math

```python
class TexExample(Scene):
    def construct(self):
        # Mix text and math
        formula = Tex(r"The famous equation: $E = mc^2$")

        self.play(Write(formula))
        self.wait(2)
```

## Complex Equations

```python
class ComplexEquations(Scene):
    def construct(self):
        # Quadratic formula
        quadratic = MathTex(
            r"x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}"
        )

        # Integral
        integral = MathTex(
            r"\int_0^{\infty} e^{-x^2} dx = \frac{\sqrt{\pi}}{2}"
        )

        # Matrix
        matrix = MathTex(
            r"\begin{bmatrix} a & b \\ c & d \end{bmatrix}"
        )

        formulas = VGroup(quadratic, integral, matrix)
        formulas.arrange(DOWN, buff=1)

        self.play(Write(formulas))
        self.wait(2)
```

## Colored Parts

Color specific parts of equations:

```python
class ColoredMath(Scene):
    def construct(self):
        # Split equation into parts
        equation = MathTex(
            r"a^2", "+", "b^2", "=", "c^2"
        )

        # Color individual parts
        equation[0].set_color(RED)    # a^2
        equation[2].set_color(BLUE)   # b^2
        equation[4].set_color(GREEN)  # c^2

        self.play(Write(equation))
        self.wait(2)
```

## Transform Between Equations

```python
class EquationTransform(Scene):
    def construct(self):
        # Start with one equation
        eq1 = MathTex(r"x^2 + y^2 = r^2")

        # Transform to another
        eq2 = MathTex(r"(x-h)^2 + (y-k)^2 = r^2")

        self.play(Write(eq1))
        self.wait(1)

        self.play(TransformMatchingShapes(eq1, eq2))
        self.wait(2)
```

## Step-by-Step Derivation

```python
class Derivation(Scene):
    def construct(self):
        # Create a series of equations
        line1 = MathTex(r"x + 5 = 10")
        line2 = MathTex(r"x + 5 - 5 = 10 - 5")
        line3 = MathTex(r"x = 5")

        # Position them
        equations = VGroup(line1, line2, line3)
        equations.arrange(DOWN, buff=0.8)

        # Show derivation step by step
        self.play(Write(line1))
        self.wait(1)

        self.play(TransformMatchingShapes(line1.copy(), line2))
        self.wait(1)

        self.play(TransformMatchingShapes(line2.copy(), line3))
        self.wait(2)
```

## Aligned Equations

```python
class AlignedEquations(Scene):
    def construct(self):
        # Use aligned environment
        aligned = MathTex(
            r"\begin{aligned}"
            r"x + 5 &= 10 \\"
            r"x &= 10 - 5 \\"
            r"x &= 5"
            r"\end{aligned}"
        )

        self.play(Write(aligned))
        self.wait(2)
```

## Greek Letters and Symbols

```python
class GreekSymbols(Scene):
    def construct(self):
        # Common Greek letters
        greeks = MathTex(
            r"\alpha, \beta, \gamma, \delta, \theta, \pi, \sigma, \omega"
        )

        # Common symbols
        symbols = MathTex(
            r"\sum_{i=1}^{n} i = \frac{n(n+1)}{2}"
        )

        # Limits
        limit = MathTex(
            r"\lim_{x \to \infty} \frac{1}{x} = 0"
        )

        group = VGroup(greeks, symbols, limit)
        group.arrange(DOWN, buff=1)

        self.play(Write(group))
        self.wait(2)
```

## Font Sizes

```python
class FontSizes(Scene):
    def construct(self):
        # Different font sizes
        small = MathTex(r"E = mc^2").scale(0.5)
        normal = MathTex(r"E = mc^2")
        large = MathTex(r"E = mc^2").scale(2)

        sizes = VGroup(small, normal, large)
        sizes.arrange(DOWN, buff=1)

        self.play(Write(sizes))
        self.wait(2)
```

## Highlighting Parts

```python
class HighlightParts(Scene):
    def construct(self):
        equation = MathTex(
            r"f(x) = ax^2 + bx + c"
        )

        # Create a box around the quadratic term
        box = SurroundingRectangle(equation[0][4:7], color=YELLOW)

        self.play(Write(equation))
        self.wait(1)

        self.play(Create(box))
        self.wait(2)
```

## Resources

- [MathTex Reference](https://docs.manim.community/en/stable/reference/manim.mobject.text.tex_mobject.MathTex.html)
- [LaTeX Symbols Guide](https://www.overleaf.com/learn/latex/List_of_Greek_letters_and_math_symbols)
