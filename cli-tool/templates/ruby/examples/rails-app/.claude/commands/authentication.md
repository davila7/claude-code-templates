# Rails 8 Native Authentication Generator

Generate Rails 8's built-in authentication system with modern security practices.

## Purpose

This command helps you implement Rails 8's new native authentication system, eliminating the need for external gems like Devise for basic authentication needs.

## Usage

```
/authentication
```

## What this command does

1. **Generates authentication models** with secure password handling
2. **Creates authentication controllers** for login/logout/signup
3. **Adds authentication views** with modern styling
4. **Implements session management** with security best practices
5. **Sets up authentication helpers** for controllers and views

## Rails 8 Authentication Generator

```bash
# Generate authentication for User model
bin/rails generate authentication User

# Or specify custom model name
bin/rails generate authentication Account

# Generate with custom attributes
bin/rails generate authentication User first_name:string last_name:string
```

## Generated User Model

```ruby
# app/models/user.rb
class User < ApplicationRecord
  has_secure_password
  
  validates :email, presence: true, uniqueness: true
  validates :password, length: { minimum: 8 }, if: -> { new_record? || !password.blank? }
  
  normalizes :email, with: ->(email) { email.strip.downcase }
  
  before_save :normalize_email
  
  private
  
  def normalize_email
    self.email = email.downcase.strip
  end
end
```

## Authentication Controller

```ruby
# app/controllers/authentication_controller.rb
class AuthenticationController < ApplicationController
  skip_before_action :authenticate_user!, only: [:new, :create]
  
  def new
    # Login page
  end
  
  def create
    user = User.find_by(email: params[:email])
    
    if user&.authenticate(params[:password])
      login(user)
      redirect_to root_path, notice: 'Logged in successfully'
    else
      flash.now[:alert] = 'Invalid email or password'
      render :new, status: :unprocessable_entity
    end
  end
  
  def destroy
    logout
    redirect_to root_path, notice: 'Logged out successfully'
  end
  
  private
  
  def login(user)
    session[:user_id] = user.id
    @current_user = user
  end
  
  def logout
    session[:user_id] = nil
    @current_user = nil
  end
end
```

## Registration Controller

```ruby
# app/controllers/registrations_controller.rb
class RegistrationsController < ApplicationController
  skip_before_action :authenticate_user!
  
  def new
    @user = User.new
  end
  
  def create
    @user = User.new(user_params)
    
    if @user.save
      login(@user)
      redirect_to root_path, notice: 'Account created successfully'
    else
      render :new, status: :unprocessable_entity
    end
  end
  
  private
  
  def user_params
    params.require(:user).permit(:email, :password, :password_confirmation, :first_name, :last_name)
  end
  
  def login(user)
    session[:user_id] = user.id
    @current_user = user
  end
end
```

## Application Controller Updates

```ruby
# app/controllers/application_controller.rb
class ApplicationController < ActionController::Base
  protect_from_forgery with: :exception
  
  before_action :authenticate_user!
  
  private
  
  def authenticate_user!
    redirect_to login_path, alert: 'Please log in to continue' unless current_user
  end
  
  def current_user
    @current_user ||= User.find(session[:user_id]) if session[:user_id]
  end
  helper_method :current_user
  
  def logged_in?
    !!current_user
  end
  helper_method :logged_in?
  
  def require_login
    unless logged_in?
      flash[:alert] = 'You must be logged in to access this page'
      redirect_to login_path
    end
  end
end
```

## Authentication Views

### Login Form
```erb
<!-- app/views/authentication/new.html.erb -->
<div class="authentication-form">
  <h1>Log In</h1>
  
  <%= form_with url: login_path, local: true, class: "auth-form" do |form| %>
    <div class="form-group">
      <%= form.label :email, "Email" %>
      <%= form.email_field :email, required: true, autofocus: true, class: "form-control" %>
    </div>
    
    <div class="form-group">
      <%= form.label :password, "Password" %>
      <%= form.password_field :password, required: true, class: "form-control" %>
    </div>
    
    <div class="form-actions">
      <%= form.submit "Log In", class: "btn btn-primary" %>
    </div>
  <% end %>
  
  <div class="auth-links">
    <%= link_to "Don't have an account? Sign up", signup_path %>
  </div>
</div>
```

