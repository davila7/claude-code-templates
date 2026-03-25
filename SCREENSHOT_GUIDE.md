# Screenshot Guide for PR

## 📸 Required Screenshots

To complete the PR, you need to take screenshots of the following pages in **both light and dark mode** (24 screenshots total):

### How to Take Screenshots
1. Open the dashboard in your browser
2. For **light mode**: Click the theme toggle to switch to light theme
3. For **dark mode**: Click the theme toggle to switch to dark theme
4. Take a full-page screenshot or capture the main content area

---

## Screenshot List

### 1. Main Dashboard (Home Page)
- **URL:** `/`
- **What to capture:** Full page showing component grid, sidebar, and top bar
- **Files:** 
  - `screenshot-home-light.png`
  - `screenshot-home-dark.png`

### 2. Sidebar Navigation
- **URL:** Any page (sidebar is visible on all pages)
- **What to capture:** Focus on the left sidebar with navigation items
- **Files:**
  - `screenshot-sidebar-light.png`
  - `screenshot-sidebar-dark.png`

### 3. Top Bar with Theme Toggle
- **URL:** Any page
- **What to capture:** Top navigation bar showing the theme toggle button
- **Files:**
  - `screenshot-topbar-light.png`
  - `screenshot-topbar-dark.png`

### 4. Component Grid
- **URL:** `/` or any component listing page
- **What to capture:** Grid of component cards
- **Files:**
  - `screenshot-components-light.png`
  - `screenshot-components-dark.png`

### 5. Trending Page
- **URL:** `/trending`
- **What to capture:** Full trending page with trending items
- **Files:**
  - `screenshot-trending-light.png`
  - `screenshot-trending-dark.png`

### 6. Jobs Page
- **URL:** `/jobs`
- **What to capture:** Jobs listing with country flags visible
- **Files:**
  - `screenshot-jobs-light.png`
  - `screenshot-jobs-dark.png`

### 7. My Components Page
- **URL:** `/my-components`
- **What to capture:** User's saved components and collections
- **Files:**
  - `screenshot-mycomponents-light.png`
  - `screenshot-mycomponents-dark.png`

### 8. Featured Article Page
- **URL:** `/featured/[any-article-slug]`
- **What to capture:** Full article page with content and styling
- **Files:**
  - `screenshot-featured-light.png`
  - `screenshot-featured-dark.png`

### 9. Component Detail Page
- **URL:** `/component/[type]/[slug]`
- **What to capture:** Component detail with code viewer and file tree
- **Files:**
  - `screenshot-component-detail-light.png`
  - `screenshot-component-detail-dark.png`

### 10. Search Modal
- **URL:** Any page, press search button or Cmd/Ctrl+K
- **What to capture:** Open search modal with some search results
- **Files:**
  - `screenshot-search-light.png`
  - `screenshot-search-dark.png`

### 11. Send to Repo Modal
- **URL:** Any component page, click "Send to Repo" button
- **What to capture:** Open modal showing the send to repo form
- **Files:**
  - `screenshot-sendtorepo-light.png`
  - `screenshot-sendtorepo-dark.png`

### 12. Cart Sidebar
- **URL:** Any page, click cart icon (add some items first)
- **What to capture:** Open cart sidebar with items
- **Files:**
  - `screenshot-cart-light.png`
  - `screenshot-cart-dark.png`

---

## After Taking Screenshots

1. Create a folder: `screenshots/`
2. Save all screenshots with the names listed above
3. Update `PULL_REQUEST.md` by replacing the placeholder text with actual image references:

Replace:
```markdown
> 📸 **[ATTACH SCREENSHOT: Main dashboard in light mode]**
```

With:
```markdown
![Main Dashboard Light Mode](screenshots/screenshot-home-light.png)
```

---

## Quick Commands

After taking screenshots, run:

```bash
# Create screenshots folder
mkdir screenshots

# Move your screenshots to the folder
# (adjust paths as needed)

# Add to git
git add screenshots/
git add PULL_REQUEST.md

# Commit
git commit -m "docs: Add UI screenshots for PR"

# Push to remote
git push origin feat/dashboard-dark-mode-ui-overhaul
```

---

## Tips for Good Screenshots

1. **Use consistent browser window size** for all screenshots
2. **Clear browser cache** before taking screenshots
3. **Use incognito/private mode** for clean state
4. **Zoom level**: Keep at 100% for consistency
5. **Capture meaningful content**: Make sure there's actual data visible (not empty states)
6. **Highlight the changes**: Focus on areas that were modified

---

## Optional: Animated GIFs

Consider creating an animated GIF showing the theme toggle in action:
- Record switching from light to dark mode
- Save as `screenshots/theme-toggle-demo.gif`
- Add to PR description for extra impact!
