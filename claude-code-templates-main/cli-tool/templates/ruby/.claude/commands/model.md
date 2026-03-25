# Ruby Model Generator

Create Ruby classes and models with proper structure and best practices.

## Purpose

This command helps you quickly create Ruby model classes with proper initialization, attributes, and methods following Ruby conventions.

## Usage

```
/model
```

## What this command does

1. **Creates model classes** with proper initialization methods
2. **Adds attribute accessors** and instance variables
3. **Includes validation methods** and error handling
4. **Follows Ruby conventions** and best practices
5. **Generates related test files** when applicable

## Example Output

```ruby
# app/models/user.rb
class User
  attr_accessor :name, :email, :age
  attr_reader :id, :created_at
  
  def initialize(attributes = {})
    @id = attributes[:id] || generate_id
    @name = attributes[:name]
    @email = attributes[:email]
    @age = attributes[:age]
    @created_at = Time.now
    @errors = []
  end
  
  def valid?
    @errors.clear
    validate_presence_of_name
    validate_email_format
    validate_age_range
    @errors.empty?
  end
  
  def errors
    @errors.dup
  end
  
  def save
    return false unless valid?
    
    # Persist logic here
    true
  end
  
  def to_h
    {
      id: @id,
      name: @name,
      email: @email,
      age: @age,
      created_at: @created_at
    }
  end
  
  def to_json(*args)
    JSON.generate(to_h, *args)
  end
  
  private
  
  def validate_presence_of_name
    if @name.nil? || @name.strip.empty?
      @errors << "Name cannot be blank"
    end
  end
  
  def validate_email_format
    if @email && !@email.match?(/\A[\w+\-.]+@[a-z\d\-]+(\.[a-z\d\-]+)*\.[a-z]+\z/i)
      @errors << "Email format is invalid"
    end
  end
  
  def validate_age_range
    if @age && (@age < 0 || @age > 150)
      @errors << "Age must be between 0 and 150"
    end
  end
  
  def generate_id
    SecureRandom.uuid
  end
end

# Example with inheritance
class AdminUser < User
  attr_accessor :permissions
  
  def initialize(attributes = {})
    super
    @permissions = attributes[:permissions] || []
  end
  
  def admin?
    true
  end
  
  def has_permission?(permission)
    @permissions.include?(permission)
  end
  
  private
  
  def validate_permissions
    unless @permissions.is_a?(Array)
      @errors << "Permissions must be an array"
    end
  end
end
```

## Advanced Features

### Module Inclusion
```ruby
module Timestamps
  def self.included(base)
    base.extend(ClassMethods)
  end
  
  module ClassMethods
    def with_timestamps
      attr_reader :created_at, :updated_at
      
      define_method :initialize do |*args|
        super(*args)
        @created_at ||= Time.now
        @updated_at = @created_at
      end
      
      define_method :touch do
        @updated_at = Time.now
      end
    end
  end
end

class Post
  include Timestamps
  with_timestamps
  
  attr_accessor :title, :content
  
  def initialize(attributes = {})
    @title = attributes[:title]
    @content = attributes[:content]
    super
  end
end
```

### Class Methods and Scopes
```ruby
class User
  @@users = []
  
  def self.all
    @@users.dup
  end
  
  def self.find_by_email(email)
    @@users.find { |user| user.email == email }
  end
  
  def self.where(conditions = {})
    @@users.select do |user|
      conditions.all? { |key, value| user.send(key) == value }
    end
  end
  
  def self.create(attributes = {})
    user = new(attributes)
    if user.save
      @@users << user
      user
    else
      nil
    end
  end
  
  def save
    return false unless valid?
    
    unless @@users.include?(self)
      @@users << self
    end
    true
  end
  
  def destroy
    @@users.delete(self)
  end
end
```

## Testing Template

```ruby
# spec/models/user_spec.rb
require 'spec_helper'

RSpec.describe User do
  let(:valid_attributes) do
    {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    }
  end
  
  describe '#initialize' do
    it 'sets attributes correctly' do
      user = User.new(valid_attributes)
      
      expect(user.name).to eq('John Doe')
      expect(user.email).to eq('john@example.com')
      expect(user.age).to eq(30)
      expect(user.id).not_to be_nil
      expect(user.created_at).to be_a(Time)
    end
  end
  
  describe '#valid?' do
    it 'returns true for valid attributes' do
      user = User.new(valid_attributes)
      expect(user).to be_valid
    end
    
    it 'returns false when name is blank' do
      user = User.new(valid_attributes.merge(name: ''))
      expect(user).not_to be_valid
      expect(user.errors).to include('Name cannot be blank')
    end
    
    it 'returns false for invalid email format' do
      user = User.new(valid_attributes.merge(email: 'invalid-email'))
      expect(user).not_to be_valid
      expect(user.errors).to include('Email format is invalid')
    end
    
    it 'returns false for invalid age' do
      user = User.new(valid_attributes.merge(age: -5))
      expect(user).not_to be_valid
      expect(user.errors).to include('Age must be between 0 and 150')
    end
  end
  
  describe '#save' do
    it 'saves valid user' do
      user = User.new(valid_attributes)
      expect(user.save).to be true
    end
    
    it 'does not save invalid user' do
      user = User.new(name: '')
      expect(user.save).to be false
    end
  end
  
  describe '#to_h' do
    it 'returns hash representation' do
      user = User.new(valid_attributes)
      hash = user.to_h
      
      expect(hash).to include(
        name: 'John Doe',
        email: 'john@example.com',
        age: 30
      )
      expect(hash[:id]).not_to be_nil
      expect(hash[:created_at]).to be_a(Time)
    end
  end
end
```

## Best Practices Included

- **Proper initialization** with hash parameters
- **Attribute accessors** for public attributes
- **Validation methods** with error collection
- **JSON serialization** support
- **Class and instance methods** separation
- **Error handling** and reporting
- **Ruby naming conventions** (snake_case)
- **Encapsulation** with private methods

## Common Patterns

### Value Objects
```ruby
class Money
  include Comparable
  
  attr_reader :amount, :currency
  
  def initialize(amount, currency = 'USD')
    @amount = amount.to_f
    @currency = currency.to_s.upcase
  end
  
  def +(other)
    raise ArgumentError, "Currency mismatch" unless currency == other.currency
    Money.new(amount + other.amount, currency)
  end
  
  def <=>(other)
    raise ArgumentError, "Currency mismatch" unless currency == other.currency
    amount <=> other.amount
  end
  
  def to_s
    "#{currency} #{format('%.2f', amount)}"
  end
end
```

### Service Objects
```ruby
class UserRegistrationService
  attr_reader :user, :errors
  
  def initialize(user_params)
    @user_params = user_params
    @errors = []
  end
  
  def call
    @user = User.new(@user_params)
    
    if @user.valid?
      @user.save
      send_welcome_email
      true
    else
      @errors = @user.errors
      false
    end
  end
  
  private
  
  def send_welcome_email
    # Email sending logic
  end
end
```