// Template file for Supabase client generation
// Placeholders like {{TABLE_HELPERS}} will be replaced during code generation
// This is a template file - imports will be valid in the generated output

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Template file with placeholders
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Type-safe query helpers
// {{TABLE_HELPERS}} - Table-specific helpers will be inserted here
export const db: Record<string, any> = {
  // Table helpers will be generated here
};

// Real-time subscriptions helper
export const subscribeToTable = (
  table: keyof Database['public']['Tables'],
  callback: (payload: any) => void
) => {
  return supabase
    .channel(`${String(table)}_changes`)
    .on('postgres_changes', { event: '*', schema: 'public', table: String(table) }, callback)
    .subscribe();
};

// Batch operations helper
export const batchInsert = async <T extends keyof Database['public']['Tables']>(
  table: T,
  items: Database['public']['Tables'][T]['Insert'][]
) => {
  const { data, error } = await supabase
    .from(String(table))
    .insert(items)
    .select();
  
  if (error) throw error;
  return data;
};

// Error handling helper
export const handleSupabaseError = (error: any) => {
  console.error('Supabase error:', error);
  
  if (error.code === 'PGRST116') {
    throw new Error('No rows found');
  }
  
  if (error.code === '23505') {
    throw new Error('Duplicate entry');
  }
  
  if (error.code === '23503') {
    throw new Error('Foreign key violation');
  }
  
  throw new Error(error.message || 'Database error');
};

// Real-time subscriptions helper
export const subscribeToTable = (
  table: keyof Database['public']['Tables'],
  callback: (payload: any) => void
) => {
  return supabase
    .channel(`${table}_changes`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
    .subscribe();
};

// Batch operations helper
export const batchInsert = async <T extends keyof Database['public']['Tables']>(
  table: T,
  items: Database['public']['Tables'][T]['Insert'][]
) => {
  const { data, error } = await supabase
    .from(table)
    .insert(items)
    .select();
  
  if (error) throw error;
  return data;
};

// Error handling helper
export const handleSupabaseError = (error: any) => {
  console.error('Supabase error:', error);
  
  if (error.code === 'PGRST116') {
    throw new Error('No rows found');
  }
  
  if (error.code === '23505') {
    throw new Error('Duplicate entry');
  }
  
  if (error.code === '23503') {
    throw new Error('Foreign key violation');
  }
  
  throw new Error(error.message || 'Database error');
};
