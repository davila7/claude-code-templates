# /svelte:a11y

Audit and improve accessibility in Svelte/SvelteKit applications, ensuring WCAG compliance and inclusive user experiences.

## Instructions

You are acting as the Svelte Development Agent focused on accessibility. When improving accessibility:

1. **Accessibility Audit**:
   - Run automated accessibility tests
   - Check WCAG 2.1 AA/AAA compliance
   - Test with screen readers
   - Verify keyboard navigation
   - Analyze color contrast
   - Review ARIA usage

2. **Common Issues & Fixes**:
   
   **Component Accessibility**:
   ```svelte
   <!-- Bad -->
   <div onclick={handleClick}>Click me</div>
   
   <!-- Good -->
   <button onclick={handleClick} aria-label="Action description">
     Click me
   </button>
   ```
   
   **Form Accessibility**:
   ```svelte
   <label for="email">Email Address</label>
   <input 
     id="email"
     type="email"
     required
     aria-describedby="email-error"
   />
   {#if errors.email}
     <span id="email-error" role="alert">
       {errors.email}
     </span>
   {/if}
   ```

3. **Navigation & Focus**:
   ```javascript
   // Skip links
   <a href="#main" class="skip-link">Skip to main content</a>
   
   // Focus management
   onMount(() => {
     if (shouldFocus) {
       element.focus();
     }
   });
   
   // Keyboard navigation
   function handleKeydown(event) {
     if (event.key === 'Escape') {
       closeModal();
     }
   }
   ```

4. **ARIA Implementation**:
   - Use semantic HTML first
   - Add ARIA labels for clarity
   - Implement live regions
   - Manage focus properly
   - Announce dynamic changes

5. **Testing Tools**:
   - Svelte a11y warnings
   - axe-core integration
   - Pa11y CI setup
   - Screen reader testing
   - Keyboard navigation testing

6. **Accessibility Checklist**:
   - [ ] All interactive elements keyboard accessible
   - [ ] Proper heading hierarchy
   - [ ] Images have alt text
   - [ ] Color contrast meets standards
   - [ ] Forms have proper labels
   - [ ] Error messages announced
   - [ ] Focus indicators visible
   - [ ] Page has unique title
   - [ ] Landmarks properly used
   - [ ] Animations respect prefers-reduced-motion

## Example Usage

User: "Audit my e-commerce site for accessibility issues"

Assistant will:
- Run automated accessibility scan
- Check product cards for proper markup
- Verify cart keyboard navigation
- Test checkout form accessibility
- Review color contrast on CTAs
- Add ARIA labels where needed
- Implement focus management
- Create accessibility test suite
- Provide WCAG compliance report