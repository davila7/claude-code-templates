---
sidebar_position: 3
---

# Available Templates

Claude Code Templates provides ready-to-use configurations for popular programming languages and frameworks. Each template includes optimized `CLAUDE.md` files, development commands, and best practices.

## JavaScript/TypeScript Templates

### React Application
**Command**: `claude-code-templates react`
- Modern React setup with TypeScript support
- Component development best practices
- Testing configuration with Jest and React Testing Library
- Build and deployment scripts

### Vue Application  
**Command**: `claude-code-templates vue`
- Vue 3 with Composition API
- TypeScript integration
- Vite build system
- Component testing setup

### Angular Application
**Command**: `claude-code-templates angular`
- Angular CLI project structure
- TypeScript and RxJS patterns
- Testing with Jasmine and Karma
- Production build optimization

### Node.js API
**Command**: `claude-code-templates node-api`
- Express.js server setup
- RESTful API structure
- Database integration patterns
- Authentication and middleware
- Docker configuration

## Python Templates

### Django Application
**Command**: `claude-code-templates django`
- Django project with best practices
- Model-View-Template structure
- Database migrations setup
- Admin interface configuration
- Testing with pytest

### FastAPI Application
**Command**: `claude-code-templates fastapi`
- Modern async API framework
- Automatic API documentation
- Pydantic models for validation
- Database integration with SQLAlchemy
- Docker and production deployment

### Flask Application
**Command**: `claude-code-templates flask`
- Lightweight web framework
- Blueprint structure for scalability
- Database integration with Flask-SQLAlchemy
- Authentication setup
- Testing configuration

## Ruby Templates

### Rails Application
**Command**: `claude-code-templates rails`
- Ruby on Rails MVC framework
- Active Record ORM setup
- RESTful routing conventions
- Testing with RSpec
- Asset pipeline configuration

## Go Templates

### Web Service
**Command**: `claude-code-templates go-web`
- HTTP server with Gorilla Mux
- Middleware setup
- JSON API endpoints
- Database integration
- Docker containerization

### CLI Tool
**Command**: `claude-code-templates go-cli`
- Command-line application structure
- Cobra CLI framework
- Configuration management
- Cross-platform builds

## Rust Templates

### System Programming
**Command**: `claude-code-templates rust-system`
- Cargo project setup
- Error handling patterns
- Testing configuration
- Performance optimization guides

## Common Features

All templates include:

### CLAUDE.md Configuration
Each template comes with a comprehensive `CLAUDE.md` file containing:
- Project overview and structure
- Development commands and workflows
- Code style guidelines
- Testing instructions
- Deployment procedures

### Development Commands
Pre-configured scripts for:
- **Installation**: `npm install`, `pip install -r requirements.txt`, etc.
- **Development**: `npm run dev`, `python manage.py runserver`, etc.
- **Testing**: `npm test`, `pytest`, `cargo test`, etc.
- **Building**: `npm run build`, `go build`, etc.
- **Linting**: `eslint`, `flake8`, `rustfmt`, etc.

### Best Practices
- Code organization patterns
- Naming conventions
- Security considerations
- Performance optimization
- Documentation standards

### Testing Setup
- Unit testing frameworks
- Integration testing patterns
- Mocking and test data
- Coverage reporting
- CI/CD integration

## Template Structure

Each template follows this structure:
```
template-name/
├── CLAUDE.md              # Claude Code configuration
├── README.md              # Template documentation
├── src/                   # Source code
├── tests/                 # Test files
├── docs/                  # Additional documentation
└── config/                # Configuration files
```

## Custom Templates

Want to create your own template? Follow these guidelines:

1. **Create Template Directory**: Organize files in the appropriate language folder
2. **Add CLAUDE.md**: Include comprehensive project instructions
3. **Document Commands**: List all development, testing, and deployment commands
4. **Include Examples**: Provide sample code and usage patterns
5. **Test Thoroughly**: Ensure the template works in different environments

### Contribution Process

1. Fork the repository
2. Create your template in the appropriate directory
3. Test the template installation and usage
4. Submit a pull request with:
   - Template description
   - Usage instructions
   - Screenshots or examples

## Getting Started

To use any template:

1. **Install the CLI**: `npm install -g claude-code-templates`
2. **Run Interactive Mode**: `claude-code-templates`
3. **Select Your Template**: Choose from the available options
4. **Follow Setup Instructions**: Complete any additional configuration
5. **Start Developing**: Use the provided commands and guidelines

Visit our [Template Marketplace](https://davila7.github.io/claude-code-templates/) to browse all templates with detailed descriptions and instant copy-paste commands.