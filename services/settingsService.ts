
import { getSupabaseSafe } from './client';
import { TABLES } from '../constants';

// --- API Functions for App Settings ---
export const getSetting = async (key: string): Promise<any | null> => {
  try {
    const client = getSupabaseSafe();
    const { data, error } = await client
      .from(TABLES.APP_SETTINGS)
      .select('value')
      .eq('key', key)
      .single();

    if (error) {
      // PGRST116: JSON object is null (row not found)
      if (error.code !== 'PGRST116') { 
        console.warn(`Error getting setting "${key}":`, error.message);
      }
      return null;
    }

    return data?.value || null;
  } catch (err: any) {
    // Suppress "Failed to fetch" errors to prevent console noise/crashes during network issues
    if (err.message && err.message.includes('Failed to fetch')) {
        console.warn(`Network error getting setting "${key}". Using default.`);
    } else {
        console.warn(`Unexpected error getting setting "${key}" (using default):`, err.message || err);
    }
    return null;
  }
};

export const setSetting = async (key: string, value: any): Promise<void> => {
  try {
    const client = getSupabaseSafe();
    const { error } = await client
      .from(TABLES.APP_SETTINGS)
      .upsert({ key, value });

    if (error) {
      console.error(`Error setting setting "${key}":`, error.message);
      throw error;
    }
  } catch (err: any) {
    console.error(`Unexpected error setting setting "${key}":`, err.message || err);
    throw err;
  }
};
