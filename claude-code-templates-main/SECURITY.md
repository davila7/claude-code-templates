# Security Policy

Thank you for helping us keep Claude Code Templates and the systems they interact with secure.

## Reporting Security Issues

This project is maintained by Daniel Avila.

The security of our CLI tool and the templates it generates is our top priority. We appreciate the work of security researchers acting in good faith in identifying and reporting potential vulnerabilities.

## How to Report a Vulnerability

If you discover a security vulnerability in Claude Code Templates, please report it to us in one of the following ways:

### Email
Send details of the vulnerability to [dan.avila7@gmail.com](mailto:dan.avila7@gmail.com) with the subject line "SECURITY: Claude Code Templates Vulnerability Report"

### GitHub Security Advisories
You can also report vulnerabilities through [GitHub Security Advisories](https://github.com/davila7/claude-code-templates/security/advisories/new) for this repository.

## What to Include in Your Report

To help us understand and resolve the issue quickly, please include:

- **Description**: A clear description of the vulnerability
- **Impact**: What an attacker could achieve by exploiting this vulnerability
- **Steps to Reproduce**: Detailed steps to reproduce the vulnerability
- **Affected Versions**: Which versions of the CLI tool are affected
- **Environment**: Operating system, Node.js version, and any other relevant details
- **Proof of Concept**: If possible, include a minimal example demonstrating the vulnerability

## Security Best Practices

When using Claude Code Templates:

### For Users
- **Keep Updated**: Always use the latest version via `npx claude-code-templates@latest`
- **Review Templates**: Check generated files before committing to your repository
- **Audit Hooks**: Review automation hooks before enabling them
- **Secure Environment**: Use the tool in a secure development environment

### For Contributors
- **Dependency Scanning**: Run `npm audit` before submitting changes
- **Input Validation**: Validate all user inputs and file paths
- **Secure Defaults**: Choose secure defaults for all template configurations
- **Code Review**: All changes undergo security-focused code review

## Contact Information

- **Maintainer**: Daniel Avila
- **Website**: [danielavila.me](https://danielavila.me)
- **Email**: [dan.avila7@gmail.com](mailto:dan.avila7@gmail.com)
- **GitHub**: [@davila7](https://github.com/davila7)

## Legal

This security policy is designed to encourage responsible security research. We will not pursue legal action against researchers who:

- Act in good faith
- Follow responsible disclosure practices
- Do not access or modify user data
- Do not perform testing on systems they do not own
- Report vulnerabilities through the channels described above

Thank you for helping keep Claude Code Templates secure!