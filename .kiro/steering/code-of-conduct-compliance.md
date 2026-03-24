---
inclusion: auto
---

# Code of Conduct Compliance in Development

When writing code, reviewing contributions, or interacting in this project, always respect and uphold the principles outlined in our Code of Conduct. This guide ensures your code and practices contribute to an open, welcoming, diverse, inclusive, and healthy community.

## Core Principles

### Empathy and Kindness
- Write code that is accessible to developers of all skill levels
- Provide helpful error messages that guide users toward solutions
- Create documentation that assumes no prior knowledge
- Use inclusive language in all code, comments, and documentation

### Respect and Inclusivity
- Avoid assumptions about users' backgrounds, abilities, or circumstances
- Design interfaces that work for people with diverse needs
- Use neutral, professional language in all communications
- Respect different coding styles and approaches

### Community Focus
- Prioritize features that benefit the broader community
- Consider the impact of your code on all users
- Share knowledge through clear documentation and comments
- Welcome and support new contributors

---

## Inclusive Code Practices

### 1. Accessible User Interfaces

#### Visual Accessibility
```jsx
// Γ£à GOOD: Accessible color contrast and alternatives
<button 
  className="bg-blue-600 hover:bg-blue-700 text-white"
  aria-label="Submit form"
>
  Submit
</button>

// Γ¥î BAD: Poor contrast, no alternative text
<button style={{ color: '#ccc', background: '#ddd' }}>
  <Icon />
</button>
```

#### Screen Reader Support
```jsx
// Γ£à GOOD: Proper ARIA labels and semantic HTML
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/home">Home</a></li>
    <li><a href="/about">About</a></li>
  </ul>
</nav>

<img src="/logo.png" alt="Company name - Home" />

// Γ¥î BAD: No semantic meaning or labels
<div onClick={navigate}>
  <div>Home</div>
</div>
<img src="/logo.png" />
```

#### Keyboard Navigation
```jsx
// Γ£à GOOD: Keyboard accessible
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyPress={(e) => e.key === 'Enter' && handleClick()}
>
  Click me
</div>

// Γ¥î BAD: Mouse-only interaction
<div onClick={handleClick}>
  Click me
</div>
```

### 2. Inclusive Language

#### Variable and Function Names
```javascript
// Γ£à GOOD: Neutral, descriptive names
const allowedUsers = [];
const blockedUsers = [];
const primaryDatabase = db1;
const replicaDatabase = db2;

// Γ¥î AVOID: Terms with problematic connotations
const whitelist = [];
const blacklist = [];
const master = db1;
const slave = db2;
```

#### User-Facing Text
```javascript
// Γ£à GOOD: Inclusive, neutral language
const messages = {
  welcome: "Welcome! Let's get started.",
  error: "Something went wrong. Please try again.",
  help: "Need assistance? We're here to help.",
};

// Γ£à GOOD: Gender-neutral terms
const roles = ['developer', 'maintainer', 'contributor'];

// Γ¥î AVOID: Gendered or exclusive language
const roles = ['guys', 'chairman', 'manpower'];
```

#### Comments and Documentation
```javascript
// Γ£à GOOD: Professional, helpful comments
// This function validates user input to prevent injection attacks
// Returns true if input is safe, false otherwise
function validateInput(input) {
  // Check for common attack patterns
  return !/<script|javascript:/i.test(input);
}

// Γ¥î AVOID: Dismissive or condescending comments
// Obviously, you need to validate input, dummy
// Any idiot knows this prevents XSS
function validateInput(input) {
  return !/<script/i.test(input);
}
```

### 3. Error Messages and User Feedback

#### Helpful Error Messages
```javascript
// Γ£à GOOD: Clear, actionable error messages
throw new Error(
  'Unable to connect to database. Please check your DATABASE_URL environment variable and ensure the database server is running.'
);

// Γ£à GOOD: User-friendly validation messages
const errors = {
  email: 'Please enter a valid email address (e.g., user@example.com)',
  password: 'Password must be at least 8 characters and include a number',
};

// Γ¥î BAD: Vague or technical jargon
throw new Error('DB connection failed: ECONNREFUSED');
const errors = { email: 'Invalid', password: 'Bad format' };
```

#### Constructive Feedback
```javascript
// Γ£à GOOD: Guides user toward solution
if (!isValidFormat(data)) {
  return {
    success: false,
    message: 'The data format is incorrect. Expected format: { name: string, age: number }',
    example: { name: 'John Doe', age: 30 },
  };
}

// Γ¥î BAD: Blames user without guidance
if (!isValidFormat(data)) {
  return { success: false, message: 'You provided invalid data' };
}
```

