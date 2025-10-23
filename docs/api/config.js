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

    // Return public configuration
    // These are public credentials safe to expose (Supabase anon key is designed for frontend use)
    const config = {
        supabase: {
            url: process.env.REACT_APP_SUPABASE_URL || 'https://jljwamruwpyexzcftocx.supabase.co',
            anonKey: process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsandhdXJ1d3B5ZXh6Y2Z0b2N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA2NjA4OTQsImV4cCI6MjA0NjIzNjg5NH0.m8vO0FgQqUMQb2x6tKEW1VcZdEqRXHBdZqr-XQGZ0n8'
        }
    };

    res.status(200).json(config);
}
