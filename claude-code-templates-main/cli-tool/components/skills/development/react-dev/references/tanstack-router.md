# TanStack Router TypeScript Patterns

TanStack Router provides full type safety for routes, params, search params, and loader data.

## Basic Route Definition

```typescript
import { createRoute, createRootRoute } from '@tanstack/react-router';

// Root route
const rootRoute = createRootRoute({
  component: RootLayout,
});

// Basic route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

// Route tree
const routeTree = rootRoute.addChildren([indexRoute]);

// Router
const router = createRouter({ routeTree });

// Type for router - use in app
type Router = typeof router;
```

## Route with Params

```typescript
import { createRoute } from '@tanstack/react-router';
import { useParams } from '@tanstack/react-router';

const userRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users/$userId',
  component: UserPage,
});

function UserPage() {
  const { userId } = useParams({ from: userRoute.id });
  // userId is typed as string

  return <div>User ID: {userId}</div>;
}

// Multiple params
const postRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users/$userId/posts/$postId',
  component: PostPage,
});

function PostPage() {
  const { userId, postId } = useParams({ from: postRoute.id });
  // Both typed as string

  return <div>Post {postId} by user {userId}</div>;
}
```

## Search Params with Validation

```typescript
import { z } from 'zod';

const productsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/products',
  component: ProductsPage,
  validateSearch: z.object({
    category: z.string().optional(),
    sortBy: z.enum(['price', 'name', 'rating']).default('name'),
    page: z.number().int().positive().default(1),
    perPage: z.number().int().positive().default(20),
  }),
});

function ProductsPage() {
  const search = useSearch({ from: productsRoute.id });
  // search is typed from Zod schema:
  // {
  //   category?: string;
  //   sortBy: 'price' | 'name' | 'rating';
  //   page: number;
  //   perPage: number;
  // }

  return (
    <div>
      Category: {search.category || 'All'}
      Sort by: {search.sortBy}
      Page: {search.page}
    </div>
  );
}
```

## Loader Data

```typescript
type User = {
  id: string;
  name: string;
  email: string;
};

const userRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users/$userId',
  component: UserPage,
  loader: async ({ params }) => {
    const user = await fetchUser(params.userId);
    return { user };
  },
});

function UserPage() {
  const { user } = useLoaderData({ from: userRoute.id });
  // user typed as User

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}

async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}
```

## Loader with Search Params

```typescript
const productsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/products',
  component: ProductsPage,
  validateSearch: z.object({
    category: z.string().optional(),
    page: z.number().default(1),
  }),
  loader: async ({ search }) => {
    // search is typed from validateSearch
    const products = await fetchProducts({
      category: search.category,
      page: search.page,
    });

    return { products };
  },
});

function ProductsPage() {
  const { products } = useLoaderData({ from: productsRoute.id });
  const search = useSearch({ from: productsRoute.id });

  return (
    <div>
      <h1>Products - {search.category || 'All'}</h1>
      <ul>
        {products.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Type-Safe Navigation

```typescript
import { useNavigate, Link } from '@tanstack/react-router';

function ProductList() {
  const navigate = useNavigate();

  const goToProduct = (productId: string) => {
    navigate({
      to: '/products/$productId',
      params: { productId }, // Type-checked
      search: { tab: 'reviews' }, // Type-checked against validateSearch
    });
  };

  return (
    <div>
      {products.map((product) => (
        <Link
          key={product.id}
          to="/products/$productId"
          params={{ productId: product.id }}
          search={{ tab: 'details' }}
        >
          {product.name}
        </Link>
      ))}
    </div>
  );
}
```

## Search Params Manipulation

```typescript
import { useNavigate, useSearch } from '@tanstack/react-router';

const productsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/products',
  validateSearch: z.object({
    category: z.string().optional(),
    sortBy: z.enum(['price', 'name']).default('name'),
    page: z.number().default(1),
  }),
});

function ProductFilters() {
  const navigate = useNavigate({ from: productsRoute.id });
  const search = useSearch({ from: productsRoute.id });

  const updateCategory = (category: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        category, // Type-checked
        page: 1, // Reset page
      }),
    });
  };

  const updateSort = (sortBy: 'price' | 'name') => {
    navigate({
      search: (prev) => ({ ...prev, sortBy }),
    });
  };

  return (
    <div>
      <select value={search.category || ''} onChange={(e) => updateCategory(e.target.value)}>
        <option value="">All Categories</option>
        <option value="electronics">Electronics</option>
        <option value="books">Books</option>
      </select>

      <select value={search.sortBy} onChange={(e) => updateSort(e.target.value as 'price' | 'name')}>
        <option value="name">Name</option>
        <option value="price">Price</option>
      </select>
    </div>
  );
}
```

## Nested Routes

```typescript
const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users',
  component: UsersLayout,
});

const usersIndexRoute = createRoute({
  getParentRoute: () => usersRoute,
  path: '/',
  component: UsersList,
});

const userDetailRoute = createRoute({
  getParentRoute: () => usersRoute,
  path: '$userId',
  component: UserDetail,
});

const routeTree = rootRoute.addChildren([
  usersRoute.addChildren([
    usersIndexRoute,
    userDetailRoute,
  ]),
]);

