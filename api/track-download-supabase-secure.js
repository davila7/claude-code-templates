// Security-Enhanced Download Tracking API Endpoint
// This version includes security improvements recommended in the audit

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Rate limiting implementation (in-memory for serverless)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100;

// Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// Enhanced input validation with sanitization
function validateComponentData(data) {
  const { type, name, path, category } = data;

  if (!type || !name) {
    return { valid: false, error: 'Component type and name are required' };
  }

  const validTypes = ['agent', 'command', 'setting', 'hook', 'mcp', 'skill', 'template'];
  if (!validTypes.includes(type)) {
    return { valid: false, error: 'Invalid component type' };
  }

  // Enhanced validation
  if (name.length > 255) {
    return { valid: false, error: 'Component name too long' };
  }

  // Sanitize input - remove potentially dangerous characters
  const nameRegex = /^[a-zA-Z0-9-_]+$/;
  if (!nameRegex.test(name)) {
    return { valid: false, error: 'Component name contains invalid characters' };
  }

  if (path && path.length > 500) {
    return { valid: false, error: 'Component path too long' };
  }

  if (category && category.length > 100) {
    return { valid: false, error: 'Category name too long' };
  }

  return { valid: true };
}

// Anonymize IP address for privacy compliance (GDPR)
function anonymizeIP(ip) {
  // Hash the IP and take first 16 characters for anonymization
  // This maintains uniqueness for analytics while protecting privacy
  const hash = crypto.createHash('sha256').update(ip + process.env.IP_SALT || 'default-salt').digest('hex');
  return hash.substring(0, 16);
}

// Get IP address from request
function getClientIP(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         '127.0.0.1';

  // Remove IPv6 prefix if present
  return ip.replace(/^::ffff:/, '');
}

// Get country from Vercel geo headers
function getCountry(req) {
  return req.headers['x-vercel-ip-country'] || null;
}

// Simple in-memory rate limiting for serverless
function checkRateLimit(ip) {
  const now = Date.now();
  const userRecord = rateLimitStore.get(ip);

  // Clean up old entries
  for (const [key, value] of rateLimitStore.entries()) {
    if (now - value.windowStart > RATE_LIMIT_WINDOW) {
      rateLimitStore.delete(key);
    }
  }

  if (!userRecord || now - userRecord.windowStart > RATE_LIMIT_WINDOW) {
    // New window
    rateLimitStore.set(ip, { windowStart: now, requests: 1 });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (userRecord.requests >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: userRecord.windowStart + RATE_LIMIT_WINDOW
    };
  }

  userRecord.requests++;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - userRecord.requests
  };
}

// Set comprehensive security headers
function setSecurityHeaders(res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent');

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");
  res.setHeader('Referrer-Policy', 'no-referrer');
}

export default async function handler(req, res) {
  // Set security headers for all responses
  setSecurityHeaders(res);

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

  // Check Content-Type
  const contentType = req.headers['content-type'];
  if (!contentType || !contentType.includes('application/json')) {
    return res.status(400).json({
      error: 'Content-Type must be application/json'
    });
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  const rateLimitCheck = checkRateLimit(clientIP);

  if (!rateLimitCheck.allowed) {
    const resetDate = new Date(rateLimitCheck.resetTime).toISOString();
    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', resetDate);

    return res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      resetTime: resetDate
    });
  }

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', rateLimitCheck.remaining);

  try {
    // Validate request body
    const { type, name, path, category, cliVersion } = req.body;
    const validation = validateComponentData({ type, name, path, category });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Sanitize inputs
    const sanitizedData = {
      type: type.toLowerCase().trim(),
      name: name.toLowerCase().trim(),
      path: path ? path.trim() : null,
      category: category ? category.trim() : null,
      cliVersion: cliVersion ? cliVersion.trim() : null
    };

    // Get client information with privacy protection
    const anonymizedIP = anonymizeIP(clientIP);
    const country = getCountry(req);
    const userAgent = req.headers['user-agent']?.substring(0, 255); // Limit UA length

    // Initialize Supabase client
    const supabase = getSupabaseClient();

    // Insert download record with sanitized data
    const { data: insertData, error: insertError } = await supabase
      .from('component_downloads')
      .insert({
        component_type: sanitizedData.type,
        component_name: sanitizedData.name,
        component_path: sanitizedData.path,
        category: sanitizedData.category,
        user_agent: userAgent,
        ip_address: anonymizedIP, // Anonymized IP
        country: country,
        cli_version: sanitizedData.cliVersion,
        download_timestamp: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Supabase insert error:', insertError.message);
      // Don't expose database errors to client
      throw new Error('Failed to record download');
    }

    // Update aggregated stats (upsert)
    const { error: upsertError } = await supabase
      .from('download_stats')
      .upsert(
        {
          component_type: sanitizedData.type,
          component_name: sanitizedData.name,
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
      console.error('Stats update warning:', upsertError.message);
      // Don't fail the request for stats update errors
    }

    // Return success response without exposing internal data
    res.status(200).json({
      success: true,
      message: 'Download tracked successfully',
      data: {
        type: sanitizedData.type,
        name: sanitizedData.name,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Download tracking error:', error.message);

    // Never expose internal error details to client
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to track download'
      // Never include: details, stack traces, or internal error messages
    });
  }
}

// Export configuration for Vercel
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10kb', // Limit request body size
    },
  },
};