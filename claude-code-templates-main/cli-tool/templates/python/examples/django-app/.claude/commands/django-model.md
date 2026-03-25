# Django Model Generator

Create Django models with proper structure and relationships.

## Purpose

This command helps you quickly create Django models with fields, relationships, and best practices.

## Usage

```
/django-model
```

## What this command does

1. **Creates model classes** with proper field definitions
2. **Adds relationships** (ForeignKey, ManyToMany, OneToOne)
3. **Includes meta options** and model methods
4. **Generates migrations** automatically
5. **Follows Django conventions** and best practices

## Example Output

```python
# models.py
from django.db import models
from django.contrib.auth.models import User

class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name_plural = "categories"
        ordering = ['name']
    
    def __str__(self):
        return self.name

class Post(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]
    
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    content = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    tags = models.ManyToManyField('Tag', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'blog post'
        verbose_name_plural = 'blog posts'
    
    def __str__(self):
        return self.title
    
    def get_absolute_url(self):
        return reverse('post_detail', kwargs={'slug': self.slug})

class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(unique=True)
    
    def __str__(self):
        return self.name
```

## Field Types Supported

- **CharField** - Text fields with max length
- **TextField** - Large text fields
- **IntegerField** - Integer numbers
- **FloatField** - Floating point numbers
- **BooleanField** - True/False values
- **DateField** - Date only
- **DateTimeField** - Date and time
- **EmailField** - Email addresses
- **URLField** - URLs
- **ImageField** - Image uploads
- **FileField** - File uploads
- **JSONField** - JSON data (PostgreSQL)

## Relationships

- **ForeignKey** - One-to-many relationships
- **ManyToManyField** - Many-to-many relationships
- **OneToOneField** - One-to-one relationships

## Best Practices Included

- Proper field choices and defaults
- Appropriate related_name attributes
- __str__ methods for admin interface
- Meta class with ordering and verbose names
- get_absolute_url methods where appropriate
- Proper use of null and blank parameters
- Field validation and constraints

## After Creating Models

```bash
# Create and apply migrations
python manage.py makemigrations
python manage.py migrate

# Register in admin (optional)
# Add to admin.py:
from django.contrib import admin
from .models import Post, Category, Tag

admin.site.register([Post, Category, Tag])
```