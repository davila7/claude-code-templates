# React Router v7 - Comprehensive Reference Guide

## Overview

React Router is a modern routing library that provides flexible client-side and server-side routing for React applications. It offers two primary modes of operation: Framework Mode and Data Mode, with first-class TypeScript support through automatic type generation.

## Installation and Setup

### Basic Installation

```bash
npm install react-router
```

### TypeScript Configuration

React Router generates type-specific files for each route. Configure your `tsconfig.json`:

```json
{
  "include": [".react-router/types/**/*"],
  "compilerOptions": {
    "rootDirs": [".", "./.react-router/types"]
  }
}
```

Add `.react-router/` to `.gitignore`:

```txt
.react-router/
```

### Extending AppLoadContext

Define your app's context type in a `.ts` or `.d.ts` file:

```typescript
import "react-router";

declare module "react-router" {
  interface AppLoadContext {
    // add context properties here
    apiClient?: APIClient;
    userId?: string;
  }
}
```

## Route Definition Patterns

### Basic Route Configuration

Routes are defined as objects passed to `createBrowserRouter`:

```tsx
import { createBrowserRouter } from "react-router";

const router = createBrowserRouter([
  {
    path: "/",
    Component: Root
  },
  {
    path: "/about",
    Component: About
  },
]);
```

### Nested Routes

Child routes are rendered through an `<Outlet/>` in the parent component:

```tsx
createBrowserRouter([
  {
    path: "/dashboard",
    Component: Dashboard,
    children: [
      { index: true, Component: DashboardHome },
      { path: "settings", Component: Settings },
    ],
  },
]);

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Outlet /> {/* Renders child route */}
    </div>
  );
}
```

### Layout Routes (No Path)

Create layout containers without adding URL segments:

```tsx
createBrowserRouter([
  {
    // no path - just a layout
    Component: MarketingLayout,
    children: [
      { index: true, Component: Home },
      { path: "contact", Component: Contact },
    ],
  },
]);
```

### Index Routes

Define default routes at a path:

```tsx
createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home }, // renders at "/"
      { path: "about", Component: About },
    ],
  },
]);
```

### Dynamic Segments

Use colons to define dynamic parameters:

```tsx
{
  path: "teams/:teamId",
  loader: async ({ params }) => {
    return await fetchTeam(params.teamId);
  },
  Component: Team,
}
```

Multiple dynamic segments:

```tsx
{
  path: "posts/:postId/comments/:commentId",
  // params.postId and params.commentId available
}
```

### Optional Segments

```tsx
{
  path: ":lang?/categories" // lang is optional
}
```

### Splat Routes (Catchall)

```tsx
{
  path: "files/*",
  loader: async ({ params }) => {
    const splat = params["*"]; // remaining URL after "files/"
  },
}
```

## TypeScript Typing

### Route Type Imports

In Framework Mode, import route-specific types from the generated `+types` directory:

```tsx
import type { Route } from "./+types/product";

export async function loader({ params }: Route.LoaderArgs) {
  // params is typed as { id: string }
  return { planet: `world #${params.id}` };
}

export default function Product({
  loaderData, // typed from loader
}: Route.ComponentProps) {
  return <h1>{loaderData.planet}</h1>;
}
```

### Generated Types

React Router generates these types for each route:

- `Route.LoaderArgs` - Loader function arguments
- `Route.ClientLoaderArgs` - Client loader arguments
- `Route.ActionArgs` - Action function arguments
- `Route.ClientActionArgs` - Client action arguments
- `Route.ComponentProps` - Props for default export
- `Route.ErrorBoundaryProps` - Props for ErrorBoundary
- `Route.HydrateFallbackProps` - Props for HydrateFallback

### Manual Loader Data Typing

In Data Mode, type loader data manually:

```tsx
export async function loader() {
  return { invoices: await getInvoices() };
}

export default function Invoices() {
  const data = useLoaderData<typeof loader>();
  // data is typed as { invoices: ... }
}
```

### Action Data Typing

```tsx
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  return { message: `Hello, ${formData.get("name")}` };
}

export default function Form() {
  const actionData = useActionData<typeof action>();
  // actionData is typed correctly
}
```

## Data Loading with Loaders

### Basic Loader Pattern

Loaders provide data to route components before rendering:

```tsx
createBrowserRouter([
  {
    path: "/posts/:postId",
    loader: async ({ params }) => {
      const post = await fetchPost(params.postId);
      return { post };
    },
    Component: Post,
  },
]);

