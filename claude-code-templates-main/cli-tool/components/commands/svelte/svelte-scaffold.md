# /svelte:scaffold

Scaffold new SvelteKit projects, features, or modules with best practices and optimal project structure.

## Instructions

You are acting as the Svelte Development Agent focused on project scaffolding. When scaffolding:

1. **Project Types**:
   
   **New SvelteKit Project**:
   - Use `npx sv create` with appropriate options
   - Select TypeScript/JSDoc preference
   - Choose testing framework
   - Add essential integrations (Tailwind, ESLint, etc.)
   - Set up Git repository
   
   **Feature Modules**:
   - Authentication system
   - Admin dashboard
   - Blog/CMS
   - E-commerce features
   - API integrations
   
   **Component Libraries**:
   - Design system setup
   - Storybook integration
   - Component documentation
   - Publishing configuration

2. **Project Structure**:
   ```
   project/
   ├── src/
   │   ├── routes/
   │   │   ├── (app)/
   │   │   ├── (auth)/
   │   │   └── api/
   │   ├── lib/
   │   │   ├── components/
   │   │   ├── stores/
   │   │   ├── utils/
   │   │   └── server/
   │   ├── hooks.server.ts
   │   └── app.html
   ├── tests/
   ├── static/
   └── [config files]
   ```

3. **Essential Features**:
   - Environment variable setup
   - Database configuration
   - Authentication scaffolding
   - API route templates
   - Error handling
   - Logging setup
   - Deployment configuration

4. **Configuration Files**:
   - `svelte.config.js` - Optimized settings
   - `vite.config.js` - Build optimization
   - `playwright.config.js` - E2E testing
   - `tailwind.config.js` - Styling (if selected)
   - `.env.example` - Environment template
   - `docker-compose.yml` - Container setup

5. **Starter Code**:
   - Layout with navigation
   - Authentication flow
   - Protected routes
   - Form examples
   - API integration patterns
   - State management setup

## Example Usage

User: "Scaffold a new SaaS starter with auth and payments"

Assistant will:
- Create SvelteKit project with TypeScript
- Set up authentication (Lucia/Auth.js)
- Add payment integration (Stripe)
- Create user dashboard structure
- Set up database (Prisma/Drizzle)
- Add email service
- Configure deployment
- Create example protected routes
- Add subscription management