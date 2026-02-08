# Netlify Deployment Patterns

Common deployment scenarios and best practices for the Netlify skill.

## Deployment Decision Tree

```
Is user authenticated?
├─ No → Run `netlify login`
└─ Yes → Is site linked?
    ├─ No → Is it a Git repo?
    │   ├─ Yes → Try `netlify link --git-remote-url`
    │   │   ├─ Success → Continue to deploy
    │   │   └─ Fail → Run `netlify init`
    │   └─ No → Run `netlify init`
    └─ Yes → Is this first deploy or existing site?
        ├─ First deploy/new site → `netlify deploy --prod`
        └─ Existing site → `netlify deploy` (preview)
```

## Scenario 1: First-Time Deployment (New Project)

**Context**: User has a project that has never been deployed to Netlify.

**Steps**:
1. Check authentication: `npx netlify status`
2. If not authenticated: `npx netlify login`
3. Initialize new site: `npx netlify init`
   - This guides user through setup
   - Creates netlify.toml if needed
4. Install dependencies: `npm install`
5. Deploy to production: `npx netlify deploy --prod`

**Example**:
```bash
npx netlify status
# Not linked to a site

npx netlify login
# Opens browser for authentication

npx netlify init
# Walks through site creation

npm install
npx netlify deploy --prod
```

## Scenario 2: Linking Existing Git Repository to Existing Site

**Context**: User has a site already on Netlify and wants to link their local repo.

**Steps**:
1. Check authentication: `npx netlify status`
2. Get Git remote: `git remote show origin`
3. Extract URL (e.g., `https://github.com/user/repo.git`)
4. Link by remote: `npx netlify link --git-remote-url <URL>`
5. If found, linked. If not, run `netlify init`

**Example**:
```bash
git remote show origin
# * remote origin
#   Fetch URL: https://github.com/user/my-app.git

npx netlify link --git-remote-url https://github.com/user/my-app.git
# Site linked successfully
```

## Scenario 3: Preview Deployment (Testing Changes)

**Context**: User wants to test changes before pushing to production.

**Steps**:
1. Ensure site is linked: `npx netlify status`
2. Make code changes
3. Deploy preview: `npx netlify deploy`
4. Review preview URL
5. If approved, deploy to prod: `npx netlify deploy --prod`

**Example**:
```bash
# Make changes to code

npx netlify deploy
# Draft deploy URL: https://507f1f77bcf86cd799439011-my-app.netlify.app

# Test the preview, then:
npx netlify deploy --prod
```

## Scenario 4: Framework-Specific Deployments

### Next.js

```bash
# Next.js typically uses .next as output
npx netlify deploy --prod

# netlify.toml should have:
# [build]
#   command = "npm run build"
#   publish = ".next"
```

### React (Vite)

```bash
# Vite outputs to dist by default
npm run build
npx netlify deploy --dir=dist --prod

# netlify.toml:
# [build]
#   command = "npm run build"
#   publish = "dist"
```

### Static HTML

```bash
# No build step needed
npx netlify deploy --dir=. --prod
```

## Scenario 5: Monorepo Deployment

**Context**: Project is in a subdirectory of a monorepo.

**Steps**:
1. Navigate to project subdirectory: `cd packages/frontend`
2. Or set base in netlify.toml:
   ```toml
   [build]
     base = "packages/frontend"
     command = "npm run build"
     publish = "dist"
   ```
3. Deploy normally: `npx netlify deploy --prod`

## Scenario 6: Environment Variables

**Context**: Project needs secrets or environment-specific config.

**Steps**:
1. Never commit secrets to Git
2. Set in Netlify dashboard or CLI:
   ```bash
   npx netlify env:set API_KEY "secret_value"
   npx netlify env:set NODE_ENV "production"
   ```
3. Access in code: `process.env.API_KEY`
4. Deploy: `npx netlify deploy --prod`

## Scenario 7: Custom Domain Setup

**Context**: User wants to use a custom domain.

**Steps**:
1. Deploy site first: `npx netlify deploy --prod`
2. Add domain via dashboard or CLI:
   ```bash
   npx netlify open:admin
   # Navigate to Domain settings
   ```
3. Update DNS records as instructed by Netlify
4. Wait for DNS propagation (can take up to 48 hours)

## Best Practices

### 1. Always Preview First

```bash
# Deploy preview
npx netlify deploy

# Test thoroughly
# Then deploy to production
npx netlify deploy --prod
```

### 2. Use netlify.toml for Consistency

Create a `netlify.toml` file in your repo root:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

This ensures consistent builds across all deployments.

### 3. Framework Detection

Let Netlify auto-detect when possible. Only specify build settings if:
- Netlify can't detect your framework
- You need custom build commands
- Your project has a non-standard structure

### 4. Dependency Installation

Always ensure dependencies are installed before deploying:

```bash
npm install  # or yarn install, pnpm install
npx netlify deploy
```

### 5. Build Locally First

Test builds locally before deploying:

```bash
npm run build
# Check that build output exists

npx netlify deploy --dir=dist
```

### 6. Use Deploy Messages

Add context to deployments:

```bash
npx netlify deploy --prod --message="Fix login bug"
```

## Error Recovery Patterns

### "Publish directory not found"

**Cause**: Build command didn't create expected output directory.

**Fix**:
1. Run build locally: `npm run build`
2. Check output directory name
3. Update netlify.toml or CLI prompts with correct path

### "Command failed with exit code 1"

**Cause**: Build command failed.

**Fix**:
1. Check build logs for specific error
2. Run build locally to reproduce: `npm run build`
3. Fix the build error
4. Deploy again

### "Not logged in"

**Cause**: Authentication token expired or missing.

**Fix**:
```bash
npx netlify logout
npx netlify login
```

### "No site linked"

**Cause**: Project not connected to a Netlify site.

**Fix**:
```bash
# Try linking to existing site
npx netlify link

# Or create new site
npx netlify init
```

## Performance Tips

1. **Enable processing** in netlify.toml for auto-optimization:
   ```toml
   [build.processing.css]
     bundle = true
     minify = true
   ```

2. **Use caching headers** for static assets:
   ```toml
   [[headers]]
     for = "/assets/*"
     [headers.values]
       Cache-Control = "public, max-age=31536000, immutable"
   ```

3. **Optimize images** before deploying or use Netlify Image CDN

4. **Use Netlify Functions** for serverless backend (avoid external API calls when possible)

## Resources

- Netlify CLI Documentation: https://docs.netlify.com/cli/get-started/
- Framework Integration Guides: https://docs.netlify.com/frameworks/
- Build Configuration: https://docs.netlify.com/configure-builds/