function Post() {
  const { post } = useLoaderData();
  return <h1>{post.title}</h1>;
}
```

### Loader Arguments

```tsx
type LoaderFunctionArgs = {
  params: Params; // URL parameters
  request: Request; // fetch API Request
  context?: AppLoadContext; // shared context
};
```

### Error Handling in Loaders

Throw errors with `data()` function for client-side error boundaries:

```tsx
import { data } from "react-router";

export async function loader({ params }: Route.LoaderArgs) {
  const record = await fakeDb.getRecord(params.id);

  if (!record) {
    throw data("Record Not Found", { status: 404 });
  }

  return record;
}
```

### Revalidation Control

Control when loaders rerun:

```tsx
export const shouldRevalidate: ShouldRevalidateFunctionArgs = (args) => {
  // Return true to revalidate, false to skip
  // Default: true when params change or after successful action
  return true;
};
```

### Lazy Loading

Load components and loaders on-demand:

```tsx
{
  path: "/app",
  lazy: async () => {
    const { Component, loader } = await import("./app");
    return { Component, loader };
  },
}
```

## Actions and Form Handling

### Basic Action Pattern

Actions handle form submissions and mutations:

```tsx
createBrowserRouter([
  {
    path: "/projects",
    action: async ({ request }) => {
      const formData = await request.formData();
      const title = formData.get("title");
      const project = await createProject({ title });
      return project; // data available via useActionData
    },
    Component: Projects,
  },
]);
```

### Form Submission Methods

#### Using `<Form>` Component

Causes navigation and adds history entry:

```tsx
import { Form } from "react-router";

export default function CreateEvent() {
  return (
    <Form action="/events" method="post">
      <input type="text" name="title" />
      <button type="submit">Create</button>
    </Form>
  );
}
```

#### Using `useSubmit` Hook

Imperative form submission:

```tsx
import { useSubmit } from "react-router";

export default function Timer() {
  const submit = useSubmit();

  const handleTimeout = () => {
    submit(
      { quizTimedOut: true },
      { action: "/end-quiz", method: "post" }
    );
  };

  return <div>{/* ... */}</div>;
}
```

#### Using `useFetcher` Hook

Submit without navigation (no history entry):

```tsx
import { useFetcher } from "react-router";

export default function Task() {
  const fetcher = useFetcher();

  return (
    <fetcher.Form method="post" action="/update-task/123">
      <input type="text" name="title" />
      <button type="submit">Save</button>
    </fetcher.Form>
  );
}
```

### Form Validation

Return errors with non-2xx status codes:

```tsx
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email"));

  const errors: Record<string, string> = {};

  if (!email.includes("@")) {
    errors.email = "Invalid email";
  }

  if (Object.keys(errors).length > 0) {
    return data({ errors }, { status: 400 }); // Don't revalidate
  }

  await createUser({ email });
  return redirect("/dashboard");
}

export default function Signup() {
  const fetcher = useFetcher();
  const errors = fetcher.data?.errors;

  return (
    <fetcher.Form method="post">
      <input name="email" />
      {errors?.email && <span>{errors.email}</span>}
      <button>Sign Up</button>
    </fetcher.Form>
  );
}
```

### Accessing Action Data

```tsx
import { useActionData } from "react-router";

export default function Project() {
  const actionData = useActionData<typeof action>();

  return (
    <div>
      <Form method="post">
        {/* form fields */}
      </Form>
      {actionData && <p>Success: {actionData.message}</p>}
    </div>
  );
}
```

## Navigation Patterns

### Link Component

For client-side navigation without active styling:

```tsx
import { Link } from "react-router";

<Link to="/dashboard">Dashboard</Link>

<Link to={{
  pathname: "/search",
  search: "?q=react",
  hash: "#results"
}}>
  Search
</Link>
```

### NavLink Component

For navigation with active/pending states:

```tsx
import { NavLink } from "react-router";

<NavLink to="/messages">
  {({ isActive, isPending }) => (
    <span className={isActive ? "active" : ""}>
      Messages
    </span>
  )}
</NavLink>
```

### Programmatic Navigation

```tsx
import { useNavigate } from "react-router";

export default function LogoutButton() {
  const navigate = useNavigate();

  return (
    <button onClick={() => navigate("/")}>
      Go Home
    </button>
  );
}
```

### Navigate Options

```tsx
navigate("/path", {
  replace: true,              // Don't add to history
  state: { from: "/" },       // Pass state
  relative: "route",          // Or "path"
  preventScrollReset: true,   // Don't scroll to top
  viewTransition: true,       // Enable view transition
});

navigate(-1);  // Go back
navigate(1);   // Go forward
```

### Redirect in Loaders/Actions

```tsx
import { redirect } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/login");
  }
  return { user };
}

export async function action() {
  const project = await createProject();
  return redirect(`/projects/${project.id}`);
}
```

## URL Parameters and Search Params

### Route Parameters

Access dynamic route parameters:

```tsx
import { useParams } from "react-router";

