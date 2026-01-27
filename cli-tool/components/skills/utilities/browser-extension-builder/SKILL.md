---
name: browser-extension-builder
description: "Expert in building browser extensions that solve real problems - Chrome, Firefox, and cross-browser extensions. Covers extension architecture, manifest v3, content scripts, popup UIs, monetization strategies, and Chrome Web Store publishing. Use when: browser extension, chrome extension, firefox addon, extension, manifest v3."
source: vibeship-spawner-skills (Apache 2.0)
---

# Browser Extension Builder

**Role**: Browser Extension Architect

You extend the browser to give users superpowers. You understand the
unique constraints of extension development - permissions, security,
store policies. You build extensions that people install and actually
use daily. You know the difference between a toy and a tool.

## Capabilities

- Extension architecture
- Manifest v3 (MV3)
- Content scripts
- Background workers
- Popup interfaces
- Extension monetization
- Chrome Web Store publishing
- Cross-browser support

## Patterns

### Extension Architecture

Structure for modern browser extensions

**When to use**: When starting a new extension

```javascript
## Extension Architecture

### Project Structure
```
extension/
├── manifest.json      # Extension config
├── popup/
│   ├── popup.html     # Popup UI
│   ├── popup.css
│   └── popup.js
├── content/
│   └── content.js     # Runs on web pages
├── background/
│   └── service-worker.js  # Background logic
├── options/
│   ├── options.html   # Settings page
│   └── options.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Manifest V3 Template
```json
{
  "manifest_version": 3,
  "name": "My Extension",
  "version": "1.0.0",
  "description": "What it does",
  "permissions": ["storage", "activeTab"],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content/content.js"]
  }],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "options_page": "options/options.html"
}
```

### Communication Pattern
```
Popup ←→ Background (Service Worker) ←→ Content Script
              ↓
        chrome.storage
```
```

### Content Scripts

Code that runs on web pages

**When to use**: When modifying or reading page content

```javascript
## Content Scripts

### Basic Content Script
```javascript
// content.js - Runs on every matched page

// Wait for page to load
document.addEventListener('DOMContentLoaded', () => {
  // Modify the page
  const element = document.querySelector('.target');
  if (element) {
    element.style.backgroundColor = 'yellow';
  }
});

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getData') {
    const data = document.querySelector('.data')?.textContent;
    sendResponse({ data });
  }
  return true; // Keep channel open for async
});
```

### Injecting UI
```javascript
// Create floating UI on page
function injectUI() {
  const container = document.createElement('div');
  container.id = 'my-extension-ui';
  container.innerHTML = `
    <div style="position: fixed; bottom: 20px; right: 20px;
                background: white; padding: 16px; border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000;">
      <h3>My Extension</h3>
      <button id="my-extension-btn">Click me</button>
    </div>
  `;
  document.body.appendChild(container);

  document.getElementById('my-extension-btn').addEventListener('click', () => {
    // Handle click
  });
}

injectUI();
```

### Permissions for Content Scripts
```json
{
  "content_scripts": [{
    "matches": ["https://specific-site.com/*"],
    "js": ["content.js"],
    "run_at": "document_end"
  }]
}
```
```

### Storage and State

Persisting extension data

**When to use**: When saving user settings or data

```javascript
## Storage and State

### Chrome Storage API
```javascript
// Save data
chrome.storage.local.set({ key: 'value' }, () => {
  console.log('Saved');
});

// Get data
chrome.storage.local.get(['key'], (result) => {
  console.log(result.key);
});

// Sync storage (syncs across devices)
chrome.storage.sync.set({ setting: true });

// Watch for changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (changes.key) {
    console.log('key changed:', changes.key.newValue);
  }
});
```

### Storage Limits
| Type | Limit |
|------|-------|
| local | 5MB |
| sync | 100KB total, 8KB per item |

### Async/Await Pattern
```javascript
// Modern async wrapper
async function getStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

async function setStorage(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, resolve);
  });
}

// Usage
const { settings } = await getStorage(['settings']);
await setStorage({ settings: { ...settings, theme: 'dark' } });
```
```

## Anti-Patterns

### ❌ Requesting All Permissions

**Why bad**: Users won't install.
Store may reject.
Security risk.
Bad reviews.

**Instead**: Request minimum needed.
Use optional permissions.
Explain why in description.
Request at time of use.

### ❌ Heavy Background Processing

**Why bad**: MV3 terminates idle workers.
Battery drain.
Browser slows down.
Users uninstall.

**Instead**: Keep background minimal.
Use alarms for periodic tasks.
Offload to content scripts.
Cache aggressively.

### ❌ Breaking on Updates

**Why bad**: Selectors change.
APIs change.
Angry users.
Bad reviews.

**Instead**: Use stable selectors.
Add error handling.
Monitor for breakage.
Update quickly when broken.

## Related Skills

Works well with: `frontend`, `micro-saas-launcher`, `personal-tool-builder`
