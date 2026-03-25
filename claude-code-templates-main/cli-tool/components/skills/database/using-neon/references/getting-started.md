# Getting Started with Neon

Interactive guide to help users get started with Neon in their project. Sets up their Neon project (with a connection string) and connects their database to their code.

For the official getting started guide:

```bash
curl -H "Accept: text/markdown" https://neon.tech/docs/get-started/signing-up
```

## Interactive Setup Flow

### Step 1: Check Organizations and Projects

**First, check for organizations:**

- If they have 1 organization: Default to that organization
- If they have multiple organizations: List all and ask which one to use

**Then, check for projects within the selected organization:**

- **No projects**: Ask if they want to create a new project
- **1 project**: Ask "Would you like to use '{project_name}' or create a new one?"
- **Multiple projects (<6)**: List all and let them choose
- **Many projects (6+)**: List recent projects, offer to create new or specify by name/ID

### Step 2: Database Setup

**Get the connection string:**

- Use the MCP server to get the connection string for the selected project

**Configure it for their environment:**

- Most projects use a `.env` file with `DATABASE_URL`
- For other setups, check project structure and ask

**Before modifying .env:**

1. Try to read the .env file first
2. If readable: Use search_replace to update or append
3. If unreadable: Use append command or show the line to add manually:

```
DATABASE_URL=postgresql://user:password@host/database
```

### Step 3: Install Dependencies

Recommend drivers based on deployment platform and runtime. For detailed guidance, see `connection-methods.md`.

**Quick Recommendations:**

| Environment              | Driver                     | Install                                |
| ------------------------ | -------------------------- | -------------------------------------- |
| Vercel (Edge/Serverless) | `@neondatabase/serverless` | `npm install @neondatabase/serverless` |
| Cloudflare Workers       | `@neondatabase/serverless` | `npm install @neondatabase/serverless` |
| AWS Lambda               | `@neondatabase/serverless` | `npm install @neondatabase/serverless` |
| Traditional Node.js      | `pg`                       | `npm install pg`                       |
| Long-running servers     | `pg` with pooling          | `npm install pg`                       |

For detailed serverless driver usage, see `neon-serverless.md`.
For complex scenarios (multiple runtimes, hybrid architectures), reference `connection-methods.md`.

### Step 4: Understand the Project

**If it's an empty/new project:**
Ask briefly (1-2 questions):

- What are they building?
- Any specific technologies?

**If it's an established project:**
Skip questions - infer from codebase. Update relevant code to use the driver.

### Step 5: Authentication (Optional)

**Skip if project doesn't need auth** (CLI tools, scripts, static sites).

**If project could benefit from auth:**
Ask: "Does your app need user authentication? Neon Auth can handle sign-in/sign-up, social login, and session management."

**If they want auth:**

- Use MCP server `provision_neon_auth` tool
- Guide through framework-specific setup
- Configure environment variables
- Set up basic auth code

For detailed auth setup, see `neon-auth.md`. For auth + database queries, see `neon-js.md`.

### Step 6: ORM Setup

**Check for existing ORM** (Prisma, Drizzle, TypeORM).

**If no ORM found:**
Ask: "Want to set up an ORM for type-safe database queries?"

If yes, suggest based on project. If no, proceed with raw SQL.

For Drizzle ORM integration, see `neon-drizzle.md`.

### Step 7: Schema Setup

**Check for existing schema:**

- SQL migration files
- ORM schemas (Prisma, Drizzle)
- Database initialization scripts

**If existing schema found:**
Ask: "Found existing schema definitions. Want to migrate these to your Neon database?"

**If no schema:**
Ask if they want to:

1. Create a simple example schema (users table)
2. Design a custom schema together
3. Skip schema setup for now

**Example schema:**

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Step 8: What's Next

"You're all set! Here are some things I can help with:

- Neon-specific features (branching, autoscaling, scale-to-zero)
- Connection pooling for production
- Writing queries or building API endpoints
- Database migrations and schema changes
- Performance optimization"

## Security Best Practices

1. Never commit connection strings to version control
2. Use environment variables for all credentials
3. Prefer SSL connections (default in Neon)
4. Use least-privilege database roles
5. Rotate API keys and passwords regularly

## Resume Support

If user says "Continue with Neon setup", check what's already configured:

- MCP server connection
- .env file with DATABASE_URL
- Dependencies installed
- Schema created

Then resume from where they left off.

## Developer Tools

For the best development experience, set up Neon's developer tools:

```bash
npx neon init
```

This installs the VSCode extension and configures the MCP server for AI-assisted development.

For detailed setup instructions, see `devtools.md`.

## Documentation Resources

| Topic              | URL                                                 |
| ------------------ | --------------------------------------------------- |
| Getting Started    | https://neon.tech/docs/get-started/signing-up       |
| Connecting to Neon | https://neon.tech/docs/connect/connect-intro        |
| Connection String  | https://neon.tech/docs/connect/connect-from-any-app |
| Frameworks Guide   | https://neon.tech/docs/get-started/frameworks       |
| ORMs Guide         | https://neon.tech/docs/get-started/orms             |
| VSCode Extension   | https://neon.tech/docs/local/vscode-extension       |
| MCP Server         | https://neon.tech/docs/ai/neon-mcp-server           |
