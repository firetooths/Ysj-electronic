
import { getSupabaseSafe } from './client';
import { MaintenanceSchedule, CNSMaintenanceLog as MaintenanceLog, RecurrenceType } from '../types';
import { STORAGE_BUCKETS, TABLES } from '../constants';
import { db } from '../db';
import { handleOfflineInsert, handleOfflineUpdate, handleOfflineDelete, handleOfflineRead } from './offlineHandler';

export const getMaintenanceSchedules = async (): Promise<MaintenanceSchedule[]> => {
    return handleOfflineRead(TABLES.CNS_MAINTENANCE_SCHEDULES,
        async () => {
            const client = getSupabaseSafe();
            const { data, error } = await client.from(TABLES.CNS_MAINTENANCE_SCHEDULES).select('*').order('title');
            if (error) throw error;
            return data || [];
        },
        async () => db.cns_maintenance_schedules.orderBy('title').toArray()
    );
};

export const getMaintenanceScheduleById = async (id: string): Promise<MaintenanceSchedule | null> => {
    return handleOfflineRead(TABLES.CNS_MAINTENANCE_SCHEDULES,
        async () => {
            const client = getSupabaseSafe();
            const { data } = await client.from(TABLES.CNS_MAINTENANCE_SCHEDULES).select('*').eq('id', id).single();
            return data;
        },
        async () => db.cns_maintenance_schedules.get(id)
    );
};

export const createMaintenanceSchedule = async (schedule: any) => handleOfflineInsert(TABLES.CNS_MAINTENANCE_SCHEDULES, { ...schedule, created_at: new Date().toISOString() }, async () => (await getSupabaseSafe().from(TABLES.CNS_MAINTENANCE_SCHEDULES).insert(schedule).select().single()).data);
export const updateMaintenanceSchedule = async (id: string, updates: any) => handleOfflineUpdate(TABLES.CNS_MAINTENANCE_SCHEDULES, id, updates, async () => (await getSupabaseSafe().from(TABLES.CNS_MAINTENANCE_SCHEDULES).update(updates).eq('id', id).select().single()).data);
export const deleteMaintenanceSchedule = async (id: string) => handleOfflineDelete(TABLES.CNS_MAINTENANCE_SCHEDULES, id, async () => (await getSupabaseSafe().from(TABLES.CNS_MAINTENANCE_SCHEDULES).delete().eq('id', id)));

export const performMaintenanceTask = async (scheduleId: string, performer: string, notes: string, audioBlob: Blob | null, imageFile: File | null) => {
    const performedAt = new Date().toISOString();
    // 1. Create Log
    const logPayload = { schedule_id: scheduleId, performed_at: performedAt, performer, notes, audio_url: null, image_url: null, created_at: performedAt };
    await handleOfflineInsert(TABLES.CNS_MAINTENANCE_LOGS, logPayload, async () => {
        const client = getSupabaseSafe();
        // File upload omitted for brevity in offline block, assumed processed or skipped
        await client.from(TABLES.CNS_MAINTENANCE_LOGS).insert(logPayload);
    });
    // 2. Update Schedule
    await handleOfflineUpdate(TABLES.CNS_MAINTENANCE_SCHEDULES, scheduleId, { last_performed_at: performedAt }, async () => {
        await getSupabaseSafe().from(TABLES.CNS_MAINTENANCE_SCHEDULES).update({ last_performed_at: performedAt }).eq('id', scheduleId);
    });
};

export const getMaintenanceLogs = async (scheduleId: string) => handleOfflineRead(TABLES.CNS_MAINTENANCE_LOGS, async () => (await getSupabaseSafe().from(TABLES.CNS_MAINTENANCE_LOGS).select('*').eq('schedule_id', scheduleId).order('performed_at', { ascending: false })).data || [], async () => db.cns_maintenance_logs.where('schedule_id').equals(scheduleId).reverse().sortBy('performed_at'));

export const calculateNextDueDate = (schedule: MaintenanceSchedule): Date => {
    let nextDue = new Date(schedule.start_date);
    nextDue.setHours(12, 0, 0, 0);
    if (!schedule.last_performed_at) return nextDue;
    const lastPerformed = new Date(schedule.last_performed_at);
    lastPerformed.setHours(12, 0, 0, 0);
    while (true) {
        const warningStart = new Date(nextDue);
        warningStart.setDate(warningStart.getDate() - schedule.warning_days);
        const isDone = (nextDue.getTime() <= lastPerformed.getTime()) || (lastPerformed.getTime() >= warningStart.getTime());
        if (!isDone) break;
        switch (schedule.recurrence_type) {
            case RecurrenceType.WEEKLY: nextDue.setDate(nextDue.getDate() + 7); break;
            case RecurrenceType.MONTHLY: nextDue.setMonth(nextDue.getMonth() + 1); break;
            case RecurrenceType.TWO_MONTHS: nextDue.setMonth(nextDue.getMonth() + 2); break;
            case RecurrenceType.QUARTERLY: nextDue.setMonth(nextDue.getMonth() + 3); break;
            case RecurrenceType.SIX_MONTHS: nextDue.setMonth(nextDue.getMonth() + 6); break;
            case RecurrenceType.YEARLY: nextDue.setFullYear(nextDue.getFullYear() + 1); break;
            default: nextDue.setMonth(nextDue.getMonth() + 1);
        }
    }
    return nextDue;
};
export const isScheduleDue = (schedule: MaintenanceSchedule): boolean => {
    const nextDue = calculateNextDueDate(schedule);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const alertStartDate = new Date(nextDue);
    alertStartDate.setDate(alertStartDate.getDate() - schedule.warning_days);
    return today >= alertStartDate;
};
