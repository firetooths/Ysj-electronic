
import { getSupabaseSafe } from './client';
import { Task, TaskStatus, TaskLog } from '../types';
import { TABLES, STORAGE_BUCKETS } from '../constants';
import { processImageForUpload } from '../utils/imageProcessor';
import { getUsers } from './authService';
import { sendTelegramMessage } from './telegramService';

export const getTasks = async (
    searchTerm: string = '', 
    statusFilter: 'ALL' | 'PENDING' | 'DONE' = 'ALL',
    assignedToUser: string | null = null,
    sortBy: string = 'created_at',
    sortOrder: 'asc' | 'desc' = 'desc'
): Promise<Task[]> => {
    const client = getSupabaseSafe();
    let query = client.from(TABLES.TASKS).select('*');
    
    if (searchTerm.length >= 3) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }

    if (statusFilter !== 'ALL') {
        const statusText = statusFilter === 'PENDING' ? TaskStatus.PENDING : TaskStatus.DONE;
        query = query.eq('status', statusText);
    }

    if (assignedToUser) {
        // Filter for tasks assigned to this user OR tasks assigned to everyone (null)
        query = query.or(`assigned_to.ilike.%${assignedToUser}%,assigned_to.is.null`);
    }
    
    const { data, error } = await query.order(sortBy, { ascending: sortOrder === 'asc' });
    
    if (error) {
        // Check for missing table error
        if (error.code === 'PGRST205' || error.code === '42P01') {
            throw new Error("جدول‌های مربوط به سیستم تسک یافت نشدند. لطفا اسکریپت SQL را اجرا کنید.");
        }
        throw error;
    }
    return data || [];
};

export const getTaskById = async (id: string): Promise<Task | null> => {
    const client = getSupabaseSafe();
    const { data, error } = await client
        .from(TABLES.TASKS)
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
    }
    return data;
};

export const getTaskLogs = async (taskId: string): Promise<TaskLog[]> => {
    const client = getSupabaseSafe();
    const { data, error } = await client
        .from(TABLES.TASK_LOGS)
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
};

export const createTask = async (
    task: Omit<Task, 'id' | 'created_at' | 'completed_at' | 'image_urls' | 'audio_url'>,
    audioBlob: Blob | null,
    images: File[],
    creatorName: string = 'سیستم'
): Promise<Task> => {
    const client = getSupabaseSafe();
    
    // 1. Insert task to get ID
    const { data: newTask, error } = await client.from(TABLES.TASKS).insert({
        ...task,
        image_urls: [],
        audio_url: null
    }).select().single();
    
    if (error) throw error;

    // 2. Upload Audio
    let audioUrl = null;
    if (audioBlob) {
        const filePath = `tasks/${newTask.id}/audio_${Date.now()}.m4a`;
        const { error: upErr } = await client.storage
            .from(STORAGE_BUCKETS.CNS_ATTACHMENTS) 
            .upload(filePath, audioBlob, { contentType: 'audio/mp4', upsert: false });
        
        if (!upErr) {
            const { data } = client.storage.from(STORAGE_BUCKETS.CNS_ATTACHMENTS).getPublicUrl(filePath);
            audioUrl = data.publicUrl;
        }
    }

    // 3. Upload Images
    const imageUrls: string[] = [];
    for (const img of images) {
        try {
            const compressedBlob = await processImageForUpload(img, 800); 
            const filePath = `tasks/${newTask.id}/img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpeg`;
            const { error: upErr } = await client.storage
                .from(STORAGE_BUCKETS.CNS_ATTACHMENTS)
                .upload(filePath, compressedBlob, { contentType: 'image/jpeg', upsert: false });
            
            if (!upErr) {
                const { data } = client.storage.from(STORAGE_BUCKETS.CNS_ATTACHMENTS).getPublicUrl(filePath);
                imageUrls.push(data.publicUrl);
            }
        } catch (e) {
            console.error("Image upload failed", e);
        }
    }

    // 4. Update Task with URLs
    const { data: finalTask, error: updateError } = await client.from(TABLES.TASKS).update({
        image_urls: imageUrls,
        audio_url: audioUrl
    }).eq('id', newTask.id).select().single();

    if (updateError) throw updateError;

    // 5. Create initial log
    await addTaskLog(newTask.id, `ایجاد تسک: ${task.title}`, creatorName);

    // 6. Send Telegram Notifications
    if (task.assigned_to) {
        // Updated to pass description and ID
        notifyAssigneesViaTelegram(
            task.assigned_to, 
            task.title, 
            task.priority, 
            creatorName, 
            task.description, 
            newTask.id
        );
    }

    return finalTask;
};

