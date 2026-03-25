# Database Operations

Set up database operations for $ARGUMENTS following project conventions.

## Task

Create or optimize database operations based on the requirements:

1. **Analyze existing database setup**: Check current database configuration, ORM/ODM, and connection patterns
2. **Identify database type**: Determine if using MongoDB, PostgreSQL, MySQL, or other database
3. **Examine ORM/ODM**: Check for Prisma, TypeORM, Mongoose, Sequelize, or raw SQL patterns
4. **Review existing models**: Understand current schema patterns and relationships
5. **Check migration system**: Identify migration tools and patterns in use
6. **Implement operations**: Create models, repositories, or services following project architecture
7. **Add validation**: Include proper schema validation and constraints
8. **Create tests**: Write database operation tests following project patterns
9. **Update migrations**: Add necessary database migrations if schema changes required

## Implementation Requirements

- Follow project's database architecture patterns
- Use existing ORM/ODM configuration and connection setup
- Include proper TypeScript types for all database operations
- Add comprehensive error handling and transaction management
- Implement proper indexing for performance
- Follow project's naming conventions for tables/collections and fields
- Consider data validation at both application and database levels

## Database Patterns to Consider

Based on your project setup:
- **Repository Pattern**: Separate data access logic from business logic
- **Active Record**: Models with built-in database operations
- **Data Mapper**: Separate domain models from database schema
- **Query Builder**: Fluent interface for building database queries
- **Raw SQL**: Direct database queries for complex operations

## Operation Types

Common database operations to implement:
- **CRUD operations**: Create, Read, Update, Delete
- **Bulk operations**: Batch inserts, updates, deletes
- **Aggregation**: Complex queries with grouping and calculations
- **Relationships**: Managing foreign keys and joins
- **Transactions**: Ensuring data consistency
- **Migrations**: Schema changes and data transformations

## Important Notes

- ALWAYS examine existing database setup first to understand project patterns
- Use the same connection configuration and environment variables
- Follow project's folder structure for models/schemas
- Don't install new database dependencies without asking
- Consider performance implications (indexes, query optimization)
- Add proper database connection pooling if not already configured
- Include proper cleanup and connection closing in tests