# Flask Route Generator

Create Flask routes with proper structure and error handling.

## Purpose

This command helps you quickly create Flask routes with validation, error handling, and best practices.

## Usage

```
/flask-route
```

## What this command does

1. **Creates route functions** with proper decorators
2. **Adds request validation** and error handling
3. **Includes JSON responses** and status codes
4. **Implements authentication** if needed
5. **Follows Flask conventions** and best practices

## Example Output

```python
# routes.py or app.py
from flask import Flask, request, jsonify, abort
from flask_sqlalchemy import SQLAlchemy
from werkzeug.exceptions import BadRequest

app = Flask(__name__)

@app.route('/users', methods=['GET'])
def get_users():
    """Get all users with optional pagination."""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        users = User.query.paginate(
            page=page, 
            per_page=per_page, 
            error_out=False
        )
        
        return jsonify({
            'users': [user.to_dict() for user in users.items],
            'total': users.total,
            'pages': users.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to fetch users'}), 500

@app.route('/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    """Get a specific user by ID."""
    try:
        user = User.query.get_or_404(user_id)
        return jsonify(user.to_dict()), 200
        
    except Exception as e:
        return jsonify({'error': 'User not found'}), 404

@app.route('/users', methods=['POST'])
def create_user():
    """Create a new user."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['name', 'email']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Check if email already exists
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 409
        
        # Create new user
        user = User(
            name=data['name'],
            email=data['email'],
            phone=data.get('phone'),
            address=data.get('address')
        )
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify(user.to_dict()), 201
        
    except BadRequest:
        return jsonify({'error': 'Invalid JSON data'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create user'}), 500

@app.route('/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    """Update an existing user."""
    try:
        user = User.query.get_or_404(user_id)
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Update fields
        if 'name' in data:
            user.name = data['name']
        if 'email' in data:
            # Check if new email already exists
            existing_user = User.query.filter_by(email=data['email']).first()
            if existing_user and existing_user.id != user_id:
                return jsonify({'error': 'Email already exists'}), 409
            user.email = data['email']
        if 'phone' in data:
            user.phone = data['phone']
        if 'address' in data:
            user.address = data['address']
        
        db.session.commit()
        
        return jsonify(user.to_dict()), 200
        
    except BadRequest:
        return jsonify({'error': 'Invalid JSON data'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update user'}), 500

@app.route('/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete a user."""
    try:
        user = User.query.get_or_404(user_id)
        
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({'message': 'User deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete user'}), 500

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Resource not found'}), 404

@app.errorhandler(400)
def bad_request(error):
    return jsonify({'error': 'Bad request'}), 400

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500
```

## Route Patterns Supported

### Basic Routes
```python
@app.route('/')
@app.route('/users')
@app.route('/users/<int:user_id>')
```

### HTTP Methods
```python
@app.route('/users', methods=['GET', 'POST'])
@app.route('/users/<int:id>', methods=['GET', 'PUT', 'DELETE'])
```

### URL Parameters
```python
@app.route('/users/<int:user_id>')
@app.route('/posts/<string:slug>')
@app.route('/files/<path:filename>')
```

## Best Practices Included

- **Input validation** for all user data
- **Proper HTTP status codes** (200, 201, 400, 404, 500)
- **JSON responses** with consistent structure
- **Error handling** with try/catch blocks
- **Database rollback** on errors
- **RESTful conventions** for URL design
- **Documentation strings** for each route
- **Request data validation** before processing

## Common Response Patterns

```python
# Success with data
return jsonify({'data': result}), 200

# Created resource
return jsonify({'data': new_resource, 'id': new_id}), 201

# Validation error
return jsonify({'error': 'Field is required'}), 400

# Not found
return jsonify({'error': 'Resource not found'}), 404

# Server error
return jsonify({'error': 'Internal server error'}), 500
```