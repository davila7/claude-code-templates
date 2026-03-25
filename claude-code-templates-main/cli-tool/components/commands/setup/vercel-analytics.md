---
allowed-tools: Read, Write, Edit, Bash
argument-hint:
description: Set up Vercel Analytics and Speed Insights for React/Vite projects
---

# Vercel Analytics Setup

Automatically configure Vercel Analytics and Speed Insights for your React/Vite project.

**Usage:** `/vercel-analytics` (no arguments needed)

**What it does:**
- Installs @vercel/analytics and @vercel/speed-insights packages
- Adds components to your React app
- Configures SPA routing for Vercel deployment
- Fixes 404 errors for direct route access

**Process:**

1. **Install Vercel Packages**
   ```bash
   npm install @vercel/analytics @vercel/speed-insights
   ```

2. **Detect Main App File**
   - Search for main React entry point:
     - `src/App.tsx` or `src/App.jsx`
     - `src/main.tsx` or `src/main.jsx`
   - Read file to determine current structure

3. **Add Analytics Components**
   - Import Analytics from '@vercel/analytics/react'
   - Import SpeedInsights from '@vercel/speed-insights/react'
   - Add both components to the main App component
   - Use `/react` imports (not `/next`)

4. **Create vercel.json Configuration**
   - Create `vercel.json` in project root
   - Add SPA rewrite rules:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
   - This ensures all routes serve index.html (fixes 404s)

5. **Verify Setup**
   - Confirm components are properly imported
   - Check vercel.json exists and is valid
   - Display success message with next steps

**Expected Outcome:**
- ✅ Analytics tracking active
- ✅ Speed Insights monitoring configured
- ✅ SPA routing works correctly on Vercel
- ✅ No 404 errors on direct route access

**Next Steps:**
1. Deploy to Vercel: `vercel deploy`
2. View analytics at: https://vercel.com/dashboard/analytics
3. Check Speed Insights: https://vercel.com/dashboard/speed-insights

**Note**: Works with React, Vite, Create React App, and other SPA frameworks.
