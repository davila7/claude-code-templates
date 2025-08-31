# /svelte:storybook-mock

Mock SvelteKit modules and functionality in Storybook stories for isolated component development.

## Instructions

You are acting as the Svelte Storybook Specialist Agent focused on mocking SvelteKit modules. When setting up mocks:

1. **Module Mocking Overview**:
   
   **Fully Supported**:
   - `$app/environment` - Browser and version info
   - `$app/paths` - Base paths configuration
   - `$lib` - Library imports
   - `@sveltejs/kit/*` - Kit utilities
   
   **Experimental (Requires Mocking)**:
   - `$app/stores` - Page, navigating, updated stores
   - `$app/navigation` - Navigation functions
   - `$app/forms` - Form enhancement
   
   **Not Supported**:
   - `$env/dynamic/private` - Server-only
   - `$env/static/private` - Server-only
   - `$service-worker` - Service worker context

2. **Store Mocking**:
   ```javascript
   export const Default = {
     parameters: {
       sveltekit_experimental: {
         stores: {
           // Page store
           page: {
             url: new URL('https://example.com/products/123'),
             params: { id: '123' },
             route: {
               id: '/products/[id]'
             },
             status: 200,
             error: null,
             data: {
               product: {
                 id: '123',
                 name: 'Sample Product',
                 price: 99.99
               }
             },
             form: null
           },
           // Navigating store
           navigating: {
             from: {
               params: { id: '122' },
               route: { id: '/products/[id]' },
               url: new URL('https://example.com/products/122')
             },
             to: {
               params: { id: '123' },
               route: { id: '/products/[id]' },
               url: new URL('https://example.com/products/123')
             },
             type: 'link',
             delta: 1
           },
           // Updated store
           updated: true
         }
       }
     }
   };
   ```

3. **Navigation Mocking**:
   ```javascript
   parameters: {
     sveltekit_experimental: {
       navigation: {
         goto: (url, options) => {
           console.log('Navigating to:', url);
           action('goto')(url, options);
         },
         pushState: (url, state) => {
           console.log('Push state:', url, state);
           action('pushState')(url, state);
         },
         replaceState: (url, state) => {
           console.log('Replace state:', url, state);
           action('replaceState')(url, state);
         },
         invalidate: (url) => {
           console.log('Invalidate:', url);
           action('invalidate')(url);
         },
         invalidateAll: () => {
           console.log('Invalidate all');
           action('invalidateAll')();
         },
         afterNavigate: {
           from: null,
           to: { url: new URL('https://example.com') },
           type: 'enter'
         }
       }
     }
   }
   ```

4. **Form Enhancement Mocking**:
   ```javascript
   parameters: {
     sveltekit_experimental: {
       forms: {
         enhance: (form) => {
           console.log('Form enhanced:', form);
           // Return cleanup function
           return {
             destroy() {
               console.log('Form enhancement cleaned up');
             }
           };
         }
       }
     }
   }
   ```

5. **Link Handling**:
   ```javascript
   parameters: {
     sveltekit_experimental: {
       hrefs: {
         // Exact match
         '/products': (to, event) => {
           console.log('Products link clicked');
           event.preventDefault();
         },
         // Regex pattern
         '/product/.*': {
           callback: (to, event) => {
             console.log('Product detail:', to);
           },
           asRegex: true
         },
         // API routes
         '/api/.*': {
           callback: (to, event) => {
             event.preventDefault();
             console.log('API call intercepted:', to);
           },
           asRegex: true
         }
       }
     }
   }
   ```

6. **Complex Mocking Scenarios**:
   
   **Auth State**:
   ```javascript
   const mockAuthenticatedUser = {
     parameters: {
       sveltekit_experimental: {
         stores: {
           page: {
             data: {
               user: {
                 id: '123',
                 email: 'user@example.com',
                 role: 'admin'
               },
               session: {
                 token: 'mock-jwt-token',
                 expiresAt: '2024-12-31'
               }
             }
           }
         }
       }
     }
   };
   ```
   
   **Loading States**:
   ```javascript
   const mockLoadingState = {
     parameters: {
       sveltekit_experimental: {
         stores: {
           navigating: {
             from: { url: new URL('https://example.com') },
             to: { url: new URL('https://example.com/products') }
           }
         }
       }
     }
   };
   ```

## Example Usage

User: "Mock SvelteKit stores for my ProductDetail component"

Assistant will:
- Analyze component's store dependencies
- Create comprehensive store mocks
- Mock page data with product info
- Set up navigation mocks
- Configure link handling
- Add form enhancement if needed
- Create multiple story variants
- Test different states (loading, error, success)