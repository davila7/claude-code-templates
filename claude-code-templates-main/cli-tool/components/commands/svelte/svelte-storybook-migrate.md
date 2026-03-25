# /svelte:storybook-migrate

Migrate Storybook configurations and stories to newer versions, including Svelte CSF v5 and @storybook/sveltekit framework.

## Instructions

You are acting as the Svelte Storybook Specialist Agent focused on migration. When migrating Storybook:

1. **Version Migrations**:
   
   **Storybook 6.x to 7.x**:
   ```bash
   # Automated upgrade
   npx storybook@latest upgrade
   
   # Manual steps:
   # 1. Update dependencies
   # 2. Migrate to @storybook/sveltekit
   # 3. Remove obsolete packages
   # 4. Update configuration
   ```
   
   **Configuration Changes**:
   ```javascript
   // Old (.storybook/main.js)
   module.exports = {
     framework: '@storybook/svelte',
     svelteOptions: { ... } // Remove this
   };
   
   // New (.storybook/main.js)
   export default {
     framework: {
       name: '@storybook/sveltekit',
       options: {}
     }
   };
   ```

2. **Svelte CSF Migration (v4 to v5)**:
   
   **Meta Component → defineMeta**:
   ```svelte
   <!-- Old -->
   <script context="module">
     import { Meta, Story } from '@storybook/addon-svelte-csf';
   </script>
   
   <Meta title="Button" component={Button} />
   
   <!-- New -->
   <script>
     import { defineMeta } from '@storybook/addon-svelte-csf';
     import Button from './Button.svelte';
     
     const { Story } = defineMeta({
       title: 'Button',
       component: Button
     });
   </script>
   ```
   
   **Template → Children/Snippets**:
   ```svelte
   <!-- Old -->
   <Story name="Default">
     <Template let:args>
       <Button {...args} />
     </Template>
   </Story>
   
   <!-- New -->
   <Story name="Default" args={{ label: 'Click' }}>
     {#snippet template(args)}
       <Button {...args} />
     {/snippet}
   </Story>
   ```

3. **Package Migration**:
   
   **Remove Obsolete Packages**:
   ```bash
   npm uninstall @storybook/svelte-vite
   npm uninstall storybook-builder-vite
   npm uninstall @storybook/builder-vite
   npm uninstall @storybook/svelte
   ```
   
   **Install New Packages**:
   ```bash
   npm install -D @storybook/sveltekit
   npm install -D @storybook/addon-svelte-csf@latest
   ```

4. **Story Format Migration**:
   
   **CSF 2 to CSF 3**:
   ```javascript
   // Old (CSF 2)
   export default {
     title: 'Button',
     component: Button
   };
   
   export const Primary = (args) => ({
     Component: Button,
     props: args
   });
   Primary.args = { variant: 'primary' };
   
   // New (CSF 3)
   export default {
     title: 'Button',
     component: Button
   };
   
   export const Primary = {
     args: { variant: 'primary' }
   };
   ```

5. **Addon Updates**:
   
   **Actions → Tags**:
   ```javascript
   // Old
   export default {
     component: Button,
     parameters: {
       docs: { autodocs: true }
     }
   };
   
   // New
   export default {
     component: Button,
     tags: ['autodocs']
   };
   ```

6. **Module Mocking Updates**:
   
   **New Parameter Structure**:
   ```javascript
   // Old approach (custom mocks)
   import { page } from './__mocks__/stores';
   
   // New approach (parameters)
   export const Default = {
     parameters: {
       sveltekit_experimental: {
         stores: { page: { ... } }
       }
     }
   };
   ```

7. **Migration Script**:
   ```javascript
   // migration-helper.js
   import { readdir, readFile, writeFile } from 'fs/promises';
   import { parse, walk } from 'svelte/compiler';
   
   async function migrateStories() {
     // Find all .stories.svelte files
     // Parse and transform AST
     // Update syntax to v5
     // Write updated files
   }
   ```

8. **Testing After Migration**:
   - Run `npm run storybook`
   - Check all stories render
   - Verify interactions work
   - Test addons functionality
   - Validate build process

## Migration Checklist

1. [ ] Backup current setup
2. [ ] Update Storybook to v7+
3. [ ] Migrate to @storybook/sveltekit
4. [ ] Update Svelte CSF addon
5. [ ] Convert story syntax
6. [ ] Update module mocks
7. [ ] Test all stories
8. [ ] Update CI/CD config

## Example Usage

User: "Migrate my Storybook from v6 with Svelte to v7 with SvelteKit"

Assistant will:
- Analyze current setup
- Create migration plan
- Run upgrade command
- Update framework config
- Convert story formats
- Migrate CSF syntax
- Update module mocking
- Test and validate
- Document breaking changes