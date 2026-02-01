
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { Category, Location, SupabaseContextType, Node, WireColor, Tag, ContactGroup, AssetStatusItem } from './types';
import { supabase, supabaseConfigError, getSetting } from './supabaseService';
import { DEFAULT_WIRE_COLORS, SETTINGS_KEYS } from './constants';
import { loadFromCache, CACHE_KEYS, syncFullDatabase } from './services/offlineService';

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Asset Management State
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [assetStatuses, setAssetStatuses] = useState<AssetStatusItem[]>([]);
  
  // Phone Line Management State
  const [nodes, setNodes] = useState<Node[]>([]);
  const [wireColors, setWireColors] = useState<WireColor[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  // Contact Management State
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  
  // General State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Loads all critical data directly from LocalStorage.
   * This ensures the app works immediately offline.
   */
  const loadLocalData = useCallback(() => {
      console.log("Loading data from local cache...");
      setCategories(loadFromCache<Category>(CACHE_KEYS.CATEGORIES));
      setLocations(loadFromCache<Location>(CACHE_KEYS.LOCATIONS));
      setAssetStatuses(loadFromCache<AssetStatusItem>(CACHE_KEYS.ASSET_STATUSES));
      setNodes(loadFromCache<Node>(CACHE_KEYS.NODES));
      setTags(loadFromCache<Tag>(CACHE_KEYS.TAGS));
      setContactGroups(loadFromCache<ContactGroup>(CACHE_KEYS.CATEGORIES)); // Note: ContactGroups often mapped to Categories key in this app logic, check constants if distinct
      
      // Wire Colors might be in Settings or defaults
      const colorsRaw = localStorage.getItem('offline_wire_colors'); // We might need to cache this specifically if it comes from settings
      if (colorsRaw) {
          setWireColors(JSON.parse(colorsRaw));
      } else {
          setWireColors(DEFAULT_WIRE_COLORS);
      }
  }, []);

  /**
   * Background Sync: Fetches from DB and updates LocalStorage + State
   */
  const performSync = useCallback(async () => {
      if (!navigator.onLine) return;
      
      try {
          const success = await syncFullDatabase();
          if (success) {
              loadLocalData(); // Refresh state with new data
              
              // Refresh Wire Colors specially as they are in Settings
              try {
                  const colorsJson = await getSetting(SETTINGS_KEYS.PHONE_WIRE_COLORS);
                  const colors = colorsJson ? JSON.parse(colorsJson) : DEFAULT_WIRE_COLORS;
                  setWireColors(colors);
                  localStorage.setItem('offline_wire_colors', JSON.stringify(colors));
              } catch(e) {}
          }
      } catch (e) {
          console.error("Background sync failed:", e);
      }
  }, [loadLocalData]);

  // Exposed refresh functions (now just trigger the sync logic or re-read cache)
  const refreshCategories = useCallback(async () => { performSync(); }, [performSync]);
  const refreshLocations = useCallback(async () => { performSync(); }, [performSync]);
  const refreshAssetStatuses = useCallback(async () => { performSync(); }, [performSync]);
  const refreshNodes = useCallback(async () => { performSync(); }, [performSync]);
  const refreshWireColors = useCallback(async () => { performSync(); }, [performSync]);
  const refreshTags = useCallback(async () => { performSync(); }, [performSync]);
  const refreshContactGroups = useCallback(async () => { performSync(); }, [performSync]);

  useEffect(() => {
    if (supabaseConfigError) {
      setError(supabaseConfigError);
      setIsLoading(false);
      return;
    }

    // 1. Immediate Offline Load
    loadLocalData();
    setIsLoading(false); // App is ready to use with cached data

    // 2. Trigger Background Sync
    performSync();

  }, [loadLocalData, performSync]);

  if (supabaseConfigError) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 shadow-md rounded-md text-right max-w-lg mx-auto">
          <p className="font-bold">خطای پیکربندی</p>
          <p>{supabaseConfigError}</p>
        </div>
      </div>
    );
  }

  const value = {
    supabase,
    categories,
    locations,
    assetStatuses,
    refreshCategories,
    refreshLocations,
    refreshAssetStatuses,
    nodes,
    wireColors,
    tags,
    refreshNodes,
    refreshWireColors,
    refreshTags,
    contactGroups,
    refreshContactGroups,
    isLoading,
  };

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  );
};

export const useSupabaseContext = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabaseContext must be used within a SupabaseProvider');
  }
  return context;
};
