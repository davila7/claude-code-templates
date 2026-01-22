# Generator Functions in Motion Canvas

Generator functions are the core building block for describing animations in Motion Canvas. They use JavaScript's `function*` syntax and `yield*` to control animation flow.

## Basic Generator Function

```typescript
import {makeScene2D} from '@motioncanvas/2d/lib/scenes';

export default makeScene2D(function* (view) {
  // Animation code goes here
  yield* waitFor(1); // Wait for 1 second
});
```

## Yielding Animations

Use `yield*` to execute animations and wait for them to complete:

```typescript
export default makeScene2D(function* (view) {
  const circle = createRef<Circle>();

  view.add(<Circle ref={circle} size={100} fill="#e13238" />);

  // This will wait for the animation to complete
  yield* circle().size(200, 1.5);

  // This executes after the previous animation finishes
  yield* circle().fill('#e6a700', 1);
});
```

## Parallel Animations

Run multiple animations simultaneously using `all()`:

```typescript
import {all} from '@motioncanvas/core/lib/flow';

export default makeScene2D(function* (view) {
  const circle = createRef<Circle>();
  const rect = createRef<Rect>();

  view.add(
    <>
      <Circle ref={circle} x={-200} size={100} fill="#e13238" />
      <Rect ref={rect} x={200} size={100} fill="#e6a700" />
    </>
  );

  // Both animations run at the same time
  yield* all(
    circle().position.x(0, 1),
    rect().position.x(0, 1),
  );
});
```

## Sequential Flow

Chain animations in sequence:

```typescript
export default makeScene2D(function* (view) {
  const circle = createRef<Circle>();

  view.add(<Circle ref={circle} size={100} fill="#e13238" />);

  // Execute one after another
  yield* circle().size(200, 1);
  yield* circle().position.x(300, 1);
  yield* circle().fill('#e6a700', 1);
  yield* circle().size(100, 1);
});
```

## Resources

- [Motion Canvas Flow Documentation](https://motioncanvas.io/docs/flow/)
- [JavaScript Generators MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator)
