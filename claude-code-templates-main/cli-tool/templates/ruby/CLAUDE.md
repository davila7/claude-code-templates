# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Ruby project optimized for modern Ruby development. The project uses industry-standard tools and follows best practices for scalable application development.

## Development Commands

### Environment Management
- `ruby --version` - Check Ruby version
- `rbenv versions` - List available Ruby versions (with rbenv)
- `rbenv install 3.2.0` - Install specific Ruby version
- `rbenv local 3.2.0` - Set local Ruby version
- `rvm use 3.2.0` - Use specific Ruby version (with RVM)

### Package Management
- `bundle install` - Install dependencies from Gemfile
- `bundle update` - Update all gems to latest versions
- `bundle update <gem_name>` - Update specific gem
- `bundle exec <command>` - Run command with bundled gems
- `bundle add <gem_name>` - Add new gem to Gemfile
- `bundle remove <gem_name>` - Remove gem from Gemfile
- `gem install <gem_name>` - Install gem globally
- `gem list` - List installed gems

### Testing Commands
- `rspec` - Run RSpec tests
- `rspec spec/models` - Run specific test directory
- `rspec spec/models/user_spec.rb` - Run specific test file
- `rspec --format documentation` - Run tests with detailed output
- `rspec --tag focus` - Run tests with specific tag
- `ruby -Itest test/` - Run Minitest tests
- `rake test` - Run test suite via Rake
- `bundle exec rspec` - Run RSpec with bundled gems

### Code Quality Commands
- `rubocop` - Run RuboCop linter
- `rubocop -A` - Auto-correct RuboCop violations
- `rubocop --only <cop_name>` - Run specific RuboCop cop
- `brakeman` - Run security analysis
- `reek` - Run code smell detector
- `yard` - Generate documentation
- `bundle audit` - Check for security vulnerabilities in gems

### Development Tools
- `irb` - Interactive Ruby console
- `pry` - Enhanced Ruby console (if installed)
- `ruby -c <file.rb>` - Check Ruby syntax
- `ruby -w <file.rb>` - Run with warnings enabled

## Technology Stack

### Core Technologies
- **Ruby** - Primary programming language (3.2.0+)
- **Bundler** - Dependency management
- **RubyGems** - Package management system

### Common Frameworks
- **Ruby on Rails** - Full-stack web framework
- **Sinatra** - Lightweight web framework
- **Hanami** - Modern web framework
- **Grape** - REST API framework
- **Roda** - Routing tree web framework

### Testing Frameworks
- **RSpec** - Behavior-driven development testing framework
- **Minitest** - Built-in testing framework
- **FactoryBot** - Test data generation
- **Capybara** - Acceptance testing for web applications
- **VCR** - Record HTTP interactions for tests
- **WebMock** - Mock HTTP requests

### Code Quality Tools
- **RuboCop** - Ruby static code analyzer and formatter
- **Brakeman** - Static analysis security vulnerability scanner
- **Reek** - Code smell detector
- **SimpleCov** - Code coverage analysis
- **YARD** - Documentation generation tool

### Popular Gems
- **Puma** - Web server
- **Sidekiq** - Background job processing
- **Redis** - In-memory data structure store
- **PostgreSQL/MySQL** - Database adapters
- **Devise** - Authentication solution (pre-Rails 8)
- **Pundit** - Authorization system

## Project Structure Guidelines

### File Organization
```
app/
├── models/              # Business logic and data models
├── controllers/         # Web controllers (Rails)
├── views/              # Templates and presentation
├── helpers/            # View helpers
├── services/           # Business logic services
├── workers/            # Background job workers
└── lib/                # Custom libraries
config/
├── application.rb      # Application configuration
├── routes.rb          # URL routing (Rails)
├── database.yml       # Database configuration
└── environments/      # Environment-specific configs
spec/ or test/
├── models/            # Model tests
├── controllers/       # Controller tests
├── features/          # Feature/integration tests
├── support/           # Test support files
└── factories/         # Test data factories
lib/
├── tasks/             # Rake tasks
└── custom_modules/    # Custom Ruby modules
Gemfile                # Gem dependencies
Gemfile.lock          # Locked gem versions
Rakefile              # Rake task definitions
```

