
import { getSupabaseSafe } from './client';
import { PhoneLineFault, FaultStatus } from '../types';
import { TABLES, STORAGE_BUCKETS } from '../constants';
import { logPhoneLineAction } from './phoneLogService';
import { db } from '../db';
import { handleOfflineInsert, handleOfflineUpdate, handleOfflineDelete, handleOfflineRead } from './offlineHandler';

export const getAllFaults = async (): Promise<PhoneLineFault[]> => {
    return handleOfflineRead(TABLES.PHONE_LINE_FAULTS, 
        async () => {
            const client = getSupabaseSafe();
            const { data, error } = await client.from(TABLES.PHONE_LINE_FAULTS).select('*, phone_line:phone_line_id(phone_number, consumer_unit), phone_line_fault_voice_notes(count)').order('reported_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        async () => {
            const faults = await db.phone_line_faults.orderBy('reported_at').reverse().toArray();
            const enriched = await Promise.all(faults.map(async (f) => {
                const line = await db.phone_lines.get(f.phone_line_id);
                // Mocking voice notes count offline
                return { ...f, phone_line: line, phone_line_fault_voice_notes: [{ count: 0 }] };
            }));
            return enriched as PhoneLineFault[];
        }
    );
};

export const getFaultWithNotes = async (id: string): Promise<PhoneLineFault | null> => {
    return handleOfflineRead(TABLES.PHONE_LINE_FAULTS, 
        async () => {
            const client = getSupabaseSafe();
            const { data, error } = await client.from(TABLES.PHONE_LINE_FAULTS)
                .select('*, phone_line:phone_line_id(phone_number, consumer_unit), voice_notes:phone_line_fault_voice_notes(*)')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data;
        },
        async () => {
            const fault = await db.phone_line_faults.get(id);
            if (!fault) return null;
            const line = await db.phone_lines.get(fault.phone_line_id);
            const notes = await db.phone_line_fault_voice_notes.where('fault_id').equals(id).toArray();
            return { ...fault, phone_line: line, voice_notes: notes };
        }
    );
};

export const createFaultReport = async (
    faultData: any,
    audioBlob: Blob | null,
    duration: number | null
): Promise<PhoneLineFault> => {
    // 1. Create Fault Record (Offline capable)
    const payload = { ...faultData, created_at: new Date().toISOString(), status: FaultStatus.REPORTED, reported_at: new Date().toISOString() };
    const fault = await handleOfflineInsert<PhoneLineFault>(TABLES.PHONE_LINE_FAULTS, payload, async () => {
        const client = getSupabaseSafe();
        const { data, error } = await client.from(TABLES.PHONE_LINE_FAULTS).insert(payload).select('*, phone_line:phone_line_id(phone_number)').single();
        if (error) throw error;
        return data;
    });

    // 2. Upload Audio & Add Note
    if (audioBlob) {
        await addVoiceNoteToFault(fault.id, audioBlob, faultData.reporter_name, duration || 0);
    }

    // 3. Update Line Status
    await handleOfflineUpdate(TABLES.PHONE_LINES, faultData.phone_line_id, { has_active_fault: true }, async () => {
        const client = getSupabaseSafe();
        await client.from(TABLES.PHONE_LINES).update({ has_active_fault: true }).eq('id', faultData.phone_line_id);
    });

    logPhoneLineAction(faultData.phone_line_id, "ثبت خرابی (آفلاین/آنلاین)");
    return fault;
};

export const addVoiceNoteToFault = async (faultId: string, audioBlob: Blob, recorderName: string | null, duration: number) => {
    const payload = { fault_id: faultId, recorder_name: recorderName, duration_seconds: duration, created_at: new Date().toISOString() };
    
    await handleOfflineInsert(TABLES.PHONE_LINE_FAULT_VOICE_NOTES, payload, async () => {
        const client = getSupabaseSafe();
        let audio_url = '';
        if (navigator.onLine && audioBlob) {
             const fileName = `faults/${faultId}/${Date.now()}.mp4`;
             const { error: uploadError } = await client.storage.from(STORAGE_BUCKETS.FAULT_VOICE_NOTES).upload(fileName, audioBlob);
             if (!uploadError) {
                 const { data: pub } = client.storage.from(STORAGE_BUCKETS.FAULT_VOICE_NOTES).getPublicUrl(fileName);
                 audio_url = pub.publicUrl;
             }
        }
        const { error } = await client.from(TABLES.PHONE_LINE_FAULT_VOICE_NOTES).insert({ ...payload, audio_url });
        if (error) throw error;
    });
};

export const updateFault = async (id: string, updates: Partial<PhoneLineFault>) => {
    return handleOfflineUpdate(TABLES.PHONE_LINE_FAULTS, id, updates, async () => {
        const client = getSupabaseSafe();
        const { data, error } = await client.from(TABLES.PHONE_LINE_FAULTS).update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data;
    });
};

export const resolveFault = async (faultId: string, phoneLineId: string, resolutionDescription: string = '', audioBlob: Blob | null = null, duration: number | null = null, resolverName: string = 'کاربر'): Promise<PhoneLineFault> => {
    const updates = { status: FaultStatus.RESOLVED, resolved_at: new Date().toISOString() };
    
    // Update fault
    const result = await updateFault(faultId, updates);

    // Add voice note if exists
    if (audioBlob) {
        await addVoiceNoteToFault(faultId, audioBlob, resolverName, duration || 0);
    }

    // Update line status if no other active faults
    const activeFaults = await db.phone_line_faults.where('phone_line_id').equals(phoneLineId).filter(f => f.status === FaultStatus.REPORTED && f.id !== faultId).count();
    if (activeFaults === 0) {
        await handleOfflineUpdate(TABLES.PHONE_LINES, phoneLineId, { has_active_fault: false }, async () => {
             const client = getSupabaseSafe();
             const { count } = await client.from(TABLES.PHONE_LINE_FAULTS).select('*', { count: 'exact', head: true }).eq('phone_line_id', phoneLineId).eq('status', FaultStatus.REPORTED);
             if (count === 0) {
                 await client.from(TABLES.PHONE_LINES).update({ has_active_fault: false }).eq('id', phoneLineId);
             }
        });
    }

    logPhoneLineAction(phoneLineId, `رفع خرابی (توسط ${resolverName}): ${resolutionDescription}`);
    return result;
};

export const reopenFault = async (id: string) => {
    return updateFault(id, { status: FaultStatus.REPORTED, resolved_at: null });
};

export const deleteFault = async (id: string): Promise<void> => {
    await handleOfflineDelete(TABLES.PHONE_LINE_FAULTS, id, async () => {
        const client = getSupabaseSafe();
        await client.from(TABLES.PHONE_LINE_FAULTS).delete().eq('id', id);
    });
};
