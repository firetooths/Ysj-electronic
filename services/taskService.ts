
import { getSupabaseSafe } from './client';
import { Task, TaskStatus, TaskLog } from '../types';
import { TABLES } from '../constants';
import { db } from '../db';
import { handleOfflineInsert, handleOfflineUpdate, handleOfflineDelete, handleOfflineRead } from './offlineHandler';

export const getTasks = async (searchTerm: string = '', statusFilter: 'ALL' | 'PENDING' | 'DONE' = 'ALL', assignedToUser: string | null = null, sortBy: string = 'created_at', sortOrder: 'asc' | 'desc' = 'desc'): Promise<Task[]> => {
    const offlineFallback = async () => {
        let tasks = await db.tasks.toArray();
        if (searchTerm.length >= 3) {
            const lower = searchTerm.toLowerCase();
            tasks = tasks.filter(t => t.title.toLowerCase().includes(lower) || (t.description && t.description.toLowerCase().includes(lower)));
        }
        if (statusFilter !== 'ALL') {
            const statusText = statusFilter === 'PENDING' ? TaskStatus.PENDING : TaskStatus.DONE;
            tasks = tasks.filter(t => t.status === statusText);
        }
        if (assignedToUser) {
            tasks = tasks.filter(t => !t.assigned_to || t.assigned_to.includes(assignedToUser));
        }
        tasks.sort((a, b) => {
            const valA = a[sortBy] || '';
            const valB = b[sortBy] || '';
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return tasks;
    };

    return handleOfflineRead(TABLES.TASKS, async () => {
        const client = getSupabaseSafe();
        let query = client.from(TABLES.TASKS).select('*');
        if (searchTerm.length >= 3) query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
        if (statusFilter !== 'ALL') query = query.eq('status', statusFilter === 'PENDING' ? TaskStatus.PENDING : TaskStatus.DONE);
        if (assignedToUser) query = query.or(`assigned_to.ilike.%${assignedToUser}%,assigned_to.is.null`);
        const { data, error } = await query.order(sortBy, { ascending: sortOrder === 'asc' });
        if (error) throw error;
        return data || [];
    }, offlineFallback);
};

export const getTaskById = async (id: string): Promise<Task | null> => {
    return handleOfflineRead(TABLES.TASKS,
        async () => (await getSupabaseSafe().from(TABLES.TASKS).select('*').eq('id', id).single()).data,
        async () => db.tasks.get(id)
    );
};

export const createTask = async (task: any, audioBlob: Blob | null, images: File[], creatorName: string): Promise<Task> => {
    const payload = { ...task, created_at: new Date().toISOString() };
    const result = await handleOfflineInsert<Task>(TABLES.TASKS, payload, async () => {
        const client = getSupabaseSafe();
        const { data, error } = await client.from(TABLES.TASKS).insert(payload).select().single();
        if (error) throw error;
        return data;
    });
    
    // Add Log
    const logPayload = { task_id: result.id, action_description: `ایجاد تسک: ${task.title}`, action_user: creatorName, created_at: new Date().toISOString() };
    await handleOfflineInsert(TABLES.TASK_LOGS, logPayload, async () => {
        const client = getSupabaseSafe();
        await client.from(TABLES.TASK_LOGS).insert(logPayload);
    });

    return result;
};

export const updateTask = async (id: string, updates: any, actionUser: string) => {
    const res = await handleOfflineUpdate(TABLES.TASKS, id, updates, async () => (await getSupabaseSafe().from(TABLES.TASKS).update(updates).eq('id', id).select().single()).data);
    await handleOfflineInsert(TABLES.TASK_LOGS, { task_id: id, action_description: 'ویرایش تسک', action_user: actionUser, created_at: new Date().toISOString() }, async () => {
        await getSupabaseSafe().from(TABLES.TASK_LOGS).insert({ task_id: id, action_description: 'ویرایش تسک', action_user: actionUser });
    });
    return res;
};

export const updateTaskStatus = async (id: string, status: TaskStatus, actionUser: string) => {
    return updateTask(id, { status, completed_at: status === TaskStatus.DONE ? new Date().toISOString() : null }, actionUser);
};

export const deleteTask = async (id: string) => handleOfflineDelete(TABLES.TASKS, id, async () => (await getSupabaseSafe().from(TABLES.TASKS).delete().eq('id', id)));

export const getTaskLogs = async (taskId: string): Promise<TaskLog[]> => {
    return handleOfflineRead(TABLES.TASK_LOGS,
        async () => (await getSupabaseSafe().from(TABLES.TASK_LOGS).select('*').eq('task_id', taskId).order('created_at', { ascending: false })).data || [],
        async () => db.task_logs.where('task_id').equals(taskId).reverse().sortBy('created_at')
    );
};

export const addTaskLog = async (taskId: string, description: string, user: string) => {
    const payload = { task_id: taskId, action_description: description, action_user: user, created_at: new Date().toISOString() };
    await handleOfflineInsert(TABLES.TASK_LOGS, payload, async () => {
        await getSupabaseSafe().from(TABLES.TASK_LOGS).insert(payload);
    });
};
