
import { db, SyncAction } from '../db';
import { getSupabaseSafe } from './client';
import { TABLES } from '../constants';

const SYNC_TABLES = Object.values(TABLES);

/**
 * Downloads all data from Supabase and stores it in Dexie.
 */
export const pullAllData = async () => {
  const client = getSupabaseSafe();
  console.log("Starting Full Sync (Pull)...");
  const now = new Date().toISOString();

  for (const tableName of SYNC_TABLES) {
    try {
      // Limit to 1000 for safety, paging could be added
      const { data, error } = await client.from(tableName).select('*').limit(2000);
      if (error) {
          if (error.code === '42P01') continue; 
          console.error(`Error pulling table ${tableName}:`, error);
          continue;
      }
      
      if (data) {
        const table = (db as any)[tableName];
        if (table) {
            await table.clear(); // Clear old cache to avoid ghosts
            await table.bulkPut(data);
        }
      }
    } catch (e) {
      console.error(`Exception pulling table ${tableName}:`, e);
    }
  }

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
        // Omit generated ID if it's not a UUID (though we generate UUIDs now)
        // If supabase generates IDs, we might have a conflict or need to update the local ID map.
        // For simplicity with UUIDs, we just insert.
        const { error: insertError } = await client.from(table).insert(data);
        error = insertError;
      } else if (action === 'UPDATE') {
        const { id: rowId, ...updates } = data;
        const { error: updateError } = await client.from(table).update(updates).eq('id', rowId);
        error = updateError;
      } else if (action === 'DELETE') {
        const { error: deleteError } = await client.from(table).delete().eq('id', data);
        error = deleteError;
      }

      if (!error) {
        await db.syncQueue.delete(id!);
      } else {
        console.error(`Failed to push action ${id} (${action} on ${table}):`, error);
        // If error is "Row not found" for update/delete, maybe it was deleted on server? Remove from queue?
        // For now keep in queue to retry or manual intervention.
      }
    } catch (e) {
      console.error("Exception processing queue item:", e);
    }
  }
  
  // Refresh local data after push to ensure consistency (IDs, triggers)
  await pullAllData(); 
};

export const createBackup = async (): Promise<Blob> => {
  const backupData: any = { version: '1.0', createdAt: new Date().toISOString(), tables: {} };
  for (const tableName of SYNC_TABLES) {
    const table = (db as any)[tableName];
    if (table) {
        const records = await table.toArray();
        backupData.tables[tableName] = records;
    }
  }
  return new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
};

export const restoreBackup = async (jsonContent: any) => {
  if (!jsonContent.tables) throw new Error("Invalid backup file format.");
  await (db as any).transaction('rw', (db as any).tables, async () => {
    for (const table of (db as any).tables) {
      if (table.name !== 'syncQueue') await table.clear();
    }
  });
  const tables = Object.keys(jsonContent.tables);
  for (const tableName of tables) {
    const records = jsonContent.tables[tableName];
    const table = (db as any)[tableName];
    if (table) await table.bulkAdd(records);
  }
  console.log("Backup restored to local database.");
};

export const getLastSyncDate = async (): Promise<string | null> => {
    const setting = await db.app_settings.get('last_offline_sync');
    return setting?.value || null;
};