### Registration Form
```erb
<!-- app/views/registrations/new.html.erb -->
<div class="authentication-form">
  <h1>Sign Up</h1>
  
  <%= form_with model: @user, url: signup_path, local: true, class: "auth-form" do |form| %>
    <% if @user.errors.any? %>
      <div class="error-messages">
        <h3><%= pluralize(@user.errors.count, "error") %> prohibited this account from being saved:</h3>
        <ul>
          <% @user.errors.full_messages.each do |message| %>
            <li><%= message %></li>
          <% end %>
        </ul>
      </div>
    <% end %>
    
    <div class="form-group">
      <%= form.label :first_name, "First Name" %>
      <%= form.text_field :first_name, class: "form-control" %>
    </div>
    
    <div class="form-group">
      <%= form.label :last_name, "Last Name" %>
      <%= form.text_field :last_name, class: "form-control" %>
    </div>
    
    <div class="form-group">
      <%= form.label :email, "Email" %>
      <%= form.email_field :email, required: true, class: "form-control" %>
    </div>
    
    <div class="form-group">
      <%= form.label :password, "Password" %>
      <%= form.password_field :password, required: true, minlength: 8, class: "form-control" %>
      <small class="form-text">Minimum 8 characters</small>
    </div>
    
    <div class="form-group">
      <%= form.label :password_confirmation, "Confirm Password" %>
      <%= form.password_field :password_confirmation, required: true, class: "form-control" %>
    </div>
    
    <div class="form-actions">
      <%= form.submit "Sign Up", class: "btn btn-primary" %>
    </div>
  <% end %>
  
  <div class="auth-links">
    <%= link_to "Already have an account? Log in", login_path %>
  </div>
</div>
```

## Route Configuration

```ruby
# config/routes.rb
Rails.application.routes.draw do
  # Authentication routes
  get    'login',  to: 'authentication#new'
  post   'login',  to: 'authentication#create'
  delete 'logout', to: 'authentication#destroy'
  
  # Registration routes
  get  'signup', to: 'registrations#new'
  post 'signup', to: 'registrations#create'
  
  # User management routes
  resources :users, except: [:new, :create]
  
  # Root route
  root 'dashboard#index'
end
```

## Migration Files

```ruby
# db/migrate/xxx_create_users.rb
class CreateUsers < ActiveRecord::Migration[8.0]
  def change
    create_table :users do |t|
      t.string :email, null: false
      t.string :password_digest, null: false
      t.string :first_name
      t.string :last_name
      
      t.timestamps
    end
    
    add_index :users, :email, unique: true
  end
end
```

## Advanced Authentication Features

### Password Reset
```ruby
# app/controllers/password_resets_controller.rb
class PasswordResetsController < ApplicationController
  skip_before_action :authenticate_user!
  
  def new
    # Password reset request form
  end
  
  def create
    @user = User.find_by(email: params[:email])
    if @user
      @user.send_password_reset
      redirect_to root_path, notice: 'Email sent with password reset instructions'
    else
      flash.now[:alert] = 'Email address not found'
      render :new
    end
  end
  
  def edit
    @user = User.find_by(password_reset_token: params[:id])
    if @user.nil? || @user.password_reset_sent_at < 2.hours.ago
      redirect_to new_password_reset_path, alert: 'Password reset has expired'
    end
  end
  
  def update
    @user = User.find_by(password_reset_token: params[:id])
    if @user && @user.password_reset_sent_at > 2.hours.ago
      if @user.update(password_params)
        @user.update_columns(password_reset_token: nil, password_reset_sent_at: nil)
        redirect_to root_path, notice: 'Password has been reset'
      else
        render :edit
      end
    else
      redirect_to new_password_reset_path, alert: 'Password reset has expired'
    end
  end
  
  private
  
  def password_params
    params.require(:user).permit(:password, :password_confirmation)
  end
end
```

