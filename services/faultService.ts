
import { getSupabaseSafe } from './client';
import { PhoneLineFault, FaultStatus } from '../types';
import { TABLES, STORAGE_BUCKETS } from '../constants';
import { logPhoneLineAction } from './phoneLogService';
import { getUsers } from './authService';
import { sendTelegramMessage } from './telegramService';
import { handleAdminActionNotification } from './notificationService';

export const getAllFaults = async (): Promise<PhoneLineFault[]> => {
    const client = getSupabaseSafe();
    const { data, error } = await client
        .from(TABLES.PHONE_LINE_FAULTS)
        .select('*, phone_line:phone_line_id(phone_number, consumer_unit), phone_line_fault_voice_notes(count)')
        .order('reported_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const getFaultWithNotes = async (faultId: string): Promise<PhoneLineFault | null> => {
    const client = getSupabaseSafe();
    const { data, error } = await client
        .from(TABLES.PHONE_LINE_FAULTS)
        .select('*, phone_line:phone_line_id(phone_number, consumer_unit), voice_notes:phone_line_fault_voice_notes(*)')
        .eq('id', faultId)
        .single();
    if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
    }
    if (data && data.voice_notes) {
        data.voice_notes.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return data as PhoneLineFault;
};


export const createFaultReport = async (
    faultData: Omit<PhoneLineFault, 'id' | 'status' | 'reported_at' | 'resolved_at' | 'created_at' | 'phone_line_fault_voice_notes' | 'voice_notes'>,
    audioBlob: Blob | null,
    duration: number | null
): Promise<PhoneLineFault> => {
    const client = getSupabaseSafe();
    // Step 1: Create the main fault record
    const { data: fault, error } = await client.from(TABLES.PHONE_LINE_FAULTS).insert(faultData).select('*, phone_line:phone_line_id(phone_number)').single();
    if (error) throw error;

    // Step 2: If there's an audio blob, upload it and link it to the fault
    if (audioBlob) {
        try {
            await addVoiceNoteToFault(fault.id, audioBlob, faultData.reporter_name, duration);
        } catch (uploadError: any) {
            console.error('Audio upload failed, but fault was created:', uploadError.message);
            // Don't throw, the main fault report is already created. The user can add it later.
        }
    }

    // Step 3: Update line status and log
    await client.from(TABLES.PHONE_LINES).update({ has_active_fault: true }).eq('id', faultData.phone_line_id);
    await logPhoneLineAction(faultData.phone_line_id, `گزارش خرابی: ${faultData.fault_type}. توضیحات: ${faultData.description || 'ندارد'}`);
    
    // Step 4: Notify Admins via Telegram (using the centralized handler now, or specific logic)
    // We keep the specific logic here or replace with handleAdminActionNotification? 
    // The prompt asked for notifications on "changes". Creation is already handled, but let's standardize.
    // Keeping existing notifyAdminsViaTelegram for creation as it was specific, but for updates we use the new one.
    notifyAdminsViaTelegram(
        fault.phone_line?.phone_number || 'نامشخص', 
        faultData.fault_type, 
        faultData.description || 'بدون توضیحات',
        faultData.reporter_name || 'ناشناس'
    );

    return fault;
};

const notifyAdminsViaTelegram = async (phoneNumber: string, faultType: string, desc: string, reporter: string) => {
    try {
        const users = await getUsers();
        const admins = users.filter(u => u.role?.name === 'Admin' && u.telegram_chat_id);
        
        if (admins.length > 0) {
            const appUrl = window.location.origin + window.location.pathname;
            const link = `${appUrl}#/phone-lines/faults`;

            const message = `
⚠️ <b>اعلام خرابی خط تلفن</b>

📞 <b>شماره:</b> ${phoneNumber}
🔧 <b>نوع خرابی:</b> ${faultType}
👤 <b>گزارش دهنده:</b> ${reporter}
📝 <b>توضیحات:</b> ${desc}

🔗 <a href="${link}">مشاهده لیست خرابی‌ها</a>
`;
            for (const admin of admins) {
                await sendTelegramMessage(admin.telegram_chat_id!, message);
            }
        }
    } catch (e) {
        console.error("Failed to send Telegram notification for fault:", e);
    }
};

export const addVoiceNoteToFault = async (faultId: string, audioBlob: Blob, recorderName: string | null, duration: number | null): Promise<void> => {
    const client = getSupabaseSafe();
    const filePath = `${faultId}/${Date.now()}.m4a`;
    const { error: uploadError } = await client.storage
        .from(STORAGE_BUCKETS.FAULT_VOICE_NOTES)
        .upload(filePath, audioBlob, { contentType: 'audio/mp4', upsert: false });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = client.storage
        .from(STORAGE_BUCKETS.FAULT_VOICE_NOTES)
        .getPublicUrl(filePath);

    const { error: noteError } = await client.from(TABLES.PHONE_LINE_FAULT_VOICE_NOTES).insert({
        fault_id: faultId,
        audio_url: publicUrlData.publicUrl,
        recorder_name: recorderName,
        duration_seconds: duration,
    });

    if (noteError) throw noteError;
};


export const resolveFault = async (
    faultId: string, 
    phoneLineId: string,
    resolutionDescription: string = '',
    audioBlob: Blob | null = null,
    duration: number | null = null,
    resolverName: string = 'کاربر'
): Promise<PhoneLineFault> => {
    const client = getSupabaseSafe();
    
    // 1. Update Status
    const { data, error } = await client
        .from(TABLES.PHONE_LINE_FAULTS)
        .update({ status: FaultStatus.RESOLVED, resolved_at: new Date().toISOString() })
        .eq('id', faultId)
        .select('*, phone_line:phone_line_id(phone_number)')
        .single();
    if (error) throw error;
    
    // 2. Check active faults to update line status
    const { count } = await client
        .from(TABLES.PHONE_LINE_FAULTS)
        .select('*', { count: 'exact', head: true })
        .eq('phone_line_id', phoneLineId)
        .eq('status', FaultStatus.REPORTED);
    
    if (count === 0) {
        await client.from(TABLES.PHONE_LINES).update({ has_active_fault: false }).eq('id', phoneLineId);
    }
    
    // 3. Add Audio Note if present (Report Resolution Audio)
    if (audioBlob) {
        try {
            await addVoiceNoteToFault(faultId, audioBlob, `${resolverName} (رفع خرابی)`, duration);
        } catch (e) {
            console.error("Failed to upload resolution audio", e);
        }
    }

    // 4. Log Action
    const logDesc = `رفع خرابی نوع «${data.fault_type}». ${resolutionDescription ? `توضیحات: ${resolutionDescription}` : ''}`;
    await logPhoneLineAction(phoneLineId, logDesc);

    // 5. Notify Admin
    const appUrl = window.location.origin + window.location.pathname;
    const link = `${appUrl}#/phone-lines/faults`;
    await handleAdminActionNotification(
        'phone',
        `رفع خرابی: ${logDesc}`,
        resolverName,
        {
            phoneNumber: data.phone_line?.phone_number,
            faultType: data.fault_type,
            link: link
        }
    );

    return data;
};

export const reopenFault = async (faultId: string): Promise<PhoneLineFault> => {
    const client = getSupabaseSafe();

    // Step 1: Update the fault status and clear resolved_at
    const { data: updatedFault, error: updateError } = await client
        .from(TABLES.PHONE_LINE_FAULTS)
        .update({ status: FaultStatus.REPORTED, resolved_at: null })
        .eq('id', faultId)
        .select('*, phone_line:phone_line_id(phone_number)')
        .single();
    
    if (updateError) throw updateError;
    if (!updatedFault) throw new Error('Fault not found to reopen.');

    // Step 2: Set the line's has_active_fault to true
    const phoneLineId = updatedFault.phone_line_id;
    const { error: lineUpdateError } = await client
        .from(TABLES.PHONE_LINES)
        .update({ has_active_fault: true })
        .eq('id', phoneLineId);

    if (lineUpdateError) {
        await client.from(TABLES.PHONE_LINE_FAULTS).update({ status: FaultStatus.RESOLVED }).eq('id', faultId);
        throw lineUpdateError;
    }
    
    // Step 3: Log the action
    const logDesc = `خرابی نوع «${updatedFault.fault_type}» که قبلا رفع شده بود، مجدداً بازگشایی شد.`;
    await logPhoneLineAction(phoneLineId, logDesc);
    
    // Step 4: Notify Admin
    const appUrl = window.location.origin + window.location.pathname;
    const link = `${appUrl}#/phone-lines/faults`;
    // Try to get current user name from storage since it's not passed explicitly here, or default to 'System/User'
    let actorName = 'کاربر';
    try {
        const userStr = localStorage.getItem('user_data');
        if(userStr) {
            const u = JSON.parse(userStr);
            actorName = u.full_name || u.username;
        }
    } catch(e){}

    await handleAdminActionNotification(
        'phone',
        logDesc,
        actorName,
        {
            phoneNumber: updatedFault.phone_line?.phone_number,
            faultType: updatedFault.fault_type,
            link: link
        }
    );

    return updatedFault;
};

export const updateFault = async (
    faultId: string, 
    updates: Partial<Pick<PhoneLineFault, 'fault_type' | 'description' | 'reporter_name'>>
): Promise<PhoneLineFault> => {
    const client = getSupabaseSafe();
    
    const { data: oldFault, error: fetchError } = await client
        .from(TABLES.PHONE_LINE_FAULTS)
        .select('*, phone_line:phone_line_id(phone_number)')
        .eq('id', faultId)
        .single();
    if (fetchError) throw fetchError;
    if (!oldFault) throw new Error('Fault not found for update.');

    const { data, error } = await client
        .from(TABLES.PHONE_LINE_FAULTS)
        .update(updates)
        .eq('id', faultId)
        .select('*, phone_line:phone_line_id(phone_number)')
        .single();
        
    if (error) throw error;

    const changes: string[] = [];
    if (updates.fault_type && updates.fault_type !== oldFault.fault_type) {
        changes.push(`نوع خرابی از «${oldFault.fault_type}» به «${updates.fault_type}» تغییر کرد`);
    }
    if (updates.description !== undefined && updates.description !== oldFault.description) {
        changes.push(`توضیحات خرابی ویرایش شد`);
    }
    if (updates.reporter_name !== undefined && updates.reporter_name !== oldFault.reporter_name) {
        changes.push(`نام گزارش دهنده از «${oldFault.reporter_name || 'خالی'}» به «${updates.reporter_name || 'خالی'}» تغییر کرد`);
    }

    if (changes.length > 0) {
        const logDesc = `ویرایش گزارش خرابی: ${changes.join('، ')}.`;
        await logPhoneLineAction(data.phone_line_id, logDesc);

        // Notify Admin
        let actorName = 'کاربر';
        try {
            const userStr = localStorage.getItem('user_data');
            if(userStr) {
                const u = JSON.parse(userStr);
                actorName = u.full_name || u.username;
            }
        } catch(e){}

        const appUrl = window.location.origin + window.location.pathname;
        const link = `${appUrl}#/phone-lines/faults`;
        await handleAdminActionNotification(
            'phone',
            logDesc,
            actorName,
            {
                phoneNumber: data.phone_line?.phone_number,
                faultType: data.fault_type,
                link: link
            }
        );
    }

    return data;
};

export const deleteFault = async (id: string): Promise<void> => {
    const client = getSupabaseSafe();
    // Delete voice notes
    await client.from(TABLES.PHONE_LINE_FAULT_VOICE_NOTES).delete().eq('fault_id', id);
    // Delete the fault
    const { error } = await client.from(TABLES.PHONE_LINE_FAULTS).delete().eq('id', id);
    if (error) throw error;
};