### 4. Internationalization and Localization

#### Support Multiple Languages
```javascript
// Γ£à GOOD: Externalized strings for translation
import { t } from './i18n';

const welcomeMessage = t('welcome.message');
const buttonText = t('actions.submit');

// Γ¥î BAD: Hardcoded English strings
const welcomeMessage = 'Welcome to our app!';
const buttonText = 'Submit';
```

#### Date, Time, and Number Formatting
```javascript
// Γ£à GOOD: Locale-aware formatting
const formatter = new Intl.DateTimeFormat(userLocale, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
const formattedDate = formatter.format(new Date());

// Γ£à GOOD: Currency formatting
const price = new Intl.NumberFormat(userLocale, {
  style: 'currency',
  currency: userCurrency,
}).format(amount);

// Γ¥î BAD: Assumes US format
const formattedDate = `${month}/${day}/${year}`;
const price = `$${amount}`;
```

### 5. Diverse User Scenarios

#### Name Handling
```javascript
// Γ£à GOOD: Flexible name handling
interface User {
  displayName: string;  // Single field for how user wants to be addressed
  fullName?: string;    // Optional full legal name
}

// Γ¥î BAD: Assumes Western naming conventions
interface User {
  firstName: string;
  middleName: string;
  lastName: string;
}
```

#### Address and Location
```javascript
// Γ£à GOOD: Flexible address structure
interface Address {
  lines: string[];      // Multiple address lines
  city: string;
  region?: string;      // State/Province/Region (optional)
  postalCode?: string;  // Not all countries use postal codes
  country: string;
}

// Γ¥î BAD: Assumes US address format
interface Address {
  street: string;
  city: string;
  state: string;        // Not applicable to all countries
  zipCode: string;      // US-specific term
}
```

#### Phone Numbers
```javascript
// Γ£à GOOD: International phone number support
interface Contact {
  phoneNumber: string;  // Store with country code
  phoneCountryCode: string;  // e.g., "+1", "+44"
}

// Validation allows various formats
const isValidPhone = /^\+?[1-9]\d{1,14}$/.test(phone);

// Γ¥î BAD: Assumes US format
const isValidPhone = /^\(\d{3}\) \d{3}-\d{4}$/.test(phone);
```

---

## Accessibility Standards

### WCAG 2.1 Compliance Checklist

#### Level A (Minimum)
- [ ] All images have alt text
- [ ] Form inputs have labels
- [ ] Color is not the only means of conveying information
- [ ] Keyboard navigation works for all interactive elements
- [ ] Page has a logical heading structure (h1, h2, h3)

#### Level AA (Recommended)
- [ ] Color contrast ratio is at least 4.5:1 for normal text
- [ ] Color contrast ratio is at least 3:1 for large text
- [ ] Text can be resized up to 200% without loss of functionality
- [ ] Focus indicators are visible
- [ ] Error messages are clear and associated with inputs

#### Level AAA (Enhanced)
- [ ] Color contrast ratio is at least 7:1 for normal text
- [ ] No time limits on user actions (or can be extended)
- [ ] Animations can be paused or disabled

### Testing for Accessibility
```bash
# Automated accessibility testing
npx @axe-core/cli https://your-site.com

# Lighthouse accessibility audit
npx lighthouse https://your-site.com --only-categories=accessibility

# Check color contrast
# Use browser DevTools or online tools like WebAIM Contrast Checker
```

---

## Inclusive Development Practices

### 1. Code Reviews

#### Giving Feedback
```markdown
Γ£à GOOD: Constructive and respectful
"I noticed this function could be simplified. Here's a suggestion:
[code example]
This approach would improve readability and performance. What do you think?"

Γ¥î BAD: Dismissive or condescending
"This code is terrible. Why would you do it this way? Obviously, you should..."
```

#### Receiving Feedback
- Accept feedback gracefully
- Ask clarifying questions if needed
- Recognize that different approaches can be valid
- Thank reviewers for their time and insights

### 2. Documentation

#### Write for All Skill Levels
```markdown
Γ£à GOOD: Clear, beginner-friendly
## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with your configuration:
   ```
   DATABASE_URL=your_database_url
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

The app will be available at http://localhost:3000

Γ¥î BAD: Assumes knowledge
## Setup
Run it. You know what to do.
```

#### Provide Context
```javascript
// Γ£à GOOD: Explains the "why"
/**
 * Debounces the search function to reduce API calls.
 * 
 * Without debouncing, every keystroke would trigger an API request,
 * which could overwhelm the server and create a poor user experience.
 * 
 * @param {string} query - The search query
 * @param {number} delay - Delay in milliseconds (default: 300)
 */
