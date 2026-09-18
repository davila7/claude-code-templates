import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { HOME_STATS, statValueAt, type HomeStat } from '../lib/home-stats';

/**
 * Compact counter strip for the home hero.
 *
 * Every number is a pure function of UTC time (see lib/home-stats.ts), so it is
 * identical on every device and in every session and only ever grows. On mount
 * each digit rolls up from zero like an odometer, and afterwards the digits
 * keep ticking whenever the seeded curve crosses the next whole unit.
 */

/** Cells rendered per digit column. `POS_SNAP` must stay well below this. */
const STRIP_CELLS = 70;
/** Once a column has rolled past this position it is silently rewound. */
const POS_SNAP = 50;
/** Duration of the odometer roll, in ms. */
const ROLL_MS = 1000;

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const STRIP = Array.from({ length: STRIP_CELLS }, (_, i) => i % 10);

interface DigitProps {
  digit: number;
  /** Extra full turns on the first roll — more for the rightmost digits. */
  spins: number;
  /** Stagger, so the strip settles left to right. */
  delay: number;
}

/**
 * One digit column. Mounts showing `0` and immediately rolls up to `digit`;
 * later changes roll the shortest upward path, so the face never runs backwards.
 */
function Digit({ digit, spins, delay }: DigitProps) {
  const [pos, setPos] = useState(0);
  const [rolling, setRolling] = useState(false);
  const revealed = useRef(false);
  const rafs = useRef<number[]>([]);

  useEffect(
    () => () => {
      rafs.current.forEach(cancelAnimationFrame);
      rafs.current = [];
    },
    [],
  );

  useEffect(() => {
    if (!revealed.current) {
      revealed.current = true;
      // Two frames: the first paints the strip at 0, the second lets the
      // transition pick up the change.
      rafs.current.push(
        requestAnimationFrame(() => {
          rafs.current.push(
            requestAnimationFrame(() => {
              setRolling(true);
              setPos(spins * 10 + digit);
            }),
          );
        }),
      );
      return;
    }

    setRolling(true);
    setPos((prev) => {
      const delta = (digit - (prev % 10) + 10) % 10;
      return delta === 0 ? prev : prev + delta;
    });
    // `spins` only matters for the first roll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digit]);

  // Rewind a past-the-end column without a transition, keeping the same face.
  const handleTransitionEnd = () => {
    if (pos < POS_SNAP) return;
    setRolling(false);
    setPos(pos % 10);
  };

  return (
    <span className="hs-digit" aria-hidden="true">
      <span
        className="hs-strip"
        onTransitionEnd={handleTransitionEnd}
        style={{
          transform: `translateY(calc(${-pos} * var(--hs-cell-h)))`,
          transition: rolling
            ? `transform ${ROLL_MS}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`
            : 'none',
        }}
      >
        {STRIP.map((n, i) => (
          <span className="hs-cell" key={i}>
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

/** Renders `value` as digit columns, or as plain text before the roll starts. */
function Odometer({ value, rolling }: { value: number; rolling: boolean }) {
  const text = value.toLocaleString('en-US');

  if (!rolling) {
    return <span className="hs-value">{text}</span>;
  }

  const digits = text.replace(/\D/g, '').length;
  let digitIndex = -1;

  return (
    <span className="hs-value">
      <span className="sr-only">{text}</span>
      {text.split('').map((char, i) => {
        if (char < '0' || char > '9') {
          return (
            <span className="hs-sep" key={i} aria-hidden="true">
              {char}
            </span>
          );
        }
        digitIndex += 1;
        const fromRight = digits - 1 - digitIndex;
        return (
          <Digit
            key={i}
            digit={Number(char)}
            spins={1 + Math.min(fromRight, 3)}
            delay={digitIndex * 45}
          />
        );
      })}
    </span>
  );
}

function StatCell({ stat, rolling }: { stat: HomeStat; rolling: boolean }) {
  const [value, setValue] = useState(stat.base);

  // Resolve the real value before the first paint, so the roll lands on it.
  useIsomorphicLayoutEffect(() => {
    setValue((prev) => Math.max(prev, statValueAt(stat, Date.now())));
  }, [stat]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setValue((prev) => Math.max(prev, statValueAt(stat, Date.now())));
    }, 1000);
    return () => window.clearInterval(id);
  }, [stat]);

  const body = (
    <>
      <Odometer value={value} rolling={rolling} />
      <span className="hs-label">{stat.label}</span>
    </>
  );

  if (!stat.href) {
    return (
      <span className="hs-cell-wrap" title={stat.title}>
        {body}
      </span>
    );
  }

  const external = stat.href.startsWith('http');

  return (
    <a
      className="hs-cell-wrap hs-link"
      href={stat.href}
      title={stat.title}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
    >
      {body}
    </a>
  );
}

export default function HomeStats({ componentsFloor = 0 }: { componentsFloor?: number }) {
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) setRolling(true);
  }, []);

  // The catalog count is read at build time; never show less than what the
  // site actually ships. Memoised so the per-cell interval is not restarted.
  const stats = useMemo(
    () =>
      HOME_STATS.map((stat) =>
        stat.key === 'components' && componentsFloor > stat.base
          ? { ...stat, base: componentsFloor }
          : stat,
      ),
    [componentsFloor],
  );

  return (
    <div className="hs-root">
      {stats.map((stat, i) => (
        <div className="hs-item" key={stat.key}>
          {i > 0 && <span className="hs-divider" aria-hidden="true" />}
          <StatCell stat={stat} rolling={rolling} />
        </div>
      ))}
    </div>
  );
}
