# Community Showcase - Local Development Guide

## Current Status: Mock Data Mode ✅

The Community Showcase feature is now running in **mock data mode** for local development. This means you can develop and test the feature without needing:
- Supabase database connection
- Clerk authentication
- Any external services

## What's Working

✅ Showcase gallery page (`/showcase`)
✅ Showcase detail page (`/showcase/[id]`)
✅ Showcase submission form (`/showcase/submit`)
✅ Mock data with 3 sample showcases
✅ Filtering by category, type, sort, search
✅ Card rendering with proper styling
✅ All API endpoints returning mock data
✅ Reactions (like, bookmark) - mock mode
✅ Comments section - mock mode
✅ View tracking - mock mode
✅ No database or auth required

## How to Test

1. Start the dev server:
```bash
cd claude-code-templates/dashboard
npm run dev
```

2. Visit: 
   - Gallery: `http://localhost:4321/showcase`
   - Submit: `http://localhost:4321/showcase/submit`
   - Detail: `http://localhost:4321/showcase/1`

3. You should see:
   - 3 mock showcases in the gallery
   - Working filters and search
   - Detail page with full showcase content
   - Submission form with validation

## Mock Data Location

All mock data is in: `src/lib/mock-showcase-data.ts`

You can edit this file to:
- Add more mock showcases
- Change showcase content
- Test different scenarios

## API Endpoints (Mock Mode)

- ✅ `GET /api/showcase/list` - Returns mock showcases with filtering
- ✅ `GET /api/showcase/featured` - Returns mock featured content
- ✅ `POST /api/showcase/submit` - Validates and logs (doesn't save)
- ✅ `GET /api/showcase/[id]` - Returns mock showcase detail
- ✅ `POST /api/showcase/[id]/react` - Mock reaction handling
- ✅ `POST /api/showcase/[id]/view` - Mock view tracking
- ✅ `POST /api/showcase/[id]/comment` - Mock comment creation

## Before Pull Request

When you're ready to create a PR, we'll need to:

1. **Switch to Real Database Mode**
   - Uncomment Supabase code in API routes
   - Add Clerk authentication back
   - Test with real database

2. **Run Migration**
   ```bash
   psql $DATABASE_URL -f migrations/007_showcase_feature.sql
   ```

3. **Set Environment Variables**
   ```bash
   SUPABASE_URL=your_url
   SUPABASE_SERVICE_ROLE_KEY=your_key
   CLERK_SECRET_KEY=your_key
   ```

4. **Test Everything**
   - Submit real showcases
   - Test reactions and comments
   - Verify database writes

## Files Modified for Mock Mode

- `src/pages/api/showcase/list.ts` - Using mock data
- `src/pages/api/showcase/featured.ts` - Using mock data
- `src/pages/api/showcase/submit.ts` - Validation only, no DB
- `src/lib/mock-showcase-data.ts` - Mock data source (NEW)
- `src/lib/supabase.ts` - Optional Supabase client (NEW)

## Next Steps for Development

1. ✅ Gallery page working
2. ✅ Detail page working
3. ✅ Submission form working
4. ⏳ Add more mock data (optional)
5. ⏳ Test all interactions
6. ⏳ Optional: Component of the Week feature
7. ⏳ Switch to production mode before PR

## Switching to Production Mode

To enable real database:

1. Update API routes to use Supabase instead of mock data
2. Uncomment Clerk auth checks
3. Test with real database
4. Deploy!

## Questions?

Check the full documentation in `docs/community-showcase/`
