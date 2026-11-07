import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectInAppBrowser, externalBrowserUrl } from '../src/lib/sign-in.ts';

const UA = {
  xIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/10.70',
  xAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36 TwitterAndroid',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 340.0.2.18.94',
  facebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.37.97]',
  linkedin: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.30',
  genericIosWebView: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  genericAndroidWebView: 'Mozilla/5.0 (Linux; Android 14; SM-S918B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36',
  safariIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  desktopChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  desktopSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
};

test('detects social in-app browsers', () => {
  assert.deepEqual(detectInAppBrowser(UA.xIos), { app: 'X', platform: 'ios' });
  assert.deepEqual(detectInAppBrowser(UA.xAndroid), { app: 'X', platform: 'android' });
  assert.equal(detectInAppBrowser(UA.instagram)?.app, 'Instagram');
  assert.equal(detectInAppBrowser(UA.facebook)?.app, 'Facebook');
  assert.equal(detectInAppBrowser(UA.linkedin)?.app, 'LinkedIn');
});

test('detects unnamed WebViews', () => {
  assert.deepEqual(detectInAppBrowser(UA.genericIosWebView), { app: 'this app', platform: 'ios' });
  assert.deepEqual(detectInAppBrowser(UA.genericAndroidWebView), { app: 'this app', platform: 'android' });
  const ipadDesktopWebView = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';
  assert.deepEqual(detectInAppBrowser(ipadDesktopWebView), { app: 'this app', platform: 'other' });
});

test('leaves real browsers alone', () => {
  for (const ua of [UA.safariIos, UA.chromeIos, UA.chromeAndroid, UA.desktopChrome, UA.desktopSafari,
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0', '']) {
    assert.equal(detectInAppBrowser(ua), null, ua);
  }
});

test('builds system-browser links', () => {
  const href = 'https://www.aitmpl.com/jobs?q=ai#top';
  assert.equal(externalBrowserUrl(href, 'ios'), 'x-safari-https://www.aitmpl.com/jobs?q=ai#top');
  assert.equal(
    externalBrowserUrl(href, 'android'),
    'intent://www.aitmpl.com/jobs?q=ai#Intent;scheme=https;S.browser_fallback_url=https%3A%2F%2Fwww.aitmpl.com%2Fjobs%3Fq%3Dai%23top;end',
  );
  assert.equal(externalBrowserUrl(href, 'other'), null);
  assert.equal(externalBrowserUrl('http://localhost:4321/', 'ios'), null);
  assert.equal(externalBrowserUrl('not a url', 'ios'), null);
});
