import { getSupabaseSafe } from './client';
import { Location } from '../types';
import { TABLES } from '../constants';

// --- API Functions for Locations ---
export const getLocations = async (): Promise<Location[]> => {
  const client = getSupabaseSafe();
  const { data, error } = await client
    .from(TABLES.LOCATIONS)
    .select('*')
    .order('name', { ascending: true });
  if (error) {
    console.error('Error fetching locations:', error.message);
    throw error;
  }
  return data || [];
};

export const createLocation = async (name: string, parent_id: string | null): Promise<Location> => {
  const client = getSupabaseSafe();
  const { data, error } = await client
    .from(TABLES.LOCATIONS)
    .insert({ name, parent_id })
    .select('*')
    .single();
  if (error) {
    console.error('Error creating location:', error.message);
    throw error;
  }
  return data;
};

export const updateLocation = async (id: string, name: string, parent_id: string | null): Promise<Location> => {
  const client = getSupabaseSafe();
  const { data, error } = await client
    .from(TABLES.LOCATIONS)
    .update({ name, parent_id })
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    console.error('Error updating location:', error.message);
    throw error;
  }
  return data;
};

export const deleteLocation = async (id: string): Promise<void> => {
  const client = getSupabaseSafe();
  const { error } = await client
    .from(TABLES.LOCATIONS)
    .delete()
    .eq('id', id);
  if (error) {
    console.error('Error deleting location:', error.message);
    throw error;
  }
};

export const reassignAssetsAndDeleteLocation = async (
  oldLocationId: string,
  newLocationId: string,
): Promise<void> => {
  const client = getSupabaseSafe();
  // Step 1: Reassign assets
  const { error: updateError } = await client
    .from(TABLES.ASSETS)
    .update({ location_id: newLocationId })
    .eq('location_id', oldLocationId);

  if (updateError) {
    console.error('Error reassigning assets for location:', updateError.message);
    throw updateError;
  }

  // Step 2: Delete the old location
  await deleteLocation(oldLocationId);
};
