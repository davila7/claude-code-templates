# Vercel Environment Variables Setup

This document explains how to configure environment variables for the authentication system in Vercel.

## Required Environment Variables

Add these environment variables in your Vercel project dashboard:

### Supabase Configuration

| Variable Name | Description | Example Value |
|--------------|-------------|---------------|
| `REACT_APP_SUPABASE_URL` | Your Supabase project URL | `https://xxxxx.supabase.co` |
| `REACT_APP_SUPABASE_ANON_KEY` | Supabase anonymous/public key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

## How to Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - **Name**: `REACT_APP_SUPABASE_URL`
   - **Value**: Your Supabase project URL
   - **Environment**: Select all (Production, Preview, Development)

4. Repeat for `REACT_APP_SUPABASE_ANON_KEY`

5. Redeploy your project for changes to take effect

## How It Works

1. **API Endpoint**: `/api/config.js` serverless function has access to environment variables
2. **Client Request**: `AuthManager.loadConfig()` fetches configuration from `/api/config`
3. **Fallback**: If API fails (local dev), uses hardcoded fallback values
4. **Security**: Only public/safe credentials are exposed (Supabase anon key is designed for frontend)

## Local Development

For local development, the system uses fallback values hardcoded in `auth-manager.js`. This allows you to develop without setting up environment variables locally.

If you want to use environment variables locally:

1. Create a `.env.local` file in the root directory
2. Add your Supabase credentials:
   ```
   REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
3. Run `vercel dev` to start the development server with environment variables

## Security Notes

- **Supabase Anon Key**: This is a public key designed to be exposed in frontend applications
- **Row Level Security (RLS)**: Security is enforced at the database level with RLS policies
- **No Secret Keys**: Never expose service role keys or secret keys in the frontend
- **GitHub OAuth**: Authentication is handled securely by Supabase's OAuth flow

## Testing

To verify your configuration:

1. Deploy to Vercel
2. Open browser console on your site
3. Look for: `✅ Configuration loaded from API`
4. Test GitHub login flow
5. Check Supabase dashboard for new user sessions

## Troubleshooting

**Configuration not loading:**
- Check that environment variables are set in Vercel dashboard
- Verify the variable names match exactly (case-sensitive)
- Ensure you redeployed after adding variables

**Fallback values being used:**
- Check browser console for `ℹ️ Using fallback configuration`
- This means `/api/config` request failed
- Verify the API endpoint is deployed correctly

**GitHub login not working:**
- Check Supabase dashboard → Authentication → Providers
- Ensure GitHub OAuth is enabled
- Verify redirect URLs are configured correctly
