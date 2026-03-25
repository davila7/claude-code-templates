# Rails 8 Project Configuration

This file provides specific guidance for Ruby on Rails 8 web application development using Claude Code.

## Project Overview

This is a Ruby on Rails 8 web application project optimized for modern web development with the latest Rails features. The project follows Rails 8 conventions and leverages new capabilities like native authentication, Solid trifecta, and Kamal 2 deployment.

## Rails 8 Specific Development Commands

### Project Creation & Setup
- `rails new myapp` - Create new Rails 8 application
- `rails new myapp --skip-kamal` - Create app without Kamal deployment
- `rails new myapp --database=postgresql` - Create app with PostgreSQL
- `rails new myapp --css=tailwind` - Create app with Tailwind CSS
- `rails new myapp --javascript=esbuild` - Create app with esbuild

### Server Management
- `bin/rails server` or `bin/rails s` - Start development server
- `bin/rails server -p 4000` - Start server on port 4000
- `bin/rails server -e production` - Start in production mode
- `bin/dev` - Start development server with asset compilation (if available)

### Database Management
- `bin/rails db:create` - Create database
- `bin/rails db:migrate` - Run pending migrations
- `bin/rails db:rollback` - Rollback last migration
- `bin/rails db:reset` - Drop, create, and migrate database
- `bin/rails db:seed` - Run database seeds
- `bin/rails db:setup` - Create, migrate, and seed database

### Generation Commands
- `bin/rails generate model User name:string email:string` - Generate model
- `bin/rails generate controller Users index show` - Generate controller
- `bin/rails generate migration AddIndexToUsers email:index` - Generate migration
- `bin/rails generate authentication` - Generate Rails 8 native authentication (NEW)
- `bin/rails generate solid_queue:install` - Install Solid Queue (NEW)
- `bin/rails generate solid_cache:install` - Install Solid Cache (NEW)

### Rails 8 Native Authentication
- `bin/rails generate authentication User` - Generate authentication for User model
- `bin/rails generate authentication:views` - Generate authentication views
- `bin/rails generate authentication:controllers` - Generate authentication controllers

### Background Jobs (Solid Queue)
- `bin/rails solid_queue:start` - Start Solid Queue worker
- `bin/rails solid_queue:install` - Install Solid Queue configuration
- `SampleJob.perform_later(user)` - Enqueue background job

### Caching (Solid Cache)
- `Rails.cache.write("key", "value")` - Write to cache
- `Rails.cache.read("key")` - Read from cache
- `Rails.cache.delete("key")` - Delete from cache
- `bin/rails solid_cache:clear` - Clear all cached data

### Asset Management (Propshaft)
- `bin/rails assets:precompile` - Precompile assets for production
- `bin/rails assets:clobber` - Remove compiled assets
- Assets are automatically served in development

### Testing Commands
- `bin/rails test` - Run all tests
- `bin/rails test:models` - Run model tests
- `bin/rails test:controllers` - Run controller tests
- `bin/rails test:system` - Run system tests
- `bin/rails test test/models/user_test.rb` - Run specific test file

### Console & Debugging
- `bin/rails console` or `bin/rails c` - Start Rails console
- `bin/rails console --sandbox` - Start console in sandbox mode
- `bin/rails dbconsole` or `bin/rails db` - Start database console

### Code Quality & Security (Rails 8 Defaults)
- `bin/rails rubocop` - Run RuboCop with Rails 8 Omakase config
- `bin/rails brakeman` - Run security scan (included by default)
- `bundle audit` - Check for vulnerable gems

## Deployment with Kamal 2 (Rails 8 Default)

### Kamal 2 Commands
- `kamal setup` - Initial server setup
- `kamal deploy` - Deploy application
- `kamal redeploy` - Redeploy without setup
- `kamal rollback` - Rollback to previous version
- `kamal logs` - View application logs
- `kamal logs --follow` - Follow logs in real-time
- `kamal shell` - SSH into deployed container
- `kamal details` - Show deployment details

### Kamal 2 Configuration
Configuration is automatically generated in `config/deploy.yml`:

```yaml
# config/deploy.yml
service: myapp
image: myapp
servers:
  - 192.168.1.1
registry:
  server: registry.digitalocean.com
  username: myusername
  
env:
  clear:
    RAILS_ENV: production
  secret:
    - RAILS_MASTER_KEY
    
builder:
  multiarch: false
```

## Rails 8 Project Structure

```
myapp/
├── app/
│   ├── models/              # ActiveRecord models
│   ├── controllers/         # ActionController controllers
│   ├── views/              # ERB/HAML templates
│   ├── helpers/            # View helpers
│   ├── mailers/            # ActionMailer mailers
│   ├── jobs/               # ActiveJob jobs (Solid Queue)
│   ├── assets/             # Application assets (Propshaft)
│   └── javascript/         # JavaScript files
├── config/
│   ├── application.rb      # Application configuration
│   ├── routes.rb           # URL routing
│   ├── database.yml        # Database configuration
│   ├── deploy.yml          # Kamal 2 deployment config (NEW)
│   └── environments/       # Environment-specific configs
├── db/
│   ├── migrate/            # Database migrations
│   └── seeds.rb           # Database seeds
├── test/                   # Test files (default in Rails 8)
│   ├── models/
│   ├── controllers/
│   ├── integration/
│   └── system/
├── bin/                    # Binstubs
├── config.ru              # Rack configuration
├── Gemfile                 # Gem dependencies
├── Gemfile.lock           # Locked gem versions
└── Dockerfile             # Docker configuration (if using containers)
```

## Rails 8 New Features Integration