### User Model Extensions
```ruby
# app/models/user.rb (extended)
class User < ApplicationRecord
  has_secure_password
  
  validates :email, presence: true, uniqueness: true
  validates :password, length: { minimum: 8 }, if: -> { new_record? || !password.blank? }
  
  normalizes :email, with: ->(email) { email.strip.downcase }
  
  # Password reset functionality
  def send_password_reset
    generate_token(:password_reset_token)
    self.password_reset_sent_at = Time.zone.now
    save!
    UserMailer.password_reset(self).deliver_now
  end
  
  def full_name
    "#{first_name} #{last_name}".strip
  end
  
  def initials
    "#{first_name&.first}#{last_name&.first}".upcase
  end
  
  private
  
  def generate_token(column)
    begin
      self[column] = SecureRandom.urlsafe_base64
    end while User.exists?(column => self[column])
  end
end
```

## Session Security Enhancements

```ruby
# config/application.rb
config.session_store :cookie_store, {
  key: '_myapp_session',
  secure: Rails.env.production?,
  httponly: true,
  same_site: :lax
}

# config/environments/production.rb
config.force_ssl = true
config.session_store :cookie_store, {
  key: '_myapp_session',
  secure: true,
  httponly: true,
  same_site: :strict
}
```

## Authentication Helper Methods

```ruby
# app/helpers/authentication_helper.rb
module AuthenticationHelper
  def user_avatar(user, size: 40)
    if user.avatar.present?
      image_tag user.avatar, alt: user.full_name, class: "avatar", size: "#{size}x#{size}"
    else
      content_tag :div, user.initials, class: "avatar avatar-initials", 
                  style: "width: #{size}px; height: #{size}px; line-height: #{size}px;"
    end
  end
  
  def current_user_menu
    if logged_in?
      render 'shared/user_menu'
    else
      render 'shared/guest_menu'
    end
  end
end
```

## Testing Authentication

```ruby
# spec/models/user_spec.rb
RSpec.describe User, type: :model do
  describe 'validations' do
    it { should validate_presence_of(:email) }
    it { should validate_uniqueness_of(:email) }
    it { should validate_length_of(:password).is_at_least(8) }
    it { should have_secure_password }
  end
  
  describe 'email normalization' do
    it 'normalizes email to lowercase' do
      user = User.create!(email: 'USER@EXAMPLE.COM', password: 'password123')
      expect(user.email).to eq('user@example.com')
    end
  end
  
  describe '#full_name' do
    it 'returns combined first and last name' do
      user = User.new(first_name: 'John', last_name: 'Doe')
      expect(user.full_name).to eq('John Doe')
    end
  end
end

# spec/controllers/authentication_controller_spec.rb
RSpec.describe AuthenticationController, type: :controller do
  describe 'POST #create' do
    let(:user) { create(:user, password: 'password123') }
    
    context 'with valid credentials' do
      it 'logs in the user' do
        post :create, params: { email: user.email, password: 'password123' }
        expect(session[:user_id]).to eq(user.id)
        expect(response).to redirect_to(root_path)
      end
    end
    
    context 'with invalid credentials' do
      it 'does not log in the user' do
        post :create, params: { email: user.email, password: 'wrong' }
        expect(session[:user_id]).to be_nil
        expect(response).to render_template(:new)
      end
    end
  end
end
```

## Security Best Practices Included

- **Secure password hashing** with bcrypt
- **Email normalization** to prevent duplicates
- **CSRF protection** enabled by default
- **Session security** with httponly and secure flags
- **Password strength validation** (minimum 8 characters)
- **Timing attack prevention** in authentication
- **Password reset token expiration**
- **SSL enforcement** in production