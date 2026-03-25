// Website Events Tracking API Endpoint - Neon Database
// Tracks search, cart, and component view events from the website

import { neon } from '@neondatabase/serverless';

function getNeonClient() {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    throw new Error('NEON_DATABASE_URL not configured');
  }
  return neon(connectionString);
}

const VALID_EVENT_TYPES = [
  'search',
  'cart_add',
  'cart_remove',
  'cart_checkout',
  'component_view',
  'copy_command'
];

const MAX_EVENTS_PER_BATCH = 50;

function validateEventsData(data) {
  const { events } = data;

  if (!events || !Array.isArray(events) || events.length === 0) {
    return { valid: false, error: 'events array is required and must not be empty' };
  }

  if (events.length > MAX_EVENTS_PER_BATCH) {
    return { valid: false, error: `Maximum ${MAX_EVENTS_PER_BATCH} events per batch` };
  }

  for (const event of events) {
    if (!event.event_type || !VALID_EVENT_TYPES.includes(event.event_type)) {
      return { valid: false, error: `Invalid event_type: ${event.event_type}` };
    }
  }

  return { valid: true };
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', allowed: ['POST'] });
  }

  try {
    const {
      events,
      session_id,
      visitor_id,
      screen_width,
      referrer
    } = req.body;

    const validation = validateEventsData({ events });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Extract country from Vercel header
    const country = req.headers['x-vercel-ip-country'] || null;

    const sql = getNeonClient();

    // Insert each event
    let inserted = 0;
    for (const event of events) {
      await sql`
        INSERT INTO website_events (
          event_type, event_data, page_path,
          referrer, session_id, visitor_id,
          country, screen_width
        ) VALUES (
          ${event.event_type},
          ${event.event_data ? JSON.stringify(event.event_data) : null},
          ${event.page_path || null},
          ${referrer ? referrer.substring(0, 1000) : null},
          ${session_id || null},
          ${visitor_id || null},
          ${country},
          ${screen_width || null}
        )
      `;
      inserted++;
    }

    res.status(200).json({
      success: true,
      message: `${inserted} events tracked`,
      data: { count: inserted, timestamp: new Date().toISOString() }
    });

  } catch (error) {
    console.error('Website events tracking error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to track website events',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
