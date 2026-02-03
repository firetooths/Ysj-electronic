import { getSupabaseSafe } from './client';
import { MaintenanceLog } from '../types';
import { TABLES } from '../constants';
import { logAuditAction } from './auditService';

const getCurrentUserForLog = (): string => {
  try {
    const userStr = localStorage.getItem('user_data');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.full_name || user.username || 'کاربر ناشناس';
    }
  } catch (e) {
    console.error('Error getting user for log:', e);
  }
  return 'system';
};

// --- API Functions for Maintenance Logs ---
export const getMaintenanceLogsByAssetId = async (
  assetId: string,
): Promise<MaintenanceLog[]> => {
  const client = getSupabaseSafe();
  const { data, error } = await client
    .from(TABLES.MAINTENANCE_LOGS)
    .select('*')
    .eq('asset_id', assetId)
    .order('log_date', { ascending: false });
  if (error) {
    console.error('Error fetching maintenance logs:', error.message);
    throw error;
  }
  return data || [];
};

export const createMaintenanceLog = async (
  log: Omit<MaintenanceLog, 'id' | 'created_at'>,
): Promise<MaintenanceLog> => {
  const client = getSupabaseSafe();
  const { data, error } = await client
    .from(TABLES.MAINTENANCE_LOGS)
    .insert(log)
    .select('*')
    .single();
  if (error) {
    console.error('Error creating maintenance log:', error.message);
    throw error;
  }
  await logAuditAction(
    log.asset_id,
    `لاگ نگهداری جدید اضافه شد: ${log.work_done}`,
    getCurrentUserForLog(),
    'maintenance_log',
    null,
    JSON.stringify(log)
  );
  return data;
};

export const deleteMaintenanceLog = async (id: string): Promise<void> => {
  const client = getSupabaseSafe();
  
  // Retrieve log details before deletion for audit logging
  const { data: logToDelete } = await client
    .from(TABLES.MAINTENANCE_LOGS)
    .select('*')
    .eq('id', id)
    .single();

  const { error } = await client
    .from(TABLES.MAINTENANCE_LOGS)
    .delete()
    .eq('id', id);
  if (error) {
    console.error('Error deleting maintenance log:', error.message);
    throw error;
  }

  if (logToDelete) {
    await logAuditAction(
      logToDelete.asset_id,
      `لاگ نگهداری حذف شد: ${logToDelete.work_done}`,
      getCurrentUserForLog(),
      'maintenance_log',
      JSON.stringify(logToDelete),
      null
    );
  }
};
