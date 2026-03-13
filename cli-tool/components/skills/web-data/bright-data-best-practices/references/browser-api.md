# Browser API (Scraping Browser) Reference

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Connection Strings](#connection-strings)
- [Supported Frameworks](#supported-frameworks)
- [Session Rules](#session-rules)
- [Quick Start Examples](#quick-start-examples)
- [Custom CDP Functions](#custom-cdp-functions)
- [Geolocation Targeting](#geolocation-targeting)
- [Bandwidth Optimization](#bandwidth-optimization)
- [CAPTCHA Handling](#captcha-handling)
- [Debugging](#debugging)
- [Premium Domains](#premium-domains)
- [Error Codes](#error-codes)
- [Billing Model](#billing-model)
- [Best Practices](#best-practices)
- [Anti-Patterns](#anti-patterns)

---

## Overview

Bright Data Browser API (also called Scraping Browser) is a managed cloud browser service. It handles proxy management, fingerprinting, CAPTCHA solving, and bot detection bypass automatically. Use it when you need full browser automation: clicking, scrolling, form filling, JavaScript execution, or working with SPAs.

**When to use Browser API vs other APIs:**

| Need | Use |
|------|-----|
| Simple HTTP scraping, no interaction | Web Unlocker |
| Google/Bing search results | SERP API |
| Structured data from known platforms | Web Scraper API |
| Click, scroll, fill forms, run JS | **Browser API** |
| Intercept XHR/fetch calls from a page | **Browser API** |
| Handle complex anti-bot that requires browser | **Browser API** |
| Puppeteer/Playwright/Selenium automation | **Browser API** |

---

## Authentication

Get credentials from your Browser API zone's **Overview tab** in the Control Panel.

- **Username:** `brd-customer-{CUSTOMER_ID}-zone-{ZONE_NAME}`
- **Password:** Your zone password

```bash
export BROWSER_AUTH="brd-customer-CUSTOMER_ID-zone-ZONE_NAME:PASSWORD"
```

---

## Connection Strings

| Framework | Connection Type | Endpoint |
|-----------|----------------|----------|
| Playwright | WebSocket | `wss://${AUTH}@brd.superproxy.io:9222` |
| Puppeteer | WebSocket | `wss://${AUTH}@brd.superproxy.io:9222` |
| Selenium | HTTPS | `https://${AUTH}@brd.superproxy.io:9515` |

Replace `${AUTH}` with `username:password`.

**Critical:** Wrong port = 407 error. Playwright/Puppeteer = port `9222`. Selenium = port `9515`.

---

## Supported Frameworks

- **Node.js:** Puppeteer, Playwright, Selenium WebDriver
- **Python:** Playwright, Selenium
- **C# (.NET):** PuppeteerSharp, Playwright, Selenium
- **Other languages:** Any language with CDP or WebDriver support (Ruby, Go, Java, etc.)

---

## Session Rules

- **One initial navigation per session.** After `page.goto(url)`, you can interact (click, scroll, evaluate) within the same page, but cannot navigate to a different URL in the same session. Start a new session for a new target.
- **Idle timeout:** Sessions inactive for **5+ minutes** automatically close.
- **Maximum duration:** Sessions cannot exceed **30 minutes**.
- **Password entry:** Disabled by default to protect non-public data. Contact Bright Data to enable.

---

## Quick Start Examples

### Playwright (Node.js)

```javascript
const { chromium } = require("playwright-core");

const AUTH = process.env.BROWSER_AUTH || "brd-customer-CUSTOMER_ID-zone-ZONE_NAME:PASSWORD";
const TARGET_URL = "https://example.com";

(async () => {
  const browser = await chromium.connectOverCDP(
    `wss://${AUTH}@brd.superproxy.io:9222`
  );
  const page = await browser.newPage();

  // Set navigation timeout to 2 minutes (recommended for complex unlocking)
  page.setDefaultNavigationTimeout(120000);

  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });
  const html = await page.content();
  console.log(html);

  await browser.close();
})();
```

### Playwright (Python)

```python
import asyncio
from playwright.async_api import async_playwright

AUTH = "brd-customer-CUSTOMER_ID-zone-ZONE_NAME:PASSWORD"
TARGET_URL = "https://example.com"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(
            f"wss://{AUTH}@brd.superproxy.io:9222"
        )
        page = await browser.new_page()
        page.set_default_navigation_timeout(120000)

        await page.goto(TARGET_URL, wait_until="domcontentloaded")
        html = await page.content()
        print(html)

        await browser.close()

asyncio.run(main())
```

### Puppeteer (Node.js)

```javascript
const puppeteer = require("puppeteer-core");

const AUTH = process.env.BROWSER_AUTH || "brd-customer-CUSTOMER_ID-zone-ZONE_NAME:PASSWORD";

(async () => {
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://${AUTH}@brd.superproxy.io:9222`
  });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(120000);

  await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
  const html = await page.content();
  console.log(html);

  await browser.close();
})();
```

### Selenium (Python)

```python
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

AUTH = "brd-customer-CUSTOMER_ID-zone-ZONE_NAME:PASSWORD"

options = Options()
options.add_argument("--ignore-certificate-errors")

driver = webdriver.Remote(
    command_executor=f"https://{AUTH}@brd.superproxy.io:9515",
    options=options
)
driver.get("https://example.com")
print(driver.page_source)
driver.quit()
```

---

## Custom CDP Functions

Bright Data extends standard CDP with specialized commands. Use `page.evaluate` or `client.send` to invoke them.

### CAPTCHA Handling

#### `Captcha.setAutoSolve`
Control automatic CAPTCHA solving.

```javascript
// Disable auto-solve (use manual control instead)
const client = await page.target().createCDPSession();
await client.send("Captcha.setAutoSolve", { autoSolve: false });
```

#### `Captcha.solve`
Manually trigger CAPTCHA solving and wait for completion.

```javascript
const client = await page.target().createCDPSession();
const result = await client.send("Captcha.solve", { timeout: 30000 });
console.log(result.status); // "solved" | "not_detected" | "timeout"
```

```python
# Python equivalent
client = await page.context.new_cdp_session(page)
result = await client.send("Captcha.solve", {"timeout": 30000})
print(result["status"])
```

### Geolocation

#### `Proxy.setLocation`
Set precise proxy location by coordinates. **Must be called before navigating to the site.**

```javascript
const client = await page.target().createCDPSession();
await client.send("Proxy.setLocation", {
  latitude: 37.7749,
  longitude: -122.4194,
  distance: 10,   // Search radius in km
  strict: true    // true = only peers within distance; false = expand if none found
});
await page.goto("https://example.com");
```

```python
client = await page.context.new_cdp_session(page)
await client.send("Proxy.setLocation", {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "distance": 10,
    "strict": True
})
await page.goto("https://example.com")
```

### Session Management

#### `Proxy.useSession`
Maintain consistent proxy peer across multiple browsing sessions (same IP continuity).

```javascript
const client = await page.target().createCDPSession();
await client.send("Proxy.useSession", { sessionId: "my-session-123" });
```

### Device Emulation

#### `Emulation.getSupportedDevices`
Get list of available device profiles.

```javascript
const client = await page.target().createCDPSession();
const { devices } = await client.send("Emulation.getSupportedDevices");
console.log(devices); // ["iPhone 14", "Samsung Galaxy S21", ...]
```

#### `Emulation.setDevice`
Apply a specific device profile (user agent, screen size, touch).

```javascript
await client.send("Emulation.setDevice", {
  deviceName: "iPhone 14"
});
// Optional: landscape orientation
await client.send("Emulation.setDevice", {
  deviceName: "iPhone 14",
  landscape: true
});
```

### Ad Blocking

#### `Unblocker.enableAdBlock` / `Unblocker.disableAdBlock`
Block/unblock ads to reduce bandwidth on content-heavy sites.

```javascript
const client = await page.target().createCDPSession();
await client.send("Unblocker.enableAdBlock");
// ... scrape page ...
await client.send("Unblocker.disableAdBlock"); // if needed later
```

### Input Acceleration

#### `Input.type`
Faster text input than standard keyboard simulation. Useful for bulk form-filling.

```javascript
const client = await page.target().createCDPSession();
await client.send("Input.type", {
  text: "search query here",
  selector: "#search-input"
});
```

### File Downloads

#### `Download.*`
Control file downloads with content-type filtering.

```javascript
const client = await page.target().createCDPSession();
await client.send("Download.setDownloadBehavior", {
  behavior: "allow",
  downloadPath: "/tmp/downloads"
});
// Retrieve file as base64
const { data } = await client.send("Download.getDownloadedFile", {
  guid: "download-guid-here"
});
```

### Security / Client Certificates

#### `Browser.addCertificate`
Install a client SSL/TLS certificate for authenticated domain access. Certificate is automatically removed when the session ends.

```javascript
await client.send("Browser.addCertificate", {
  host: "example.com",
  certificate: "base64-encoded-cert",
  privateKey: "base64-encoded-key"
});
```

### Debugging

#### `Page.inspect`
Get a Chrome DevTools debugger URL to connect and inspect the live session.

```javascript
const { url } = await client.send("Page.inspect");
console.log(`DevTools: ${url}`);
// Open in Chrome or use programmatically
```

---

## Geolocation Targeting

### Country-Level (via credentials)
Append `-country-XX` to your username (2-letter ISO code):

```javascript
const AUTH = "brd-customer-ID-zone-NAME-country-us:PASSWORD";
const browser = await chromium.connectOverCDP(`wss://${AUTH}@brd.superproxy.io:9222`);
```

**EU targeting** — automatically routes through 29+ European countries:
```javascript
const AUTH = "brd-customer-ID-zone-NAME-country-eu:PASSWORD";
```

### Precise Location (via CDP)
Use `Proxy.setLocation` for city/neighborhood-level targeting. **Call before `page.goto()`**:

```javascript
const client = await page.target().createCDPSession();
await client.send("Proxy.setLocation", {
  latitude: 51.5074,   // London
  longitude: -0.1278,
  distance: 5,          // 5km radius
  strict: false         // expand search if no peers found nearby
});
await page.goto("https://example.com");
```

---

## Bandwidth Optimization

Browser sessions are billed by traffic. These techniques reduce costs:

### Block Unnecessary Resources

```javascript
// Puppeteer
await page.setRequestInterception(true);
page.on("request", (req) => {
  const blocked = ["image", "stylesheet", "font", "media"];
  if (blocked.includes(req.resourceType())) {
    req.abort();
  } else {
    req.continue();
  }
});
```

```python
# Playwright
async def block_resources(route, request):
    blocked = ["image", "stylesheet", "font", "media"]
    if request.resource_type in blocked:
        await route.abort()
    else:
        await route.continue_()

await page.route("**/*", block_resources)
```

### Block Specific URLs (CDP)

```javascript
const client = await page.target().createCDPSession();
await client.send("Network.setBlockedURLs", {
  urls: [
    "*google-analytics*",
    "*facebook.com/tr*",
    "*.doubleclick.net*"
  ]
});
```

### Enable Ad Blocker

```javascript
await client.send("Unblocker.enableAdBlock");
```

### Browser Caching
Browser API automatically caches resources across multiple navigations to the same domain within a session. No extra configuration needed.

---

## CAPTCHA Handling

### Automatic (Default)
CAPTCHA solving is enabled by default. No code needed — the browser solves CAPTCHAs transparently.

### Detect and Wait for CAPTCHA

```javascript
// Navigate and wait for CAPTCHA to be solved automatically
const client = await page.target().createCDPSession();
await page.goto("https://example.com");

// If CAPTCHA appears, explicitly wait for it
const captchaResult = await client.send("Captcha.solve", { timeout: 60000 });
if (captchaResult.status === "solved") {
  console.log("CAPTCHA solved");
}
```

### Disable Auto-Solve

```javascript
const client = await page.target().createCDPSession();
await client.send("Captcha.setAutoSolve", { autoSolve: false });
// Now you control when/if to solve CAPTCHAs
```

---

## Debugging

### Via Control Panel
Navigate to your Browser API zone → Overview tab → Click "Chrome Dev Tools Debugger".

### Via CDP Command

```javascript
const { url } = await client.send("Page.inspect");
// Opens Chrome DevTools for the live session
```

### Programmatic Inspection (Playwright)
Playwright provides a `slowMo` and debug URL option. Use `Page.inspect` to get the debug URL and connect with Chrome.

---

## Premium Domains

Certain websites classified as "premium" require more Browser API resources:

- Enable during zone creation: toggle "Premium Domains" ON
- Only traffic to premium-classified domains incurs the higher rate
- The list of premium domains updates regularly based on Bright Data's algorithms
- Check current premium domain list in your zone settings

---

## Error Codes

| Code | Issue | Solution |
|------|-------|----------|
| `407` | Wrong port | Playwright/Puppeteer = port `9222`, Selenium = port `9515` |
| `403` | Authentication failure | Verify username format and password; confirm you're using a Browser API zone (not proxy zone) |
| `503` | Service unavailable (scaling) | Reconnect after 1 minute |

---

## Billing Model

| Factor | Detail |
|--------|--------|
| Pricing unit | Traffic-based only (bandwidth consumed) |
| Time/instance fees | None |
| Session idle timeout | 5 minutes — sessions close automatically |
| Session max duration | 30 minutes |
| Resource blocking | Reduces bandwidth = reduces cost |

---

## Best Practices

### 1. Always set navigation timeout to 2 minutes
Complex anti-bot procedures take time. Default timeouts (30s) are too short.

```javascript
page.setDefaultNavigationTimeout(120000); // 2 minutes
```

### 2. Call `Proxy.setLocation` before navigation
Location selection must happen before `page.goto()` to ensure the correct proxy is selected.

```javascript
// CORRECT: Set location first
await client.send("Proxy.setLocation", { latitude: 37.7749, longitude: -122.4194, distance: 10 });
await page.goto("https://example.com");

// WRONG: Location set after navigation has no effect on proxy selection
await page.goto("https://example.com");
await client.send("Proxy.setLocation", { ... }); // too late
```

### 3. Block unnecessary resources to cut bandwidth costs
Images, stylesheets, and fonts are often not needed for data extraction. Block them.

```javascript
await page.route("**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2}", route => route.abort());
```

### 4. Use `waitUntil: "domcontentloaded"` over `networkidle`
`networkidle` waits for all network activity to stop, which is slow and often unnecessary. `domcontentloaded` is faster and sufficient for most pages.

```javascript
await page.goto(url, { waitUntil: "domcontentloaded" });
```

### 5. Start a fresh session for each new target URL
Since only one initial navigation per session is allowed, create a new browser connection for each independent scraping task.

```javascript
async function scrapeUrl(url) {
  const browser = await chromium.connectOverCDP(`wss://${AUTH}@brd.superproxy.io:9222`);
  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(120000);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    return await page.content();
  } finally {
    await browser.close();
  }
}
```

### 6. Use `Proxy.useSession` for IP continuity across sessions
When you need the same IP for multiple requests (e.g., login → scrape → logout flow across sessions):

```javascript
await client.send("Proxy.useSession", { sessionId: "user-session-abc123" });
```

### 7. Use `Unblocker.enableAdBlock` for content-heavy sites
Ad networks add significant bandwidth. Blocking ads reduces costs on news sites, blogs, and similar pages.

### 8. Use `Emulation.setDevice` for mobile-specific pages
Some sites serve different content to mobile users. Set the device profile instead of manually setting user agent.

```javascript
await client.send("Emulation.setDevice", { deviceName: "iPhone 14" });
await page.goto("https://example.com/mobile");
```

### 9. Monitor sessions via `Page.inspect` during development
During development, use `Page.inspect` to get a live DevTools URL to debug what the browser actually sees.

### 10. Use `Input.type` for bulk form filling
`Input.type` is faster than simulating individual keystrokes — important when filling many fields at scale.

---

## Anti-Patterns

**DO NOT use proxy networks with Playwright/Puppeteer/Selenium.**
Browser automation libraries should connect to Browser API, not route through a proxy. The Browser API endpoint (`wss://...`) replaces proxy configuration entirely.

**DO NOT reuse sessions for different target URLs.**
One session = one `page.goto()`. After that, interact only with the loaded page. For new URLs, create new sessions.

**DO NOT set navigation timeout below 60 seconds.**
Bright Data's unlocking procedures can take time. Anything below 60 seconds risks premature timeouts on difficult sites. Recommended: 120 seconds.

**DO NOT enable custom headers unless required.**
Custom headers/cookies shift billing from success-only to 100% of all requests.

**DO NOT rely on `networkidle` for SPA pages.**
Single-page applications may never reach true `networkidle` state. Use specific element waiters instead:
```javascript
await page.waitForSelector(".product-data", { timeout: 30000 });
```