// Layout component with outlet
function UsersLayout() {
  return (
    <div>
      <h1>Users</h1>
      <Outlet /> {/* Renders child route */}
    </div>
  );
}
```

## Before Load Hook

```typescript
const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  beforeLoad: async ({ location }) => {
    const isAuthenticated = await checkAuth();

    if (!isAuthenticated) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      });
    }

    return { user: await getCurrentUser() };
  },
  component: Dashboard,
});

function Dashboard() {
  const { user } = useLoaderData({ from: protectedRoute.id });
  // user available from beforeLoad

  return <div>Welcome, {user.name}</div>;
}
```

## Error Handling

```typescript
const userRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users/$userId',
  component: UserPage,
  errorComponent: UserErrorPage,
  loader: async ({ params }) => {
    const user = await fetchUser(params.userId);
    if (!user) {
      throw new Error('User not found');
    }
    return { user };
  },
});

function UserErrorPage({ error }: { error: Error }) {
  return (
    <div>
      <h1>Error</h1>
      <p>{error.message}</p>
      <Link to="/users">Back to users</Link>
    </div>
  );
}
```

## Pending Component

```typescript
const userRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users/$userId',
  component: UserPage,
  pendingComponent: UserPageSkeleton,
  loader: async ({ params }) => {
    const user = await fetchUser(params.userId);
    return { user };
  },
});

function UserPageSkeleton() {
  return (
    <div>
      <div className="skeleton-header" />
      <div className="skeleton-body" />
    </div>
  );
}
```

## Router Context

Share data across all routes.

```typescript
type RouterContext = {
  auth: { user: User | null };
  queryClient: QueryClient;
};

const rootRoute = createRootRoute<RouterContext>({
  component: RootLayout,
});

const router = createRouter({
  routeTree,
  context: {
    auth: { user: null },
    queryClient: new QueryClient(),
  },
});

// Access in route
const userRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users/$userId',
  beforeLoad: ({ context }) => {
    // context typed as RouterContext
    console.log(context.auth.user);
  },
});
```

## Route Masks

Hide actual URL structure.

```typescript
const userRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users/$userId',
});

// Navigate with mask
navigate({
  to: '/users/$userId',
  params: { userId: '123' },
  mask: {
    to: '/profile',
  },
});

// URL shows /profile but renders /users/123
```

## Search Param Middleware

Transform search params before validation.

```typescript
const productsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/products',
  validateSearch: z.object({
    tags: z.array(z.string()).default([]),
  }),
  loaderDeps: ({ search }) => ({ tags: search.tags }),
  loader: async ({ deps }) => {
    const products = await fetchProducts({ tags: deps.tags });
    return { products };
  },
});

// URL: /products?tags=electronics&tags=sale
// search.tags = ['electronics', 'sale']
```

## Type Helpers

```typescript
import type { RouteIds, RouteById } from '@tanstack/react-router';

// Get all route IDs
type AllRouteIds = RouteIds<typeof router>;

// Get specific route type
type UserRoute = RouteById<typeof router, '/users/$userId'>;

// Extract params type
type UserParams = UserRoute['types']['allParams'];

// Extract search type
type UserSearch = UserRoute['types']['fullSearchSchema'];
```

## Preloading Routes

```typescript
import { useRouter } from '@tanstack/react-router';

function ProductCard({ productId }: { productId: string }) {
  const router = useRouter();

  const preloadProduct = () => {
    router.preloadRoute({
      to: '/products/$productId',
      params: { productId },
    });
  };

  return (
    <Link
      to="/products/$productId"
      params={{ productId }}
      onMouseEnter={preloadProduct} // Preload on hover
    >
      View Product
    </Link>
  );
}
```

## Route Matching

```typescript
import { useMatches, useMatch } from '@tanstack/react-router';

function Navigation() {
  const matches = useMatches();
  // Array of all matched routes

  const userMatch = useMatch({ from: userRoute.id, shouldThrow: false });
  // userMatch is typed, null if not matched

  return (
    <nav>
      {matches.map((match) => (
        <span key={match.id}>{match.pathname}</span>
      ))}
    </nav>
  );
}
```

## File-Based Routing (Code Generation)

```typescript
// routes/__root.tsx
export const Route = createRootRoute({
  component: RootLayout,
});

// routes/index.tsx
export const Route = createFileRoute('/')({
  component: HomePage,
});

// routes/users/$userId.tsx
export const Route = createFileRoute('/users/$userId')({
  component: UserPage,
  loader: async ({ params }) => {
    const user = await fetchUser(params.userId);
    return { user };
  },
});

// Generate route tree with CLI
// npm run generate-routes

// Import generated routes
import { routeTree } from './routeTree.gen';
const router = createRouter({ routeTree });
```

## Integration with React Query

```typescript
import { queryOptions, useQuery } from '@tanstack/react-query';

const userQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });

const userRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users/$userId',
  loader: ({ context, params }) => {
    // Prefetch with React Query
    return context.queryClient.ensureQueryData(userQueryOptions(params.userId));
  },
  component: UserPage,
});

function UserPage() {
  const { userId } = useParams({ from: userRoute.id });

  // Use same query options in component
  const { data: user } = useQuery(userQueryOptions(userId));

  return <div>{user?.name}</div>;
}
```
