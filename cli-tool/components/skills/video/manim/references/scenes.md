# Scenes in Manim

Scenes are the canvas for your animations. All Manim code is organized within Scene classes, and each scene represents a complete animation sequence.

## Basic Scene Structure

```python
from manim import *

class MyScene(Scene):
    def construct(self):
        # All animation code goes here
        circle = Circle()
        self.play(Create(circle))
        self.wait(1)
```

## Scene Types

Manim provides different scene types for different purposes:

### Standard Scene

```python
class BasicScene(Scene):
    def construct(self):
        text = Text("Hello, Manim!")
        self.play(Write(text))
        self.wait(2)
```

### Moving Camera Scene

For scenes with camera movement:

```python
class CameraScene(MovingCameraScene):
    def construct(self):
        circle = Circle()
        self.play(Create(circle))

        # Zoom in on the circle
        self.play(self.camera.frame.animate.scale(0.5))
        self.wait(1)
```

### 3D Scene

For three-dimensional animations:

```python
class ThreeDExample(ThreeDScene):
    def construct(self):
        axes = ThreeDAxes()
        sphere = Sphere()

        self.set_camera_orientation(phi=75 * DEGREES, theta=30 * DEGREES)
        self.play(Create(axes), Create(sphere))
        self.begin_ambient_camera_rotation(rate=0.1)
        self.wait(5)
```

## Adding and Removing Mobjects

```python
class AddRemoveScene(Scene):
    def construct(self):
        circle = Circle()
        square = Square()

        # Add without animation
        self.add(circle)
        self.wait(1)

        # Add with animation
        self.play(Create(square))
        self.wait(1)

        # Remove without animation
        self.remove(circle)
        self.wait(1)

        # Remove with animation
        self.play(FadeOut(square))
```

## Scene Methods

Common scene methods:

```python
class SceneMethods(Scene):
    def construct(self):
        circle = Circle()

        # Add mobject to scene
        self.add(circle)

        # Play animation
        self.play(circle.animate.shift(RIGHT * 2))

        # Wait (pause)
        self.wait(2)

        # Remove mobject
        self.remove(circle)

        # Clear all mobjects
        self.clear()
```

## Multiple Scenes in One File

```python
from manim import *

class Scene1(Scene):
    def construct(self):
        circle = Circle()
        self.play(Create(circle))

class Scene2(Scene):
    def construct(self):
        square = Square()
        self.play(Create(square))

# Render specific scene:
# manim script.py Scene1
# manim script.py Scene2
```

## Resources

- [Manim Scenes Documentation](https://docs.manim.community/en/stable/reference/manim.scene.scene.Scene.html)
- [Building Blocks Tutorial](https://docs.manim.community/en/stable/tutorials/building_blocks.html)