function debouncedSearch(query, delay = 300) {
  // Implementation
}

// Γ¥î BAD: States the obvious
// This function searches
function search(query) {
  // Implementation
}
```

### 3. Welcoming New Contributors

#### Good First Issues
- Label beginner-friendly issues clearly
- Provide detailed descriptions and context
- Offer to help if contributors get stuck
- Celebrate first contributions

#### Contribution Guidelines
```markdown
Γ£à GOOD: Welcoming and clear
# Contributing

We welcome contributions from everyone! Whether you're fixing a typo,
adding a feature, or improving documentation, your help is appreciated.

## First Time Contributing?
No problem! Here's how to get started:
1. Fork the repository
2. Create a branch for your changes
3. Make your changes and test them
4. Submit a pull request

Need help? Feel free to ask questions in the issue or reach out to
the maintainers. We're here to help!

Γ¥î BAD: Intimidating or vague
# Contributing
Submit PRs. Follow the rules. Don't break things.
```

---

## Privacy and Security

### Respect User Privacy
```javascript
// Γ£à GOOD: Minimal data collection with consent
const analytics = {
  trackPageView: (page) => {
    if (userConsent.analytics) {
      // Only track if user consented
      track('pageview', { page });
    }
  },
};

// Γ¥î BAD: Tracking without consent
const analytics = {
  trackPageView: (page) => {
    track('pageview', { page, userId, email, location });
  },
};
```

### Secure User Data
```javascript
// Γ£à GOOD: Proper data protection
const user = await getUser(userId);
// Remove sensitive fields before sending to client
const publicUser = {
  id: user.id,
  displayName: user.displayName,
  avatar: user.avatar,
  // Do NOT include: email, password, phone, address
};

// Γ¥î BAD: Exposing sensitive data
const user = await getUser(userId);
res.json(user); // Sends everything including sensitive data
```

---

## Enforcement and Reporting

### If You Witness Violations
- Report to community leaders at dan.avila7@gmail.com
- Provide specific details about the incident
- Include relevant context (links, screenshots if appropriate)
- Trust that reports will be handled fairly and confidentially

### If You Make a Mistake
- Acknowledge it promptly
- Apologize sincerely to those affected
- Learn from the experience
- Make necessary corrections
- Move forward with improved understanding

---

## Checklist: Code of Conduct Compliance

Before submitting code, verify:

### Accessibility
- [ ] All interactive elements are keyboard accessible
- [ ] Images have descriptive alt text
- [ ] Color contrast meets WCAG AA standards
- [ ] Form inputs have associated labels
- [ ] ARIA attributes are used appropriately

### Inclusive Language
- [ ] Variable names use neutral terminology
- [ ] Comments are professional and helpful
- [ ] Error messages are constructive, not blaming
- [ ] Documentation is welcoming to all skill levels

### Internationalization
- [ ] Text strings are externalized for translation
- [ ] Date/time/number formatting is locale-aware
- [ ] No assumptions about name formats or addresses
- [ ] Phone number handling supports international formats

### Privacy & Security
- [ ] User data is protected and minimized
- [ ] Consent is obtained before tracking
- [ ] Sensitive information is not logged or exposed
- [ ] Privacy policy is clear and accessible

### Community
- [ ] Code reviews are constructive and respectful
- [ ] Documentation helps newcomers get started
- [ ] Contributions are welcomed and celebrated
- [ ] Feedback is given with empathy and kindness

---

## Resources

### Accessibility
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

### Inclusive Language
- [Inclusive Naming Initiative](https://inclusivenaming.org/)
- [Google Developer Style Guide](https://developers.google.com/style/inclusive-documentation)
- [Microsoft Bias-Free Communication](https://docs.microsoft.com/en-us/style-guide/bias-free-communication)

### Internationalization
- [W3C Internationalization](https://www.w3.org/International/)
- [Unicode CLDR](https://cldr.unicode.org/)
- [Moment.js i18n](https://momentjs.com/docs/#/i18n/)

---

## Summary

By following these practices, you ensure that:
- Γ£à Code is accessible to users with diverse abilities
- Γ£à Language is inclusive and welcoming
- Γ£à Interfaces work for international audiences
- Γ£à User privacy is respected
- Γ£à Community is healthy and supportive
- Γ£à All contributors feel valued and respected

**Remember**: Code is written for humans, not just machines. Every line of code, comment, and interaction is an opportunity to create a more inclusive and welcoming community.