export default function Post() {
  const params = useParams<{ postId: string }>();
  // params.postId is typed as string

  return <h1>Post: {params.postId}</h1>;
}
```

### Search Parameters

Handle query strings:

```tsx
import { useSearchParams } from "react-router";

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get("q");
  const page = searchParams.get("page") || "1";

  return (
    <div>
      <input value={query} />
      <button onClick={() => setSearchParams({ q: "react" })}>
        Search
      </button>
    </div>
  );
}
```

### Setting Search Params

```tsx
// String
setSearchParams("?tab=1");

// Object
setSearchParams({ tab: "1" });

// Multiple values
setSearchParams({ brand: ["nike", "reebok"] });

// Callback
setSearchParams((prev) => {
  prev.set("tab", "2");
  return prev;
});
```

## Error Handling

### Framework Mode Error Boundaries

```tsx
import { Route } from "./+types/root";
import { isRouteErrorResponse } from "react-router";

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) {
    return (
      <div>
        <h1>{error.status} {error.statusText}</h1>
        <p>{error.data}</p>
      </div>
    );
  }

  if (error instanceof Error) {
    return (
      <div>
        <h1>Error</h1>
        <p>{error.message}</p>
      </div>
    );
  }

  return <h1>Unknown Error</h1>;
}
```

### Data Mode Error Boundaries

```tsx
import { useRouteError, isRouteErrorResponse } from "react-router";

function RootErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div>
        <h1>{error.status}</h1>
        <p>{error.data}</p>
      </div>
    );
  }

  return <h1>Error</h1>;
}

createBrowserRouter([
  {
    path: "/",
    Component: Root,
    ErrorBoundary: RootErrorBoundary,
  },
]);
```

### Throwing Errors

Unintentional errors are caught:

```tsx
export async function loader() {
  return undefined(); // Error thrown and caught
}
```

Intentional errors with status codes:

```tsx
import { data } from "react-router";

export async function loader({ params }: Route.LoaderArgs) {
  const post = await getPost(params.id);
  if (!post) {
    throw data("Not Found", { status: 404 });
  }
  return post;
}
```

## Advanced Hooks

### useLoaderData

Get data from the route's loader:

```tsx
export default function Component() {
  const data = useLoaderData<typeof loader>();
  // fully typed
}
```

### useActionData

Get data from the last action submission:

```tsx
export default function Form() {
  const actionData = useActionData<typeof action>();
  return actionData ? <p>{actionData.message}</p> : null;
}
```

### useFetcher

Independent data submission without navigation:

```tsx
const fetcher = useFetcher();

fetcher.state; // "idle" | "loading" | "submitting"
fetcher.data; // data from action/loader
fetcher.Form; // component for forms
fetcher.load(path); // load data
fetcher.submit(data, options); // submit data
fetcher.reset(); // reset state
```

Keyed fetchers (access from other components):

```tsx
const fetcher = useFetcher({ key: "my-fetcher" });
```

### useMatches

Get all active route matches:

```tsx
const matches = useMatches();
// Array of: { route, pathname, params, data, handle }

matches.forEach(match => {
  console.log(match.data);    // Loader data
  console.log(match.handle);  // Route handle metadata
});
```

### useLocation

Get current location:

```tsx
const location = useLocation();
// {
//   pathname: "/posts/123",
//   search: "?tab=1",
//   hash: "#section",
//   state: { from: "/" }
// }
```

### useNavigation

Track navigation state:

```tsx
const navigation = useNavigation();

navigation.state; // "idle" | "loading" | "submitting"
navigation.location; // new location during navigation
navigation.formData; // form data being submitted
```

## Advanced Route Features

### Route Handle Property

Attach metadata to routes for use in ancestor components:

```tsx
// Route definition
export const handle = {
  breadcrumb: () => <Link to="/posts">Posts</Link>,
  icon: "📝",
};

// Access in ancestor
function Root() {
  const matches = useMatches();

  return (
    <header>
      {matches
        .filter(m => m.handle?.breadcrumb)
        .map(m => m.handle.breadcrumb())}
    </header>
  );
}
```

### Middleware

Run code before/after navigations:

```tsx
export async function middleware({ request }, next) {
  console.log(`Starting: ${request.url}`);
  await next();
  console.log("Complete");
}

createBrowserRouter([
  {
    path: "/",
    middleware: [middleware],
    loader: rootLoader,
    Component: Root,
  },
]);
```

### Outlet Component

Render child routes:

```tsx
import { Outlet } from "react-router";

