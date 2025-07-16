# Ruby Test Generator

Create comprehensive test files with RSpec or Minitest following Ruby testing best practices.

## Purpose

This command helps you quickly create test files with proper structure, examples, and testing patterns for Ruby applications.

## Usage

```
/test
```

## What this command does

1. **Creates test files** with proper structure for RSpec or Minitest
2. **Includes test examples** for common scenarios
3. **Sets up test helpers** and support files
4. **Follows testing conventions** and best practices
5. **Generates factory/fixture data** when needed

## RSpec Example Output

```ruby
# spec/models/user_spec.rb
require 'spec_helper'

RSpec.describe User do
  let(:user) { build(:user) }
  let(:valid_attributes) do
    {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    }
  end
  
  describe 'validations' do
    it { should validate_presence_of(:name) }
    it { should validate_presence_of(:email) }
    it { should validate_uniqueness_of(:email) }
    it { should validate_numericality_of(:age).is_greater_than(0) }
    
    context 'when email format is invalid' do
      let(:user) { build(:user, email: 'invalid-email') }
      
      it 'is not valid' do
        expect(user).not_to be_valid
        expect(user.errors[:email]).to include('is invalid')
      end
    end
  end
  
  describe 'associations' do
    it { should have_many(:posts) }
    it { should have_many(:comments) }
  end
  
  describe 'callbacks' do
    describe 'before_save' do
      it 'normalizes email' do
        user = create(:user, email: 'JOHN@EXAMPLE.COM')
        expect(user.email).to eq('john@example.com')
      end
    end
  end
  
  describe 'instance methods' do
    describe '#full_name' do
      let(:user) { build(:user, first_name: 'John', last_name: 'Doe') }
      
      it 'returns the full name' do
        expect(user.full_name).to eq('John Doe')
      end
      
      context 'when last_name is missing' do
        let(:user) { build(:user, first_name: 'John', last_name: nil) }
        
        it 'returns only first_name' do
          expect(user.full_name).to eq('John')
        end
      end
    end
    
    describe '#active?' do
      context 'when user is active' do
        let(:user) { build(:user, status: 'active') }
        
        it 'returns true' do
          expect(user.active?).to be true
        end
      end
      
      context 'when user is inactive' do
        let(:user) { build(:user, status: 'inactive') }
        
        it 'returns false' do
          expect(user.active?).to be false
        end
      end
    end
  end
  
  describe 'class methods' do
    describe '.active' do
      let!(:active_user) { create(:user, status: 'active') }
      let!(:inactive_user) { create(:user, status: 'inactive') }
      
      it 'returns only active users' do
        expect(User.active).to include(active_user)
        expect(User.active).not_to include(inactive_user)
      end
    end
    
    describe '.find_by_email' do
      let!(:user) { create(:user, email: 'test@example.com') }
      
      it 'finds user by email' do
        found_user = User.find_by_email('test@example.com')
        expect(found_user).to eq(user)
      end
      
      it 'returns nil when user not found' do
        found_user = User.find_by_email('nonexistent@example.com')
        expect(found_user).to be_nil
      end
    end
  end
  
  describe 'scopes' do
    describe '.recent' do
      let!(:old_user) { create(:user, created_at: 1.year.ago) }
      let!(:recent_user) { create(:user, created_at: 1.day.ago) }
      
      it 'returns users created in the last 30 days' do
        expect(User.recent).to include(recent_user)
        expect(User.recent).not_to include(old_user)
      end
    end
  end
end
```

## Minitest Example Output

```ruby
# test/models/user_test.rb
require 'test_helper'

class UserTest < ActiveSupport::TestCase
  def setup
    @user = users(:john)
    @valid_attributes = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      age: 25
    }
  end
  
  # Validation tests
  test 'should not save user without name' do
    user = User.new(@valid_attributes.except(:name))
    assert_not user.save
    assert_includes user.errors[:name], "can't be blank"
  end
  
  test 'should not save user without email' do
    user = User.new(@valid_attributes.except(:email))
    assert_not user.save
    assert_includes user.errors[:email], "can't be blank"
  end
  
  test 'should not save user with invalid email' do
    user = User.new(@valid_attributes.merge(email: 'invalid-email'))
    assert_not user.save
    assert_includes user.errors[:email], 'is invalid'
  end
  
  test 'should not save user with duplicate email' do
    user1 = User.create!(@valid_attributes)
    user2 = User.new(@valid_attributes)
    assert_not user2.save
    assert_includes user2.errors[:email], 'has already been taken'
  end
  
  test 'should save user with valid attributes' do
    user = User.new(@valid_attributes)
    assert user.save
  end
  
  # Association tests
  test 'should have many posts' do
    assert_respond_to @user, :posts
    assert_kind_of ActiveRecord::Associations::CollectionProxy, @user.posts
  end
  
  test 'should have many comments' do
    assert_respond_to @user, :comments
  end
  
  # Instance method tests
  test 'full_name should return first and last name' do
    @user.first_name = 'John'
    @user.last_name = 'Doe'
    assert_equal 'John Doe', @user.full_name
  end
  
  test 'full_name should return first name only when last name is missing' do
    @user.first_name = 'John'
    @user.last_name = nil
    assert_equal 'John', @user.full_name
  end
  
  test 'active? should return true for active users' do
    @user.status = 'active'
    assert @user.active?
  end
  
  test 'active? should return false for inactive users' do
    @user.status = 'inactive'
    assert_not @user.active?
  end
  
  # Class method tests
  test 'active scope should return only active users' do
    active_user = User.create!(@valid_attributes.merge(status: 'active'))
    inactive_user = User.create!(@valid_attributes.merge(
      email: 'inactive@example.com',
      status: 'inactive'
    ))
    
    active_users = User.active
    assert_includes active_users, active_user
    assert_not_includes active_users, inactive_user
  end
  
  test 'find_by_email should find user by email' do
    user = User.create!(@valid_attributes)
    found_user = User.find_by_email(@valid_attributes[:email])
    assert_equal user, found_user
  end
  
  test 'find_by_email should return nil when user not found' do
    found_user = User.find_by_email('nonexistent@example.com')
    assert_nil found_user
  end
end
```

