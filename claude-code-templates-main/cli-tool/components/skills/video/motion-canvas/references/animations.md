# Animations in Motion Canvas

Motion Canvas uses a property-based animation system where you tween individual properties over time using generator functions.

## Basic Property Animation

```typescript
import {makeScene2D} from '@motioncanvas/2d/lib/scenes';
import {Circle} from '@motioncanvas/2d/lib/components';
import {createRef} from '@motioncanvas/core/lib/utils';

export default makeScene2D(function* (view) {
  const circle = createRef<Circle>();

  view.add(<Circle ref={circle} size={100} fill="#e13238" />);

  // Animate size from current value (100) to 200 over 1.5 seconds
  yield* circle().size(200, 1.5);
});
```

## Multiple Property Animation

Animate several properties at once:

```typescript
import {all} from '@motioncanvas/core/lib/flow';

export default makeScene2D(function* (view) {
  const circle = createRef<Circle>();

  view.add(<Circle ref={circle} size={100} fill="#e13238" />);

  // Animate multiple properties simultaneously
  yield* all(
    circle().size(200, 1.5),
    circle().position.x(300, 1.5),
    circle().fill('#e6a700', 1.5),
  );
});
```

## Easing Functions

Control animation curves with easing:

```typescript
import {easeInOutCubic, easeInBounce} from '@motioncanvas/core/lib/tweening';

export default makeScene2D(function* (view) {
  const circle = createRef<Circle>();

  view.add(<Circle ref={circle} size={100} fill="#e13238" />);

  // Use cubic easing
  yield* circle().size(200, 1.5, easeInOutCubic);

  // Use bounce easing
  yield* circle().position.y(200, 1, easeInBounce);
});
```

## From-To Animation

Specify both start and end values explicitly:

```typescript
export default makeScene2D(function* (view) {
  const circle = createRef<Circle>();

  view.add(<Circle ref={circle} size={100} fill="#e13238" />);

  // Animate from 50 to 200
  yield* circle().size(200, 1.5).from(50);

  // Or use the longer syntax
  yield* tween(1.5, value => {
    circle().size(map(50, 200, value));
  });
});
```

## Looping Animations

Create repeating animations:

```typescript
import {loop} from '@motioncanvas/core/lib/flow';

export default makeScene2D(function* (view) {
  const circle = createRef<Circle>();

  view.add(<Circle ref={circle} size={100} fill="#e13238" />);

  // Loop 3 times
  yield* loop(3, () => circle().size(200, 1).to(100, 1));

  // Infinite loop
  yield* loop(Infinity, function* () {
    yield* circle().rotation(360, 2);
  });
});
```

## Chain Animations

Sequence animations fluently:

```typescript
export default makeScene2D(function* (view) {
  const circle = createRef<Circle>();

  view.add(<Circle ref={circle} size={100} fill="#e13238" />);

  // Chain multiple tweens
  yield* circle()
    .size(200, 1)
    .to(150, 0.5)
    .to(100, 0.5);
});
```

## Relative Animations

Animate relative to current value:

```typescript
export default makeScene2D(function* (view) {
  const circle = createRef<Circle>();

  view.add(<Circle ref={circle} x={0} size={100} fill="#e13238" />);

  // Move 100 pixels to the right (relative)
  yield* circle().position.x(circle().position.x() + 100, 1);

  // Or use the .by() method
  yield* circle().position.x(100, 1).by();
});
```

## Resources

- [Motion Canvas Animation Documentation](https://motioncanvas.io/docs/flow/)
- [Easing Functions Reference](https://motioncanvas.io/docs/tweening/)
