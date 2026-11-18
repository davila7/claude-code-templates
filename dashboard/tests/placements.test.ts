import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clickEvent,
  featuredPlacement,
  isBotUserAgent,
  isViewable,
  parsePlacement,
  parseSpotEvent,
  SPOT_ENDPOINT,
} from '../src/lib/placements.ts';

test('parsePlacement accepts known kinds only', () => {
  assert.deepEqual(parsePlacement('featured/forte'), { kind: 'featured', key: 'forte' });
  assert.deepEqual(parsePlacement('sponsored/3f2a6c1e-0000-4000-8000-000000000000'), {
    kind: 'sponsored',
    key: '3f2a6c1e-0000-4000-8000-000000000000',
  });
  for (const bad of ['banner/x', 'featured/', 'featured/a/b', 'featured/<x>', '', 42, null, `featured/${'a'.repeat(65)}`]) {
    assert.equal(parsePlacement(bad), null, String(bad));
  }
});

test('parseSpotEvent validates every field', () => {
  assert.deepEqual(parseSpotEvent({ placement: 'featured/forte', surface: 'home', event: 'impression' }), {
    placement: 'featured/forte',
    surface: 'home',
    event: 'impression',
  });
  assert.equal(parseSpotEvent({ placement: 'featured/forte', surface: 'sidebar', event: 'impression' }), null);
  assert.equal(parseSpotEvent({ placement: 'featured/forte', surface: 'home', event: 'view' }), null);
  assert.equal(parseSpotEvent(null), null);
  assert.equal(parseSpotEvent('featured/forte'), null);
});

test('featuredPlacement maps FEATURED_ITEMS urls', () => {
  assert.equal(featuredPlacement('/featured/brightdata'), 'featured/brightdata');
  assert.equal(featuredPlacement('/featured/brightdata/'), 'featured/brightdata');
  assert.equal(featuredPlacement('https://example.com/featured/x'), null);
  assert.equal(featuredPlacement('/component/agents/x'), null);
});

test('clickEvent: same site is click, another site is cta', () => {
  const origin = 'https://www.aitmpl.com';
  assert.equal(clickEvent('/featured/forte', origin), 'click');
  assert.equal(clickEvent('https://www.aitmpl.com/component/agents/x', origin), 'click');
  assert.equal(clickEvent('https://forteplatforms.com/?ref=aitmpl', origin), 'cta');
  assert.equal(clickEvent('https://aitmpl.com/', origin), 'cta'); // apex is another origin
  assert.equal(clickEvent('mailto:a@b.c', origin), null);
  assert.equal(clickEvent('javascript:void(0)', origin), null);
  assert.equal(clickEvent(null, origin), null);
});

test('isViewable: half the element, or 30% of the screen for tall ones', () => {
  assert.equal(isViewable(0.5, 50, 800), true);
  assert.equal(isViewable(0.49, 50, 800), false);
  assert.equal(isViewable(0.2, 240, 800), true);
  assert.equal(isViewable(0.2, 239, 800), false);
  assert.equal(isViewable(0, 0, 0), false);
});

test('isBotUserAgent', () => {
  assert.equal(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'), true);
  assert.equal(isBotUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0 Safari/537.36'), true);
  assert.equal(isBotUserAgent('curl/8.4.0'), true);
  assert.equal(isBotUserAgent(''), true);
  assert.equal(isBotUserAgent(null), true);
  assert.equal(
    isBotUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'),
    false,
  );
  assert.equal(isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'), false);
});

test('endpoint path avoids words ad blockers match', () => {
  assert.doesNotMatch(SPOT_ENDPOINT, /ad|sponsor|track|beacon|analytic|pixel/i);
});