### Naming Conventions
- **Files/Modules**: Use snake_case (`user_profile.rb`)
- **Classes**: Use PascalCase (`UserProfile`)
- **Methods/Variables**: Use snake_case (`get_user_data`)
- **Constants**: Use SCREAMING_SNAKE_CASE (`API_BASE_URL`)
- **Private methods**: Prefix with underscore or use `private` keyword

## Ruby Guidelines

### Code Style
- Follow the Ruby Style Guide
- Use meaningful variable and method names
- Keep methods focused and single-purpose
- Use Ruby idioms and conventions
- Prefer explicit over implicit when it improves clarity
- Use proper indentation (2 spaces)

### Best Practices
- Use `bundle exec` for running commands with specific gem versions
- Write tests for all public methods
- Use descriptive commit messages
- Keep Gemfile organized and commented
- Use environment variables for configuration
- Handle exceptions appropriately
- Follow DRY (Don't Repeat Yourself) principles

## Testing Standards

### Test Structure
- Organize tests to mirror source code structure
- Use descriptive test names that explain the behavior
- Follow AAA pattern (Arrange, Act, Assert)
- Use factories for test data
- Group related tests in context blocks (RSpec)

### Coverage Goals
- Aim for 90%+ test coverage
- Write unit tests for models and services
- Use integration tests for controllers and features
- Mock external dependencies
- Test error conditions and edge cases

### RSpec Configuration
```ruby
# spec/spec_helper.rb
RSpec.configure do |config|
  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end
  
  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end
  
  config.shared_context_metadata_behavior = :apply_to_host_groups
  config.filter_run_when_matching :focus
  config.example_status_persistence_file_path = "spec/examples.txt"
  config.disable_monkey_patching!
  config.warnings = true
  
  if config.files_to_run.one?
    config.default_formatter = "doc"
  end
  
  config.profile_examples = 10
  config.order = :random
  Kernel.srand config.seed
end
```

## Bundler Configuration

### Gemfile Best Practices
```ruby
# Gemfile
source 'https://rubygems.org'
git_source(:github) { |repo| "https://github.com/#{repo}.git" }

ruby '3.2.0'

# Core gems
gem 'rails', '~> 8.0.0'
gem 'pg', '~> 1.1'
gem 'puma', '~> 6.0'

# Development and test gems
group :development, :test do
  gem 'debug', platforms: %i[ mri mingw x64_mingw ]
  gem 'rspec-rails'
  gem 'factory_bot_rails'
end

group :development do
  gem 'rubocop', require: false
  gem 'brakeman', require: false
  gem 'web-console'
end

group :test do
  gem 'capybara'
  gem 'selenium-webdriver'
  gem 'simplecov', require: false
end
```

### Bundle Configuration
```bash
# .bundle/config or config/bundle
BUNDLE_PATH: "vendor/bundle"
BUNDLE_JOBS: "4"
BUNDLE_RETRY: "3"
```

## Development Workflow

### Before Starting
1. Check Ruby version compatibility
2. Install dependencies with `bundle install`
3. Set up database (if applicable)
4. Run tests to ensure setup is correct

### During Development
1. Write tests first (TDD approach)
2. Run tests frequently: `bundle exec rspec`
3. Use meaningful commit messages
4. Run code quality checks regularly

### Before Committing
1. Run full test suite: `bundle exec rspec`
2. Run linter: `rubocop`
3. Run security scanner: `brakeman`
4. Check for vulnerabilities: `bundle audit`
5. Ensure code coverage is maintained

## Security Guidelines

### Gem Security
- Regularly update gems with `bundle update`
- Use `bundle audit` to check for known vulnerabilities
- Pin gem versions in Gemfile.lock
- Review gem source code for suspicious packages

### Code Security
- Validate input data
- Use environment variables for sensitive configuration
- Implement proper authentication and authorization
- Sanitize data before database operations
- Use HTTPS for production deployments
- Follow OWASP guidelines for web security

## Performance Considerations

### Code Performance
- Use proper indexing for database queries
- Implement caching strategies
- Profile code with tools like `ruby-prof`
- Monitor memory usage
- Use background jobs for heavy operations

### Gem Performance
- Choose gems wisely based on performance metrics
- Monitor gem overhead
- Use lightweight alternatives when possible
- Profile application with production-like data