# CLAUDE.md Starter: Ruby on Rails Project

Copy this into your project root as `CLAUDE.md` and customize the placeholders.

---

````markdown
# CLAUDE.md

## Project Overview

- **Name**: <project-name>
- **Description**: <one-line description>
- **Ruby version**: 3.3 (see `.ruby-version`)
- **Rails version**: 8.0
- **Database**: PostgreSQL

## Quick Commands

```bash
# Setup
bin/setup

# Development server
bin/dev

# Run all tests
bin/rails test

# Run specific test file
bin/rails test test/models/user_test.rb

# Run system tests
bin/rails test:system

# Console
bin/rails console

# Database
bin/rails db:migrate
bin/rails db:seed
bin/rails db:rollback

# Generate
bin/rails generate model <Name> <field:type>
bin/rails generate controller <Names> <action>

# Lint
bundle exec rubocop
bundle exec rubocop -a  # auto-fix
```

## Project Structure

```text
<project-name>/
├── app/
│   ├── controllers/       # Thin controllers, REST only
│   ├── models/            # Fat models, business logic here
│   ├── views/             # ERB templates
│   ├── helpers/           # View helpers
│   ├── jobs/              # Background jobs (Solid Queue)
│   ├── mailers/           # Email senders
│   └── components/        # ViewComponents (if used)
├── config/
│   ├── routes.rb          # REST routes
│   └── database.yml
├── db/
│   ├── migrate/           # Database migrations
│   └── schema.rb          # Auto-generated schema (do not edit)
├── test/                  # Minitest files
│   ├── models/
│   ├── controllers/
│   ├── system/
│   └── fixtures/
└── CLAUDE.md
```

## Code Style

- Follow Rails conventions (convention over configuration)
- Fat models, thin controllers
- Use `Current` attributes for request-scoped state
- Prefer scopes and query methods in models over raw SQL
- Use `before_action` for shared controller logic
- RESTful routes only, no custom actions unless absolutely necessary
- Keep controllers to the 7 REST actions: index, show, new, create, edit, update, destroy
- Use partials to DRY up views, name them `_<partial>.html.erb`

## Database

- Always create migrations, never modify `schema.rb` directly
- Migrations must be reversible (use `change`, not `up`/`down` unless needed)
- Add indexes for foreign keys and frequently queried columns
- Use `null: false` and database-level constraints, not just model validations
- Use `references` with `foreign_key: true` for associations

## Testing

- Use Minitest (Rails default) or RSpec
- Fixtures for test data (in `test/fixtures/`)
- Test models thoroughly (validations, scopes, methods)
- Controller tests for auth and redirects
- System tests with Capybara for critical user flows
- Run the full suite before committing

## Hotwire Patterns

- Use Turbo Drive for page navigation (works by default)
- Use Turbo Frames for partial page updates
- Use Turbo Streams for real-time updates
- Use Stimulus controllers for JavaScript behavior
- Minimize custom JavaScript, prefer Stimulus + Turbo

## Conventions

- <Add project-specific conventions here>
````

---

## Variants

### RSpec (instead of Minitest)

Replace the testing section:

````markdown
## Quick Commands (Testing)

```bash
bundle exec rspec
bundle exec rspec spec/models/user_spec.rb
bundle exec rspec spec/models/user_spec.rb:42  # specific line
```

## Testing

- Use RSpec with FactoryBot for test data
- Factories in `spec/factories/`
- Use `let` and `let!` for lazy/eager setup
- Use `subject` for the object under test
- Use `shared_examples` for common behavior
- Use `have_enqueued_job` matcher for job testing
````

### API-only

Add this section:

````markdown
## API Conventions

- Use `ActionController::API` base class
- Serialize with `ActiveModel::Serializer` or jbuilder
- Version APIs in routes: `/api/v1/`
- Use token authentication (not session)
- Return consistent JSON: `{ data: T }` or `{ error: string, details: [] }`
- Use HTTP status codes correctly
````