### 1. SQLite Production Enhancements
Rails 8 makes SQLite production-ready:

```ruby
# config/database.yml
production:
  adapter: sqlite3
  database: storage/production.sqlite3
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>
  timeout: 5000
  # New Rails 8 SQLite configurations
  pragmas:
    busy_timeout: 1000
    journal_mode: WAL
    synchronous: NORMAL
    foreign_keys: true
```

### 2. Solid Trifecta Configuration

#### Solid Queue (Background Jobs)
```ruby
# config/application.rb
config.active_job.queue_adapter = :solid_queue

# app/jobs/sample_job.rb
class SampleJob < ApplicationJob
  queue_as :default
  
  def perform(user)
    # Background job logic
  end
end
```

#### Solid Cache (Caching)
```ruby
# config/application.rb
config.cache_store = :solid_cache_store

# Usage in controllers/models
Rails.cache.fetch("user_#{user.id}", expires_in: 1.hour) do
  expensive_calculation(user)
end
```

#### Solid Cable (WebSockets)
```ruby
# config/application.rb
config.action_cable.adapter = :solid_cable

# app/channels/chat_channel.rb
class ChatChannel < ApplicationCable::Channel
  def subscribed
    stream_from "chat_#{params[:room]}"
  end
end
```

### 3. Native Authentication (Rails 8)
```ruby
# Generate authentication
bin/rails generate authentication User

# app/models/user.rb (generated)
class User < ApplicationRecord
  has_secure_password
  
  validates :email, presence: true, uniqueness: true
  normalizes :email, with: ->(email) { email.strip.downcase }
end

# app/controllers/application_controller.rb
class ApplicationController < ActionController::Base
  before_action :authenticate_user!
  
  private
  
  def authenticate_user!
    redirect_to login_path unless current_user
  end
  
  def current_user
    @current_user ||= User.find(session[:user_id]) if session[:user_id]
  end
end
```

### 4. Propshaft Asset Pipeline
```ruby
# config/application.rb
# Propshaft is now the default - no configuration needed

# Assets are automatically fingerprinted and served
# Use asset helpers in views:
<%= asset_path("application.css") %>
<%= asset_path("logo.png") %>
```

## Testing in Rails 8

### Default Test Suite Setup
Rails 8 includes comprehensive testing setup by default:

```ruby
# test/test_helper.rb
ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    # Run tests in parallel with specified workers
    parallelize(workers: :number_of_processors)
    
    # Setup all fixtures in test/fixtures/*.yml
    fixtures :all
    
    # Add more helper methods to be used by all tests here...
  end
end
```

### System Testing with Capybara
```ruby
# test/system/users_test.rb
class UsersTest < ApplicationSystemTestCase
  test "creating a user" do
    visit new_user_path
    
    fill_in "Name", with: "John Doe"
    fill_in "Email", with: "john@example.com"
    click_button "Create User"
    
    assert_text "User was successfully created"
  end
end
```

## Security Best Practices (Rails 8)

### Built-in Security Features
- **Brakeman** - Included by default for security scanning
- **Credential Management** - Use `rails credentials:edit`
- **Content Security Policy** - Configure in `application_controller.rb`
- **Force SSL** - Enable in production environment

```ruby
# config/environments/production.rb
config.force_ssl = true
config.content_security_policy do |policy|
  policy.default_src :self, :https
  policy.font_src    :self, :https, :data
  policy.img_src     :self, :https, :data
  policy.object_src  :none
  policy.script_src  :self, :https
  policy.style_src   :self, :https, :unsafe_inline
end
```

## Performance Optimization

### Database Optimization
```ruby
# Use includes to avoid N+1 queries
@users = User.includes(:posts).all

# Use counter_cache for associations
class Post < ApplicationRecord
  belongs_to :user, counter_cache: true
end
```

### Caching Strategies
```ruby
# Fragment caching in views
<% cache @user do %>
  <%= render @user %>
<% end %>

# Action caching in controllers
class UsersController < ApplicationController
  caches_action :index, expires_in: 1.hour
end
```

## Production Deployment Checklist

### Environment Configuration
- [ ] Set `RAILS_ENV=production`
- [ ] Configure `RAILS_MASTER_KEY` or `config/credentials.yml.enc`
- [ ] Set up database (PostgreSQL/MySQL for production)
- [ ] Configure email delivery
- [ ] Set up error monitoring (Sentry, Bugsnag)
- [ ] Configure logging and log rotation

### Kamal 2 Deployment
- [ ] Update `config/deploy.yml` with production servers
- [ ] Set up Docker registry access
- [ ] Configure environment variables and secrets
- [ ] Run `kamal setup` for initial deployment
- [ ] Deploy with `kamal deploy`

### Performance & Monitoring
- [ ] Enable asset precompilation
- [ ] Configure CDN for static assets
- [ ] Set up application performance monitoring (APM)
- [ ] Configure health checks
- [ ] Set up backup strategies for database

## Upgrading to Rails 8

### Migration Steps
1. Update Gemfile: `gem 'rails', '~> 8.0.0'`
2. Run `bundle update rails`
3. Run `bin/rails app:update` to update configuration files
4. Review and update deprecated code
5. Update test suite to use new defaults
6. Consider migrating to Solid trifecta adapters
7. Optionally migrate authentication to native Rails 8 system

### Breaking Changes to Consider
- Ruby 3.2+ requirement
- Propshaft replaces Sprockets by default
- Some deprecated ActiveRecord methods removed
- Updated default configurations for new applications

This Rails 8 configuration provides a modern, production-ready foundation with the latest Rails features and best practices.