const notifyAssigneesViaTelegram = async (
    assignedToString: string, 
    taskTitle: string, 
    priority: string, 
    creatorName: string,
    description: string | null,
    taskId: string
) => {
    try {
        // assignedToString is comma separated names e.g. "Ali, Reza"
        const assignedNames = assignedToString.split('،').map(s => s.trim());
        const users = await getUsers();
        
        const targetChatIds: string[] = [];
        
        users.forEach(u => {
            const name = u.full_name || u.username;
            if (assignedNames.includes(name) && u.telegram_chat_id) {
                targetChatIds.push(u.telegram_chat_id);
            }
        });

        if (targetChatIds.length > 0) {
            const appUrl = window.location.origin + window.location.pathname;
            const taskLink = `${appUrl}#/tasks/${taskId}`;

            const message = `
🔔 <b>تسک جدید به شما محول شد</b>

📌 <b>عنوان:</b> ${taskTitle}
🚨 <b>اولویت:</b> ${priority}
👤 <b>ایجاد کننده:</b> ${creatorName}
📝 <b>توضیحات:</b> ${description ? description.substring(0, 100) + (description.length > 100 ? '...' : '') : 'ندارد'}

🔗 <a href="${taskLink}">مشاهده جزئیات تسک</a>
`;
            // Send to each user
            for (const chatId of targetChatIds) {
                await sendTelegramMessage(chatId, message);
            }
        }
    } catch (e) {
        console.error("Failed to send Telegram notification for task:", e);
    }
};

export const updateTask = async (
    id: string, 
    taskData: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'assigned_to'>>,
    actionUser: string = 'کاربر'
): Promise<Task> => {
    const client = getSupabaseSafe();
    const { data: oldTask, error: fetchError } = await client.from(TABLES.TASKS).select('*').eq('id', id).single();
    if (fetchError) throw fetchError;

    const { data, error } = await client.from(TABLES.TASKS).update(taskData).eq('id', id).select().single();
    if (error) throw error;

    const changes: string[] = [];
    if (taskData.title && taskData.title !== oldTask.title) changes.push('عنوان');
    if (taskData.priority && taskData.priority !== oldTask.priority) changes.push('اولویت');
    if (taskData.assigned_to !== oldTask.assigned_to) changes.push('مسئول انجام');
    if (taskData.description !== oldTask.description) changes.push('توضیحات');

    if (changes.length > 0) {
        await addTaskLog(id, `ویرایش تسک: ${changes.join('، ')}`, actionUser);
    }
    
    return data;
};

export const updateTaskStatus = async (id: string, status: TaskStatus, actionUser: string = 'کاربر'): Promise<void> => {
    const client = getSupabaseSafe();
    const updates: any = { status };
    
    if (status === TaskStatus.DONE) {
        updates.completed_at = new Date().toISOString();
    } else {
        updates.completed_at = null;
    }

    const { error } = await client.from(TABLES.TASKS).update(updates).eq('id', id);
    if (error) throw error;

    await addTaskLog(id, `تغییر وضعیت به: ${status}`, actionUser);
};

export const addTaskLog = async (taskId: string, description: string, user: string = 'کاربر'): Promise<void> => {
    const client = getSupabaseSafe();
    const { error } = await client.from(TABLES.TASK_LOGS).insert({
        task_id: taskId,
        action_description: description,
        action_user: user
    });
    if (error) throw error;
};

export const deleteTask = async (id: string): Promise<void> => {
    const client = getSupabaseSafe();
    // Delete logs first
    await client.from(TABLES.TASK_LOGS).delete().eq('task_id', id);
    // Delete task
    const { error } = await client.from(TABLES.TASKS).delete().eq('id', id);
    if (error) throw error;
};
