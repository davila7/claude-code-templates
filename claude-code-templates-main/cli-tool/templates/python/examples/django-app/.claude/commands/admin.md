# Django Admin Configuration

Configure Django admin interface with custom admin classes and functionality.

## Purpose

This command helps you create comprehensive Django admin configurations with advanced features and customizations.

## Usage

```
/admin
```

## What this command does

1. **Registers models** with custom admin classes
2. **Creates advanced admin interfaces** with filtering, search, and actions
3. **Adds inline editing** for related models
4. **Customizes list displays** and forms
5. **Implements admin actions** for bulk operations

## Example Output

```python
# admin.py
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import Post, Category, Tag, Comment

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    """Admin configuration for Category model."""
    list_display = ['name', 'slug', 'post_count', 'created_at']
    list_filter = ['created_at']
    search_fields = ['name', 'description']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['created_at', 'updated_at']
    
    def post_count(self, obj):
        """Display number of posts in this category."""
        count = obj.posts.count()
        url = reverse('admin:blog_post_changelist') + f'?category__id__exact={obj.id}'
        return format_html('<a href="{}">{} posts</a>', url, count)
    post_count.short_description = 'Posts'

class CommentInline(admin.TabularInline):
    """Inline admin for comments."""
    model = Comment
    extra = 0
    readonly_fields = ['created_at', 'author']
    fields = ['author', 'content', 'is_approved', 'created_at']

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    """Advanced admin configuration for Post model."""
    list_display = [
        'title', 
        'author', 
        'category', 
        'status', 
        'view_count',
        'created_at',
        'post_preview'
    ]
    list_filter = [
        'status', 
        'category', 
        'created_at', 
        'updated_at',
        ('author', admin.RelatedOnlyFieldListFilter)
    ]
    search_fields = ['title', 'content', 'author__username']
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ['created_at', 'updated_at', 'view_count', 'post_preview']
    
    # Custom form layout
    fieldsets = (
        ('Content', {
            'fields': ('title', 'slug', 'content', 'status')
        }),
        ('Metadata', {
            'fields': ('author', 'category', 'tags'),
            'classes': ('collapse',)
        }),
        ('SEO', {
            'fields': ('meta_description', 'meta_keywords'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'view_count'),
            'classes': ('collapse',)
        }),
    )
    
    # Many-to-many field display
    filter_horizontal = ['tags']
    
    # Inline models
    inlines = [CommentInline]
    
    # Custom list display methods
    def post_preview(self, obj):
        """Show thumbnail preview of post."""
        if obj.featured_image:
            return format_html(
                '<img src="{}" width="50" height="50" style="border-radius: 5px;" />',
                obj.featured_image.url
            )
        return "No image"
    post_preview.short_description = 'Preview'
    
    # Custom admin actions
    actions = ['make_published', 'make_draft', 'duplicate_posts']
    
    def make_published(self, request, queryset):
        """Bulk action to publish selected posts."""
        updated = queryset.update(status='published')
        self.message_user(
            request, 
            f'{updated} posts were successfully marked as published.'
        )
    make_published.short_description = "Mark selected posts as published"
    
    def make_draft(self, request, queryset):
        """Bulk action to set selected posts as draft."""
        updated = queryset.update(status='draft')
        self.message_user(
            request, 
            f'{updated} posts were successfully marked as draft.'
        )
    make_draft.short_description = "Mark selected posts as draft"
    
    def duplicate_posts(self, request, queryset):
        """Bulk action to duplicate selected posts."""
        count = 0
        for post in queryset:
            post.pk = None  # Create new instance
            post.title = f"Copy of {post.title}"
            post.slug = f"copy-of-{post.slug}"
            post.status = 'draft'
            post.save()
            count += 1
        
        self.message_user(
            request,
            f'{count} posts were successfully duplicated.'
        )
    duplicate_posts.short_description = "Duplicate selected posts"

@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    """Admin configuration for Tag model."""
    list_display = ['name', 'slug', 'post_count', 'color_preview']
    search_fields = ['name']
    prepopulated_fields = {'slug': ('name',)}
    
    def post_count(self, obj):
        """Display number of posts with this tag."""
        return obj.posts.count()
    post_count.short_description = 'Posts'
    
    def color_preview(self, obj):
        """Show color preview if tag has color field."""
        if hasattr(obj, 'color') and obj.color:
            return format_html(
                '<span style="background-color: {}; padding: 2px 8px; border-radius: 3px; color: white;">{}</span>',
                obj.color,
                obj.name
            )
        return obj.name
    color_preview.short_description = 'Preview'

@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    """Admin configuration for Comment model."""
    list_display = ['author', 'post', 'content_preview', 'is_approved', 'created_at']
    list_filter = ['is_approved', 'created_at', 'post__category']
    search_fields = ['content', 'author__username', 'post__title']
    readonly_fields = ['created_at', 'updated_at']
    actions = ['approve_comments', 'disapprove_comments']
    
    def content_preview(self, obj):
        """Show truncated content preview."""
        return obj.content[:50] + "..." if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Content'
    
    def approve_comments(self, request, queryset):
        """Bulk approve comments."""
        updated = queryset.update(is_approved=True)
        self.message_user(request, f'{updated} comments were approved.')
    approve_comments.short_description = "Approve selected comments"
    
    def disapprove_comments(self, request, queryset):
        """Bulk disapprove comments."""
        updated = queryset.update(is_approved=False)
        self.message_user(request, f'{updated} comments were disapproved.')
    disapprove_comments.short_description = "Disapprove selected comments"

# Custom admin site configuration
admin.site.site_header = "Blog Administration"
admin.site.site_title = "Blog Admin Portal"
admin.site.index_title = "Welcome to Blog Administration"
```

## Advanced Features

### Custom List Display
- **Thumbnail previews** for images
- **Related object counts** with links
- **Status indicators** with colors
- **Custom formatting** for data display

### Filtering and Search
- **Advanced filters** including date ranges
- **Related field filtering** for foreign keys
- **Search across multiple fields** including relations
- **Custom filter classes** for complex queries

### Inline Editing
- **TabularInline** for compact editing
- **StackedInline** for detailed forms
- **Custom inline forms** with additional functionality
- **Readonly fields** in inlines

### Bulk Actions
- **Status changes** for multiple objects
- **Data export** functionality
- **Batch operations** for efficiency
- **Custom business logic** in actions

### Form Customization
- **Fieldsets** for organized layouts
- **Collapsed sections** for advanced options
- **Custom widgets** for better UX
- **Validation** and error handling

## Security Considerations

- **Permission checks** in custom methods
- **Input sanitization** in admin actions
- **CSRF protection** (automatic)
- **User authentication** (built-in)

## Performance Optimization

```python
# Optimize queries with select_related/prefetch_related
class PostAdmin(admin.ModelAdmin):
    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.select_related('author', 'category').prefetch_related('tags')
```

## Custom Admin Templates

```python
# Override admin templates
class PostAdmin(admin.ModelAdmin):
    change_form_template = 'admin/blog/post/change_form.html'
    change_list_template = 'admin/blog/post/change_list.html'
```