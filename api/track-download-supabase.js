// Download tracking API endpoint using Supabase client
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Validate component data
function validateComponentData(data) {
  const { type, name, path, category } = data;
  
  if (!type || !name) {
    return { valid: false, error: 'Component type and name are required' };
  }
  
  const validTypes = ['agent', 'command', 'setting', 'hook', 'mcp', 'template'];
  if (!validTypes.includes(type)) {
    return { valid: false, error: 'Invalid component type' };
  }
  
  if (name.length > 255) {
    return { valid: false, error: 'Component name too long' };
  }
  
  return { valid: true };
}

// Get IP address from request
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         '127.0.0.1';
}

// Get country from Vercel geo headers
function getCountry(req) {
  return req.headers['x-vercel-ip-country'] || null;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed', 
      allowed: ['POST'] 
    });
  }
  
  try {
    // Validate request body
    const { type, name, path, category, cliVersion } = req.body;
    const validation = validateComponentData({ type, name, path, category });
    
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    // Get client information
    const ipAddress = getClientIP(req);
    const country = getCountry(req);
    const userAgent = req.headers['user-agent'];
    
    // Initialize Supabase client
    const supabase = getSupabaseClient();
    
    // Insert download record
    const { data: insertData, error: insertError } = await supabase
      .from('component_downloads')
      .insert({
        component_type: type,
        component_name: name,
        component_path: path,
        category: category,
        user_agent: userAgent,
        ip_address: ipAddress,
        country: country,
        cli_version: cliVersion,
        download_timestamp: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
    
    if (insertError) {
      console.error('Supabase insert error:', insertError);
      throw new Error(`Database insert failed: ${insertError.message}`);
    }
    
    // Update aggregated stats (upsert)
    const { error: upsertError } = await supabase
      .from('download_stats')
      .upsert(
        {
          component_type: type,
          component_name: name,
          total_downloads: 1,
          last_download: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'component_type,component_name',
          ignoreDuplicates: false
        }
      );
    
    if (upsertError) {
      console.error('Supabase upsert error:', upsertError);
      // Don't fail the request for stats update errors
    }
    
    // Return success response
    res.status(200).json({
      success: true,
      message: 'Download tracked successfully',
      data: {
        type,
        name,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Download tracking error:', error);
    
    // Return error response
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to track download',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}