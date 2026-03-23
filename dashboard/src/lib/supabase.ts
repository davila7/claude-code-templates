import { createClient } from '@supabase/supabase-js';

export function getSupabaseClient() {
  const supabaseUrl = import.meta.env.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase configuration missing. Using mock data for development.');
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

// Export a singleton instance
export const supabase = getSupabaseClient();

// Helper to check if database is available
export function isDatabaseAvailable(): boolean {
  return supabase !== null;
}
