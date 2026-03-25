# Project Setup Helper

Set up new projects with proper structure and best practices.

## Purpose

This command helps you set up new projects with proper directory structure, configuration files, and development environment.

## Usage

```
/project-setup
```

## What this command does

1. **Creates project structure** with standard directories
2. **Sets up configuration files** (.gitignore, README, etc.)
3. **Initializes version control** and development tools
4. **Configures environment files** and dependencies
5. **Follows language-specific** conventions and best practices

## Project Structure Templates

### Generic Project Structure
```
project-name/
├── README.md                 # Project documentation
├── .gitignore               # Git ignore rules
├── .env.example             # Environment variables template
├── LICENSE                  # Project license
├── CHANGELOG.md             # Version history
├── docs/                    # Documentation
│   ├── API.md
│   ├── CONTRIBUTING.md
│   └── DEPLOYMENT.md
├── src/                     # Source code
│   ├── main/
│   ├── utils/
│   └── config/
├── tests/                   # Test files
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── scripts/                 # Build and deployment scripts
│   ├── build.sh
│   ├── deploy.sh
│   └── setup.sh
└── config/                  # Configuration files
    ├── development.yml
    ├── production.yml
    └── testing.yml
```

### Web Application Structure
```
web-app/
├── public/                  # Static assets
│   ├── index.html
│   ├── favicon.ico
│   └── assets/
│       ├── css/
│       ├── js/
│       └── images/
├── src/                     # Source code
│   ├── components/          # Reusable components
│   ├── pages/              # Page components
│   ├── services/           # API services
│   ├── utils/              # Utility functions
│   ├── styles/             # Stylesheets
│   └── config/             # Configuration
├── tests/                   # Test files
└── build/                   # Build output
```

### API Project Structure
```
api-project/
├── src/
│   ├── controllers/         # Request handlers
│   ├── models/             # Data models
│   ├── services/           # Business logic
│   ├── middleware/         # Custom middleware
│   ├── routes/             # API routes
│   ├── utils/              # Utility functions
│   └── config/             # Configuration
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── api-spec.yml        # OpenAPI specification
│   └── README.md
└── scripts/
    ├── seed-db.js          # Database seeding
    └── migrate.js          # Database migrations
```

## Essential Configuration Files

### .gitignore Template
```gitignore
# Dependencies
node_modules/
*.log
npm-debug.log*

# Environment files
.env
.env.local
.env.production

# Build outputs
dist/
build/
*.tgz

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Temporary files
*.tmp
*.temp
```

### README.md Template
```markdown
# Project Name

Brief description of what this project does.

## Features

- Feature 1
- Feature 2
- Feature 3

## Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/username/project-name.git

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
\`\`\`

## Usage

\`\`\`bash
# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
\`\`\`

## API Documentation

[API documentation](docs/API.md)

## Contributing

Please read [CONTRIBUTING.md](docs/CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file.
```

### .env.example Template
```env
# Application
NODE_ENV=development
PORT=3000
HOST=localhost

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp
DB_USER=username
DB_PASSWORD=password

# API Keys
API_KEY=your-api-key-here
SECRET_KEY=your-secret-key-here

# External Services
REDIS_URL=redis://localhost:6379
EMAIL_SERVICE_API_KEY=your-email-key
```

## Development Environment Setup

### Package.json Scripts
```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write src/",
    "build": "webpack --mode production",
    "build:dev": "webpack --mode development",
    "clean": "rm -rf dist/"
  }
}
```

### Git Initialization
```bash
# Initialize Git repository
git init

# Add initial files
git add .

# Create initial commit
git commit -m "feat: initial project setup

- Add project structure
- Configure development environment
- Add documentation templates
- Set up testing framework"

# Add remote origin
git remote add origin https://github.com/username/project-name.git

# Push to remote
git push -u origin main
```

## Language-Specific Setup

### Node.js/JavaScript
```bash
npm init -y
npm install --save-dev nodemon jest eslint prettier
```

### Python
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Docker Setup
```dockerfile
# Dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    volumes:
      - .:/app
      - /app/node_modules
```

## Best Practices

1. **Consistent Structure** - Follow established conventions
2. **Clear Documentation** - Write comprehensive README
3. **Environment Variables** - Keep secrets out of code
4. **Version Control** - Initialize Git from the start
5. **Testing Setup** - Configure testing from day one
6. **Code Quality** - Set up linting and formatting
7. **CI/CD Ready** - Structure for automated deployment
8. **Security** - Include security best practices

## Checklist

- [ ] Create project directory structure
- [ ] Initialize version control (Git)
- [ ] Set up package manager (npm, pip, etc.)
- [ ] Create README.md with project info
- [ ] Add .gitignore file
- [ ] Set up environment variables
- [ ] Configure linting and formatting
- [ ] Set up testing framework
- [ ] Create basic documentation
- [ ] Add license file
- [ ] Set up CI/CD configuration (if needed)