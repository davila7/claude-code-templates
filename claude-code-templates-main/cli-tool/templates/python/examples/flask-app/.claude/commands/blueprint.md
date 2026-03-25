# Flask Blueprint Generator

Create organized Flask blueprints for modular application structure.

## Usage

```bash
# Create a new blueprint
flask create-blueprint users
flask create-blueprint api/v1
```

## Blueprint Structure

Generates a complete blueprint with:
- Routes and view functions
- Error handlers
- Template folder structure
- Static file organization

## Example Blueprint

```python
# app/blueprints/users/__init__.py
from flask import Blueprint

users_bp = Blueprint(
    'users',
    __name__,
    url_prefix='/users',
    template_folder='templates',
    static_folder='static'
)

from . import routes, models

# app/blueprints/users/routes.py
from flask import render_template, request, redirect, url_for, flash
from . import users_bp
from .models import User
from .forms import UserForm

@users_bp.route('/')
def index():
    """List all users."""
    users = User.query.all()
    return render_template('users/index.html', users=users)

@users_bp.route('/create', methods=['GET', 'POST'])
def create():
    """Create a new user."""
    form = UserForm()
    if form.validate_on_submit():
        user = User(
            username=form.username.data,
            email=form.email.data
        )
        user.save()
        flash('User created successfully!', 'success')
        return redirect(url_for('users.index'))
    return render_template('users/create.html', form=form)

@users_bp.route('/<int:user_id>')
def detail(user_id):
    """Show user details."""
    user = User.query.get_or_404(user_id)
    return render_template('users/detail.html', user=user)

@users_bp.route('/<int:user_id>/edit', methods=['GET', 'POST'])
def edit(user_id):
    """Edit an existing user."""
    user = User.query.get_or_404(user_id)
    form = UserForm(obj=user)
    if form.validate_on_submit():
        user.username = form.username.data
        user.email = form.email.data
        user.save()
        flash('User updated successfully!', 'success')
        return redirect(url_for('users.detail', user_id=user.id))
    return render_template('users/edit.html', form=form, user=user)

@users_bp.route('/<int:user_id>/delete', methods=['POST'])
def delete(user_id):
    """Delete a user."""
    user = User.query.get_or_404(user_id)
    user.delete()
    flash('User deleted successfully!', 'success')
    return redirect(url_for('users.index'))

# Error handlers
@users_bp.errorhandler(404)
def not_found(error):
    return render_template('users/404.html'), 404

@users_bp.errorhandler(500)
def internal_error(error):
    return render_template('users/500.html'), 500
```

## Blueprint Models

```python
# app/blueprints/users/models.py
from app.extensions import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

class User(db.Model):
    """User model."""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    def __repr__(self):
        return f'<User {self.username}>'
    
    def set_password(self, password):
        """Set password hash."""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check password hash."""
        return check_password_hash(self.password_hash, password)
    
    def save(self):
        """Save user to database."""
        db.session.add(self)
        db.session.commit()
    
    def delete(self):
        """Delete user from database."""
        db.session.delete(self)
        db.session.commit()
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat(),
            'is_active': self.is_active
        }
```

## Blueprint Forms

```python
# app/blueprints/users/forms.py
from flask_wtf import FlaskForm
from wtforms import StringField, EmailField, PasswordField, BooleanField
from wtforms.validators import DataRequired, Email, Length, EqualTo
from .models import User

class UserForm(FlaskForm):
    """User creation/edit form."""
    username = StringField(
        'Username',
        validators=[
            DataRequired(),
            Length(min=3, max=80)
        ]
    )
    email = EmailField(
        'Email',
        validators=[
            DataRequired(),
            Email(),
            Length(max=120)
        ]
    )
    password = PasswordField(
        'Password',
        validators=[
            DataRequired(),
            Length(min=8)
        ]
    )
    confirm_password = PasswordField(
        'Confirm Password',
        validators=[
            DataRequired(),
            EqualTo('password', message='Passwords must match')
        ]
    )
    is_active = BooleanField('Active')
    
    def validate_username(self, field):
        """Validate username uniqueness."""
        if User.query.filter_by(username=field.data).first():
            raise ValidationError('Username already exists.')
    
    def validate_email(self, field):
        """Validate email uniqueness."""
        if User.query.filter_by(email=field.data).first():
            raise ValidationError('Email already registered.')
```

## Registration in Main App

```python
# app/__init__.py
from flask import Flask
from app.blueprints.users import users_bp

def create_app():
    app = Flask(__name__)
    
    # Register blueprints
    app.register_blueprint(users_bp)
    
    return app
```

## Template Structure

```
templates/
├── base.html
└── users/
    ├── index.html
    ├── create.html
    ├── detail.html
    ├── edit.html
    ├── 404.html
    └── 500.html
```

## Best Practices

- Use blueprints to organize related functionality
- Keep models, forms, and routes in separate files
- Implement proper error handling
- Use URL prefixes for namespacing
- Follow RESTful routing conventions
- Include comprehensive docstrings
- Add form validation and CSRF protection
