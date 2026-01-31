
import { getSupabaseSafe } from './client';
import { MaintenanceSchedule, CNSMaintenanceLog as MaintenanceLog, RecurrenceType } from '../types';
import { STORAGE_BUCKETS, TABLES } from '../constants';
import { processImageForUpload } from '../utils/imageProcessor';

// --- Schedules ---

export const getMaintenanceSchedules = async (): Promise<MaintenanceSchedule[]> => {
    const client = getSupabaseSafe();
    const { data, error } = await client
        .from(TABLES.CNS_MAINTENANCE_SCHEDULES)
        .select('*')
        .order('title');
    
    if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') {
             console.error("Missing tables for Maintenance module.");
             throw new Error("جداول مربوط به سیستم نگهداری در دیتابیس یافت نشدند. لطفاً اسکریپت SQL مربوطه را اجرا کنید.");
        }
        throw error;
    }
    return data || [];
};

export const getMaintenanceScheduleById = async (id: string): Promise<MaintenanceSchedule | null> => {
    const client = getSupabaseSafe();
    const { data, error } = await client
        .from(TABLES.CNS_MAINTENANCE_SCHEDULES)
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
    }
    return data;
};

export const createMaintenanceSchedule = async (schedule: Omit<MaintenanceSchedule, 'id' | 'created_at' | 'last_performed_at'>): Promise<MaintenanceSchedule> => {
    const client = getSupabaseSafe();
    const { data, error } = await client
        .from(TABLES.CNS_MAINTENANCE_SCHEDULES)
        .insert(schedule)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const updateMaintenanceSchedule = async (id: string, updates: Partial<MaintenanceSchedule>): Promise<MaintenanceSchedule> => {
    const client = getSupabaseSafe();
    const { data, error } = await client
        .from(TABLES.CNS_MAINTENANCE_SCHEDULES)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const deleteMaintenanceSchedule = async (id: string): Promise<void> => {
    const client = getSupabaseSafe();
    const { error } = await client.from(TABLES.CNS_MAINTENANCE_SCHEDULES).delete().eq('id', id);
    if (error) throw error;
};

// --- Logs / Execution ---

export const getMaintenanceLogs = async (scheduleId: string): Promise<MaintenanceLog[]> => {
    const client = getSupabaseSafe();
    const { data, error } = await client
        .from(TABLES.CNS_MAINTENANCE_LOGS)
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('performed_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
};

export const performMaintenanceTask = async (
    scheduleId: string,
    performer: string,
    notes: string,
    audioBlob: Blob | null,
    imageFile: File | null
): Promise<void> => {
    const client = getSupabaseSafe();
    const performedAt = new Date().toISOString();
    
    // 1. Upload Audio if present
    let audioUrl = null;
    if (audioBlob) {
        const filePath = `maintenance/${scheduleId}/audio_${Date.now()}.m4a`;
        const { error: upErr } = await client.storage
            .from(STORAGE_BUCKETS.CNS_ATTACHMENTS || 'cns_attachments')
            .upload(filePath, audioBlob, { contentType: 'audio/mp4', upsert: false });
        
        if (!upErr) {
            const { data } = client.storage.from(STORAGE_BUCKETS.CNS_ATTACHMENTS || 'cns_attachments').getPublicUrl(filePath);
            audioUrl = data.publicUrl;
        }
    }

    // 2. Upload Image if present
    let imageUrl = null;
    if (imageFile) {
        try {
            const compressedBlob = await processImageForUpload(imageFile, 1000);
            const filePath = `maintenance/${scheduleId}/img_${Date.now()}.jpeg`;
            const { error: upErr } = await client.storage
                .from(STORAGE_BUCKETS.CNS_ATTACHMENTS || 'cns_attachments')
                .upload(filePath, compressedBlob, { contentType: 'image/jpeg', upsert: false });
            
            if (!upErr) {
                const { data } = client.storage.from(STORAGE_BUCKETS.CNS_ATTACHMENTS || 'cns_attachments').getPublicUrl(filePath);
                imageUrl = data.publicUrl;
            }
        } catch(e) {
            console.error("Image upload failed", e);
        }
    }

    // 3. Create Log
    const { error: logError } = await client.from(TABLES.CNS_MAINTENANCE_LOGS).insert({
        schedule_id: scheduleId,
        performed_at: performedAt,
        performer,
        notes,
        audio_url: audioUrl,
        image_url: imageUrl
    });
    if (logError) throw logError;

    // 4. Update Schedule's last_performed_at
    await client.from(TABLES.CNS_MAINTENANCE_SCHEDULES).update({ last_performed_at: performedAt }).eq('id', scheduleId);
};

// --- Helper for Due Date Calculation ---

export const calculateNextDueDate = (schedule: MaintenanceSchedule): Date => {
    // Anchor calculations to the START DATE to ensure periodicity (e.g. always on the 2nd of the month)
    let nextDue = new Date(schedule.start_date);
    // Normalize time to noon to avoid DST issues
    nextDue.setHours(12, 0, 0, 0);

    if (!schedule.last_performed_at) {
        // If never performed, the due date is strictly the start date.
        return nextDue;
    }

    const lastPerformed = new Date(schedule.last_performed_at);
    lastPerformed.setHours(12, 0, 0, 0);

    // Loop to find the next valid due date in the future relative to the last performance
    // logic: The next due date must be strictly > lastPerformed, UNLESS the last performance
    // happened *early* (within the warning window of that due date).
    
    while (true) {
        // Calculate the start of the warning window for this candidate due date
        const warningStart = new Date(nextDue);
        warningStart.setDate(warningStart.getDate() - schedule.warning_days);
        
        // A specific cycle is considered "done" if:
        // 1. The scheduled date is in the past relative to when it was performed (Standard case)
        // 2. OR, the task was performed during the warning window of this scheduled date (Early completion)
        
        const isDone = (nextDue.getTime() <= lastPerformed.getTime()) || 
                       (lastPerformed.getTime() >= warningStart.getTime());

        if (!isDone) {
            // We found a due date that is NOT covered by the last performance
            break;
        }

        // Increment to next interval
        switch (schedule.recurrence_type) {
            case RecurrenceType.WEEKLY:
                nextDue.setDate(nextDue.getDate() + 7);
                break;
            case RecurrenceType.MONTHLY:
                nextDue.setMonth(nextDue.getMonth() + 1);
                break;
            case RecurrenceType.TWO_MONTHS:
                nextDue.setMonth(nextDue.getMonth() + 2);
                break;
            case RecurrenceType.QUARTERLY:
                nextDue.setMonth(nextDue.getMonth() + 3);
                break;
            case RecurrenceType.SIX_MONTHS:
                nextDue.setMonth(nextDue.getMonth() + 6);
                break;
            case RecurrenceType.YEARLY:
                nextDue.setFullYear(nextDue.getFullYear() + 1);
                break;
            default:
                nextDue.setMonth(nextDue.getMonth() + 1);
        }
    }

    return nextDue;
};

export const isScheduleDue = (schedule: MaintenanceSchedule): boolean => {
    const nextDue = calculateNextDueDate(schedule);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate alert start date (warning_days before due date)
    const alertStartDate = new Date(nextDue);
    alertStartDate.setDate(alertStartDate.getDate() - schedule.warning_days);
    
    // It is due if today is on or after the alert start date
    return today >= alertStartDate;
};
