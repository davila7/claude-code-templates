/**
 * Configuration API Endpoint
 * Returns public configuration for the frontend
 *
 * This serverless function runs on Vercel and has access to environment variables.
 * It exposes only the public/safe variables to the client.
 */

export default function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    // Check if environment variables are set
    if (!process.env.REACT_APP_SUPABASE_URL || !process.env.REACT_APP_SUPABASE_ANON_KEY) {
        res.status(500).json({
            error: 'Server configuration error',
            message: 'Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in Vercel environment variables'
        });
        return;
    }

    // Return public configuration
    const config = {
        supabase: {
            url: process.env.REACT_APP_SUPABASE_URL,
            anonKey: process.env.REACT_APP_SUPABASE_ANON_KEY
        }
    };

    res.status(200).json(config);
}
