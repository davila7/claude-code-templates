# Django Views Generator

Create Django views with proper structure and best practices.

## Purpose

This command helps you quickly create Django views (Function-Based Views and Class-Based Views) following Django conventions.

## Usage

```
/views
```

## What this command does

1. **Creates view functions/classes** with proper structure
2. **Handles HTTP methods** (GET, POST, PUT, DELETE)
3. **Includes form handling** and validation
4. **Adds authentication/authorization** checks
5. **Follows Django best practices** and security guidelines

## Example Output

```python
# views.py
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy
from .models import Post, Category
from .forms import PostForm

# Function-Based Views
def post_list(request):
    """Display list of posts with pagination and filtering."""
    posts = Post.objects.filter(status='published').select_related('author', 'category')
    
    # Search functionality
    search_query = request.GET.get('search')
    if search_query:
        posts = posts.filter(title__icontains=search_query)
    
    # Category filtering
    category_id = request.GET.get('category')
    if category_id:
        posts = posts.filter(category_id=category_id)
    
    context = {
        'posts': posts,
        'categories': Category.objects.all(),
        'search_query': search_query,
    }
    return render(request, 'blog/post_list.html', context)

def post_detail(request, slug):
    """Display individual post details."""
    post = get_object_or_404(Post, slug=slug, status='published')
    
    context = {
        'post': post,
        'related_posts': Post.objects.filter(
            category=post.category,
            status='published'
        ).exclude(id=post.id)[:3]
    }
    return render(request, 'blog/post_detail.html', context)

@login_required
def post_create(request):
    """Create new post."""
    if request.method == 'POST':
        form = PostForm(request.POST, request.FILES)
        if form.is_valid():
            post = form.save(commit=False)
            post.author = request.user
            post.save()
            form.save_m2m()  # Save many-to-many relationships
            messages.success(request, 'Post created successfully!')
            return redirect('post_detail', slug=post.slug)
    else:
        form = PostForm()
    
    return render(request, 'blog/post_form.html', {'form': form})

@login_required
def post_edit(request, slug):
    """Edit existing post."""
    post = get_object_or_404(Post, slug=slug, author=request.user)
    
    if request.method == 'POST':
        form = PostForm(request.POST, request.FILES, instance=post)
        if form.is_valid():
            form.save()
            messages.success(request, 'Post updated successfully!')
            return redirect('post_detail', slug=post.slug)
    else:
        form = PostForm(instance=post)
    
    return render(request, 'blog/post_form.html', {
        'form': form, 
        'post': post
    })

# Class-Based Views
class PostListView(ListView):
    """List view for posts with pagination."""
    model = Post
    template_name = 'blog/post_list.html'
    context_object_name = 'posts'
    paginate_by = 10
    
    def get_queryset(self):
        return Post.objects.filter(status='published').select_related('author', 'category')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['categories'] = Category.objects.all()
        return context

class PostDetailView(DetailView):
    """Detail view for individual posts."""
    model = Post
    template_name = 'blog/post_detail.html'
    context_object_name = 'post'
    
    def get_queryset(self):
        return Post.objects.filter(status='published')

class PostCreateView(LoginRequiredMixin, CreateView):
    """Create view for new posts."""
    model = Post
    form_class = PostForm
    template_name = 'blog/post_form.html'
    
    def form_valid(self, form):
        form.instance.author = self.request.user
        return super().form_valid(form)

class PostUpdateView(LoginRequiredMixin, UpdateView):
    """Update view for existing posts."""
    model = Post
    form_class = PostForm
    template_name = 'blog/post_form.html'
    
    def get_queryset(self):
        return Post.objects.filter(author=self.request.user)

class PostDeleteView(LoginRequiredMixin, DeleteView):
    """Delete view for posts."""
    model = Post
    template_name = 'blog/post_confirm_delete.html'
    success_url = reverse_lazy('post_list')
    
    def get_queryset(self):
        return Post.objects.filter(author=self.request.user)

# API Views
def api_post_list(request):
    """API endpoint for post list."""
    posts = Post.objects.filter(status='published').values(
        'id', 'title', 'slug', 'created_at', 'author__username'
    )
    return JsonResponse(list(posts), safe=False)
```

## View Types Supported

- **Function-Based Views (FBV)** - Simple, explicit control
- **Class-Based Views (CBV)** - Reusable, inheritance-based
- **Generic Views** - ListView, DetailView, CreateView, etc.
- **API Views** - JSON responses for AJAX/API calls

## Features Included

- **Authentication checks** with decorators/mixins
- **Permission handling** for user authorization
- **Form processing** with validation
- **Error handling** and user feedback
- **SEO-friendly URLs** with slugs
- **Database optimization** with select_related/prefetch_related
- **Pagination** for large datasets
- **Search and filtering** functionality

## Security Best Practices

- CSRF protection (automatic with forms)
- User authentication and authorization
- SQL injection prevention (ORM)
- XSS protection with template escaping
- Proper error handling

## URL Configuration

```python
# urls.py
from django.urls import path
from . import views

app_name = 'blog'

urlpatterns = [
    # Function-based views
    path('', views.post_list, name='post_list'),
    path('post/<slug:slug>/', views.post_detail, name='post_detail'),
    path('create/', views.post_create, name='post_create'),
    path('edit/<slug:slug>/', views.post_edit, name='post_edit'),
    
    # Class-based views
    path('posts/', views.PostListView.as_view(), name='post_list_cbv'),
    path('posts/<slug:slug>/', views.PostDetailView.as_view(), name='post_detail_cbv'),
    path('posts/create/', views.PostCreateView.as_view(), name='post_create_cbv'),
    path('posts/<slug:slug>/edit/', views.PostUpdateView.as_view(), name='post_edit_cbv'),
    path('posts/<slug:slug>/delete/', views.PostDeleteView.as_view(), name='post_delete_cbv'),
    
    # API endpoints
    path('api/posts/', views.api_post_list, name='api_post_list'),
]
```