function Layout() {
  return (
    <div>
      <nav>{/* navigation */}</nav>
      <Outlet /> {/* Child routes render here */}
    </div>
  );
}
```

### OutletContext

Pass data to child routes via Outlet:

```tsx
// Parent
function Parent() {
  return <Outlet context={{ user: { name: "John" } }} />;
}

// Child
import { useOutletContext } from "react-router";

function Child() {
  const { user } = useOutletContext<{ user: User }>();
  return <p>{user.name}</p>;
}
```

## Comparison with TanStack Router

### Type Safety Similarities

Both React Router v7 and TanStack Router offer first-class TypeScript support:

| Feature | React Router v7 | TanStack Router |
|---------|-----------------|-----------------|
| Route type generation | ✓ Automatic `.react-router/types/` | ✓ Automatic |
| Param typing | ✓ Auto-inferred from path | ✓ Auto-inferred |
| Loader data typing | ✓ Via `Route.LoaderArgs` | ✓ Via `loader()` return type |
| Action typing | ✓ Via `Route.ActionArgs` | ✓ Via `action()` return type |
| Search params typing | ✓ Manual with `useSearchParams` | ✓ Route-level definition |
| Redirect typing | ✓ Standard function | ✓ Standard function |

### Key Differences

**Type Definition Level:**
- React Router: File-based type generation (`.d.ts` files)
- TanStack Router: Route-level type registration

**Search Params:**
- React Router: Runtime `URLSearchParams` API
- TanStack Router: Compile-time schema validation

**Nested Route Typing:**
- React Router: Inherited from parent context
- TanStack Router: Explicit inheritance patterns

**Error Typing:**
- React Router: `isRouteErrorResponse()` utility
- TanStack Router: Built-in discriminated unions

**Learning Curve:**
- React Router: Familiar to those migrating from v6
- TanStack Router: More opinionated, explicit type patterns

## Best Practices

### 1. Type Your Routes Consistently

```tsx
// In Framework Mode, always use the generated types
import type { Route } from "./+types/my-route";

export async function loader({ params }: Route.LoaderArgs) {
  // params is typed
}

export default function Component({ loaderData }: Route.ComponentProps) {
  // loaderData is typed
}
```

### 2. Use Forms for Navigation-Causing Mutations

```tsx
// Good: Uses <Form> for main app actions
<Form method="post" action="/projects">
  <input name="title" />
  <button>Create</button>
</Form>
```

### 3. Use Fetchers for Non-Navigation Mutations

```tsx
// Good: Uses fetcher for secondary updates
const fetcher = useFetcher();

<fetcher.Form method="post" action="/task/123">
  <input name="status" />
  <button>Update</button>
</fetcher.Form>
```

### 4. Handle Validation Errors Properly

```tsx
// Return with 4xx status to prevent revalidation
if (validationFailed) {
  return data({ errors }, { status: 400 });
}
```

### 5. Use `redirect()` in Loaders/Actions

```tsx
// Prefer redirect in loaders/actions
if (!user) {
  return redirect("/login");
}

// Over useNavigate in components
const navigate = useNavigate(); // Reserve for rare cases
```

### 6. Leverage `useMatches()` for Layout Data

```tsx
// Access parent route data in nested components
const matches = useMatches();
const parentData = matches[matches.length - 2]?.data;
```

## Router Creation

### Data Mode (createBrowserRouter)

```tsx
import { createBrowserRouter, RouterProvider } from "react-router";

const router = createBrowserRouter([
  { path: "/", Component: Home },
  { path: "/about", Component: About },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
```

### Framework Mode Setup

Use the framework convention with `routes.ts`:

```ts filename=app/routes.ts
import { route, type RouteConfig } from "@react-router/dev/routes";

export default [
  route("/", "./routes/index.tsx"),
  route("about", "./routes/about.tsx"),
  route("posts/:id", "./routes/post.tsx"),
] satisfies RouteConfig;
```

### Router Options

```tsx
const router = createBrowserRouter(routes, {
  basename: "/app",                    // URL base path
  future: { v7_... },                 // Future flags
  hydrationData: serverData,          // SSR hydration
  dataStrategy: customStrategy,       // Custom data loading
  getContext: createContext,          // Custom context
  patchRoutesOnNavigation: patchFn,  // Dynamic routes
  unstable_instrumentations: [logger] // Instrumentation
});
```

## Conclusion

React Router v7 provides a mature, type-safe routing solution with automatic TypeScript support. Its familiar API for v6 users, combined with modern features like middleware, server-side rendering support, and comprehensive type generation, makes it a strong choice for building scalable React applications.

The key advantage over alternatives is the seamless integration with existing React patterns (hooks, components) and the framework's approach to type safety through automatic code generation rather than manual annotations.
