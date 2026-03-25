# Signals in Motion Canvas

Signals represent values that may change over time. They create reactive dependencies between properties, automatically updating dependent values when source values change.

## Creating Signals

```typescript
import {createSignal} from '@motioncanvas/core/lib/signals';

// Create a simple signal
const radius = createSignal(10);

// Get the current value
console.log(radius()); // 10

// Set a new value
radius(20);
console.log(radius()); // 20
```

## Computed Signals

Create signals that depend on other signals:

```typescript
import {createSignal, createComputed} from '@motioncanvas/core/lib/signals';

const radius = createSignal(10);

// Area automatically updates when radius changes
const area = createComputed(() => Math.PI * radius() ** 2);

console.log(area()); // ~314.159

radius(20);
console.log(area()); // ~1256.637
```

## Signals in Components

Components use signals for reactive properties:

```typescript
import {makeScene2D} from '@motioncanvas/2d/lib/scenes';
import {Circle} from '@motioncanvas/2d/lib/components';
import {createRef, createSignal} from '@motioncanvas/core/lib/utils';

export default makeScene2D(function* (view) {
  const circleRef = createRef<Circle>();
  const radiusSignal = createSignal(50);

  view.add(
    <Circle
      ref={circleRef}
      size={() => radiusSignal() * 2} // Reactive binding
      fill="#e13238"
    />
  );

  // Animate the signal
  yield* radiusSignal(100, 2);
});
```

## Binding Signals

Link signals together for synchronized updates:

```typescript
export default makeScene2D(function* (view) {
  const circle1 = createRef<Circle>();
  const circle2 = createRef<Circle>();

  view.add(
    <>
      <Circle ref={circle1} x={-200} size={100} fill="#e13238" />
      <Circle ref={circle2} x={200} size={100} fill="#e6a700" />
    </>
  );

  // Bind circle2's size to circle1's size
  circle2().size(circle1().size);

  // Now both circles resize together
  yield* circle1().size(200, 1);
});
```

## Animating Signals

Signals can be tweened over time:

```typescript
import {createSignal} from '@motioncanvas/core/lib/signals';
import {tween} from '@motioncanvas/core/lib/tweening';
import {easeInOutCubic} from '@motioncanvas/core/lib/tweening';

export default makeScene2D(function* (view) {
  const mySignal = createSignal(0);

  // Tween from 0 to 100 over 2 seconds
  yield* tween(2, value => {
    mySignal(easeInOutCubic(value, 0, 100));
  });
});
```

## Resources

- [Motion Canvas Signals Documentation](https://motioncanvas.io/docs/signals/)
- [Reactive Programming Concepts](https://motioncanvas.io/docs/signals/)