## Controller Test Example

```ruby
# spec/controllers/users_controller_spec.rb
require 'rails_helper'

RSpec.describe UsersController, type: :controller do
  let(:user) { create(:user) }
  let(:valid_attributes) { attributes_for(:user) }
  let(:invalid_attributes) { { name: '', email: 'invalid' } }
  
  describe 'GET #index' do
    it 'returns a success response' do
      get :index
      expect(response).to be_successful
    end
    
    it 'assigns @users' do
      user1 = create(:user)
      user2 = create(:user)
      get :index
      expect(assigns(:users)).to match_array([user1, user2])
    end
  end
  
  describe 'GET #show' do
    it 'returns a success response' do
      get :show, params: { id: user.to_param }
      expect(response).to be_successful
    end
    
    it 'assigns the requested user' do
      get :show, params: { id: user.to_param }
      expect(assigns(:user)).to eq(user)
    end
  end
  
  describe 'POST #create' do
    context 'with valid parameters' do
      it 'creates a new User' do
        expect {
          post :create, params: { user: valid_attributes }
        }.to change(User, :count).by(1)
      end
      
      it 'redirects to the created user' do
        post :create, params: { user: valid_attributes }
        expect(response).to redirect_to(User.last)
      end
    end
    
    context 'with invalid parameters' do
      it 'does not create a new User' do
        expect {
          post :create, params: { user: invalid_attributes }
        }.to change(User, :count).by(0)
      end
      
      it 'renders the new template' do
        post :create, params: { user: invalid_attributes }
        expect(response).to render_template(:new)
      end
    end
  end
  
  describe 'PUT #update' do
    context 'with valid parameters' do
      let(:new_attributes) { { name: 'Updated Name' } }
      
      it 'updates the requested user' do
        put :update, params: { id: user.to_param, user: new_attributes }
        user.reload
        expect(user.name).to eq('Updated Name')
      end
      
      it 'redirects to the user' do
        put :update, params: { id: user.to_param, user: new_attributes }
        expect(response).to redirect_to(user)
      end
    end
    
    context 'with invalid parameters' do
      it 'renders the edit template' do
        put :update, params: { id: user.to_param, user: invalid_attributes }
        expect(response).to render_template(:edit)
      end
    end
  end
  
  describe 'DELETE #destroy' do
    it 'destroys the requested user' do
      user # Create user
      expect {
        delete :destroy, params: { id: user.to_param }
      }.to change(User, :count).by(-1)
    end
    
    it 'redirects to the users list' do
      delete :destroy, params: { id: user.to_param }
      expect(response).to redirect_to(users_url)
    end
  end
end
```

## Factory Configuration

```ruby
# spec/factories/users.rb
FactoryBot.define do
  factory :user do
    sequence(:name) { |n| "User #{n}" }
    sequence(:email) { |n| "user#{n}@example.com" }
    age { rand(18..80) }
    status { 'active' }
    
    trait :inactive do
      status { 'inactive' }
    end
    
    trait :admin do
      admin { true }
    end
    
    trait :with_posts do
      after(:create) do |user|
        create_list(:post, 3, user: user)
      end
    end
    
    factory :admin_user, traits: [:admin]
    factory :inactive_user, traits: [:inactive]
  end
end
```

## Test Helper Configuration

```ruby
# spec/spec_helper.rb
require 'simplecov'
SimpleCov.start 'rails' do
  add_filter '/spec/'
  add_filter '/config/'
  add_filter '/vendor/'
  
  add_group 'Controllers', 'app/controllers'
  add_group 'Models', 'app/models'
  add_group 'Services', 'app/services'
  add_group 'Libraries', 'lib'
end

RSpec.configure do |config|
  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end
  
  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end
  
  config.shared_context_metadata_behavior = :apply_to_host_groups
  config.filter_run_when_matching :focus
  config.example_status_persistence_file_path = 'spec/examples.txt'
  config.disable_monkey_patching!
  config.warnings = true
  
  if config.files_to_run.one?
    config.default_formatter = 'doc'
  end
  
  config.profile_examples = 10
  config.order = :random
  Kernel.srand config.seed
end
```

## Integration Test Example

```ruby
# spec/requests/api/users_spec.rb
require 'rails_helper'

RSpec.describe 'API::Users', type: :request do
  let(:user) { create(:user) }
  let(:valid_headers) {
    { 'Authorization' => "Bearer #{user.auth_token}" }
  }
  
  describe 'GET /api/users' do
    it 'returns users' do
      create_list(:user, 3)
      
      get '/api/users', headers: valid_headers
      
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)['users'].size).to eq(3)
    end
  end
  
  describe 'POST /api/users' do
    let(:valid_params) do
      {
        user: {
          name: 'New User',
          email: 'new@example.com'
        }
      }
    end
    
    it 'creates a new user' do
      post '/api/users', params: valid_params, headers: valid_headers
      
      expect(response).to have_http_status(:created)
      expect(JSON.parse(response.body)['user']['name']).to eq('New User')
    end
  end
end
```

## Best Practices Included

- **Descriptive test names** that explain expected behavior
- **Proper test organization** with contexts and describes
- **Factory usage** for test data generation
- **Mocking and stubbing** for external dependencies
- **Coverage configuration** with SimpleCov
- **Test helpers** and shared examples
- **Request/Integration tests** for API endpoints
- **Feature tests** for user workflows