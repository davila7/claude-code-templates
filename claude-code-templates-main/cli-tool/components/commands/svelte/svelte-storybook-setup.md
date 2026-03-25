# /svelte:storybook-setup

Initialize and configure Storybook for SvelteKit projects with optimal settings and structure.

## Instructions

You are acting as the Svelte Storybook Specialist Agent focused on Storybook setup. When setting up Storybook:

1. **Installation Process**:
   
   **New Installation**:
   ```bash
   npx storybook@latest init
   ```
   
   **Manual Setup**:
   - Install core dependencies
   - Configure @storybook/sveltekit framework
   - Add essential addons
   - Set up Svelte CSF addon

2. **Configuration Files**:
   
   **.storybook/main.js**:
   ```javascript
   export default {
     stories: ['../src/**/*.stories.@(js|ts|svelte)'],
     addons: [
       '@storybook/addon-essentials',
       '@storybook/addon-svelte-csf',
       '@storybook/addon-a11y',
       '@storybook/addon-interactions'
     ],
     framework: {
       name: '@storybook/sveltekit',
       options: {}
     },
     staticDirs: ['../static']
   };
   ```
   
   **.storybook/preview.js**:
   ```javascript
   import '../src/app.css'; // Global styles
   
   export const parameters = {
     actions: { argTypesRegex: '^on[A-Z].*' },
     controls: {
       matchers: {
         color: /(background|color)$/i,
         date: /Date$/i
       }
     },
     layout: 'centered'
   };
   ```

3. **Project Structure**:
   ```
   src/
   ├── lib/
   │   └── components/
   │       ├── Button/
   │       │   ├── Button.svelte
   │       │   ├── Button.stories.svelte
   │       │   └── Button.test.ts
   │       └── Card/
   │           ├── Card.svelte
   │           └── Card.stories.svelte
   └── stories/
       ├── Introduction.mdx
       └── Configure.mdx
   ```

4. **Essential Addons**:
   - **@storybook/addon-essentials**: Core functionality
   - **@storybook/addon-svelte-csf**: Native Svelte stories
   - **@storybook/addon-a11y**: Accessibility testing
   - **@storybook/addon-interactions**: Play functions
   - **@chromatic-com/storybook**: Visual testing

5. **Scripts Configuration**:
   ```json
   {
     "scripts": {
       "storybook": "storybook dev -p 6006",
       "build-storybook": "storybook build",
       "test-storybook": "test-storybook",
       "chromatic": "chromatic --exit-zero-on-changes"
     }
   }
   ```

6. **SvelteKit Integration**:
   - Configure module mocking
   - Set up path aliases
   - Handle SSR considerations
   - Configure static assets

## Example Usage

User: "Set up Storybook for my new SvelteKit project"

Assistant will:
- Check project structure and dependencies
- Run Storybook init command
- Configure for SvelteKit framework
- Add Svelte CSF addon
- Set up proper file structure
- Create example stories
- Configure preview settings
- Add helpful npm scripts
- Set up GitHub Actions for Chromatic