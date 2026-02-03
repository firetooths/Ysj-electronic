
import { db, SyncAction } from '../db';
import { getSupabaseSafe } from './client';
import { TABLES } from '../constants';

// Tables to sync (Pull/Push)
const SYNC_TABLES = Object.values(TABLES);

/**
 * Downloads all data from Supabase and stores it in Dexie.
 * Should be called on app start or manually.
 */
export const pullAllData = async () => {
  const client = getSupabaseSafe();
  console.log("Starting Full Sync (Pull)...");

  const now = new Date().toISOString();

  // Sequential fetching to avoid rate limits and ensuring data integrity
  for (const tableName of SYNC_TABLES) {
    try {
      const { data, error } = await client.from(tableName).select('*');
      if (error) {
          // If table doesn't exist (e.g. version mismatch), skip
          if (error.code === '42P01') continue; 
          console.error(`Error pulling table ${tableName}:`, error);
          continue;
      }
      
      if (data) {
        // Use 'as any' to access dynamic table names on Dexie instance
        const table = (db as any)[tableName];
        if (table) {
            await table.bulkPut(data);
        }
      }
    } catch (e) {
      console.error(`Exception pulling table ${tableName}:`, e);
    }
  }

  // Save sync timestamp
  await db.app_settings.put({ key: 'last_offline_sync', value: now });
  console.log("Full Sync Completed.");
};

/**
 * Pushes queued offline changes to Supabase.
 */
export const pushOfflineChanges = async () => {
  const client = getSupabaseSafe();
  const queue = await db.syncQueue.orderBy('timestamp').toArray();

  if (queue.length === 0) return;

  console.log(`Pushing ${queue.length} offline changes...`);

  for (const item of queue) {
    try {
      const { table, action, data, id } = item;
      let error = null;

      if (action === 'CREATE') {
        const { error: insertError } = await client.from(table).insert(data);
        error = insertError;
      } else if (action === 'UPDATE') {
        const { error: updateError } = await client.from(table).update(data).eq('id', data.id);
        error = updateError;
      } else if (action === 'DELETE') {
        const { error: deleteError } = await client.from(table).delete().eq('id', data); // data is ID here
        error = deleteError;
      }

      if (!error) {
        // Success: Remove from queue
        await db.syncQueue.delete(id!);
      } else {
        console.error(`Failed to push action ${id} (${action} on ${table}):`, error);
        // Implement retry logic or dead-letter queue here if needed
      }
    } catch (e) {
      console.error("Exception processing queue item:", e);
    }
  }
  console.log("Offline Push Completed.");
};

/**
 * Creates a JSON backup of the local database.
 */
export const createBackup = async (): Promise<Blob> => {
  const backupData: any = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    tables: {}
  };

  for (const tableName of SYNC_TABLES) {
    const table = (db as any)[tableName];
    if (table) {
        const records = await table.toArray();
        backupData.tables[tableName] = records;
    }
  }

  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  return blob;
};

/**
 * Restores a backup from a JSON object.
 */
export const restoreBackup = async (jsonContent: any) => {
  if (!jsonContent.tables) throw new Error("Invalid backup file format.");

  // Clear Local DB
  // Cast db to any to access Dexie methods that TS might miss on extended class
  await (db as any).transaction('rw', (db as any).tables, async () => {
    for (const table of (db as any).tables) {
      if (table.name !== 'syncQueue') { 
         await table.clear();
      }
    }
  });

  // Populate Local DB
  const tables = Object.keys(jsonContent.tables);
  for (const tableName of tables) {
    const records = jsonContent.tables[tableName];
    const table = (db as any)[tableName];
    if (table) {
        await table.bulkAdd(records);
    }
  }

  console.log("Backup restored to local database.");
};

/**
 * Get last sync date
 */
export const getLastSyncDate = async (): Promise<string | null> => {
    const setting = await db.app_settings.get('last_offline_sync');
    return setting?.value || null;
};
