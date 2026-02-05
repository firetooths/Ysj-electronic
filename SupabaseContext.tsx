
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { Category, Location, SupabaseContextType, Node, WireColor, Tag, ContactGroup, AssetStatusItem } from './types';
import { supabase, supabaseConfigError, getCategories, getLocations, seedDefaultData, getNodes, getSetting, getTags, getContactGroups, getSupabaseSafe, getAssetStatuses } from './supabaseService';
import { DEFAULT_WIRE_COLORS, SETTINGS_KEYS } from './constants';

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [assetStatuses, setAssetStatuses] = useState<AssetStatusItem[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [wireColors, setWireColors] = useState<WireColor[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshCategories = useCallback(async () => { try { setCategories(await getCategories()); } catch(e){} }, []);
  const refreshLocations = useCallback(async () => { try { setLocations(await getLocations()); } catch(e){} }, []);
  const refreshAssetStatuses = useCallback(async () => { try { setAssetStatuses(await getAssetStatuses()); } catch(e){} }, []);
  const refreshNodes = useCallback(async () => { try { setNodes(await getNodes()); } catch(e){} }, []);
  const refreshWireColors = useCallback(async () => { 
      try { 
          const colorsJson = await getSetting(SETTINGS_KEYS.PHONE_WIRE_COLORS);
          setWireColors(colorsJson ? JSON.parse(colorsJson) : DEFAULT_WIRE_COLORS);
      } catch(e){ setWireColors(DEFAULT_WIRE_COLORS); }
  }, []);
  const refreshTags = useCallback(async () => { try { setTags(await getTags()); } catch(e){} }, []);
  const refreshContactGroups = useCallback(async () => { try { setContactGroups(await getContactGroups()); } catch(e){} }, []);

  useEffect(() => {
    if (supabaseConfigError) {
      setError(supabaseConfigError);
      setIsLoading(false);
      return;
    }

    const initializeData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // APK OFFLINE FIX: Seed default data only if online. 
        // If offline, our services will already handle falling back to Dexie.
        if (navigator.onLine) {
            await seedDefaultData().catch(() => {});
        }

        // Initialize all states. The services now use handleOfflineRead, 
        // which returns local data immediately and doesn't throw fetch errors.
        await Promise.allSettled([
          refreshCategories(),
          refreshLocations(),
          refreshAssetStatuses(),
          refreshNodes(),
          refreshWireColors(),
          refreshTags(),
          refreshContactGroups(),
        ]);
      } catch (err: any) {
        console.error('Initialization error (continuing with local data):', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, [refreshCategories, refreshLocations, refreshAssetStatuses, refreshNodes, refreshWireColors, refreshTags, refreshContactGroups]);

  if (supabaseConfigError) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
        <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-6 shadow-md rounded-md text-right max-w-lg" role="alert">
          <p className="font-bold text-lg">خطای پیکربندی Supabase</p>
          <p className="text-sm mt-2">{supabaseConfigError}</p>
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
  if (context === undefined) throw new Error('useSupabaseContext must be used within a SupabaseProvider');
  return context;
};
