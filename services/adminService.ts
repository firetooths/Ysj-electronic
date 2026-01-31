
import { getSupabaseSafe } from './client';
import { TABLES } from '../constants';

export interface UserActivityItem {
    id: string;
    type: 'ASSET' | 'PHONE' | 'CNS_FAULT' | 'MAINTENANCE' | 'TASK';
    description: string;
    date: string;
    moduleName: string;
}

/**
 * Aggregates the last activities for a specific user from all modules.
 * Since logs utilize identifiers like 'Full Name' or 'Username' (string) rather than UserID (UUID) in the current architecture,
 * we query both to ensure we catch all logs.
 */
export const getUserActivityLogs = async (username: string, fullName: string | null): Promise<UserActivityItem[]> => {
    const client = getSupabaseSafe();
    const identifiers = [username];
    if (fullName) identifiers.push(fullName);

    const limitPerTable = 50; // Fetch enough from each to sort and get top 100 total

    // 1. Asset Management Logs
    const assetPromise = client
        .from(TABLES.AUDIT_LOGS)
        .select('id, change_description, changed_at, user_id')
        .in('user_id', identifiers)
        .order('changed_at', { ascending: false })
        .limit(limitPerTable);

    // 2. Phone Line Logs
    const phonePromise = client
        .from(TABLES.PHONE_LINE_LOGS)
        .select('id, change_description, changed_at, user_id')
        .in('user_id', identifiers)
        .order('changed_at', { ascending: false })
        .limit(limitPerTable);

    // 3. CNS Fault Actions (Fault Reports & Action Logs)
    // Note: CNS Action Logs store user in 'action_user'
    const cnsActionPromise = client
        .from(TABLES.CNS_ACTION_LOGS)
        .select('id, action_description, action_time, action_user')
        .in('action_user', identifiers)
        .order('action_time', { ascending: false })
        .limit(limitPerTable);
    
    // CNS Fault Creation (stored in reporter_user)
    const cnsReportPromise = client
        .from(TABLES.CNS_FAULT_REPORTS)
        .select('id, description, created_at, reporter_user, fault_type')
        .in('reporter_user', identifiers)
        .order('created_at', { ascending: false })
        .limit(limitPerTable);

    // 4. Maintenance Logs (stored in performer)
    // Maintenance logs store multiple performers string "Ali, Reza". We use ILIKE for loose matching.
    let maintenanceQuery = client.from(TABLES.CNS_MAINTENANCE_LOGS).select('id, notes, performed_at, performer, schedule:schedule_id(title)');
    const maintenanceOrClause = identifiers.map(id => `performer.ilike.%${id}%`).join(',');
    maintenanceQuery = maintenanceQuery.or(maintenanceOrClause).order('performed_at', { ascending: false }).limit(limitPerTable);


    // 5. Task Logs (stored in action_user)
    const taskPromise = client
        .from(TABLES.TASK_LOGS)
        .select('id, action_description, created_at, action_user, task:task_id(title)')
        .in('action_user', identifiers)
        .order('created_at', { ascending: false })
        .limit(limitPerTable);

    
    const [
        { data: assets }, 
        { data: phones }, 
        { data: cnsActions }, 
        { data: cnsReports },
        { data: maintenance },
        { data: tasks }
    ] = await Promise.all([
        assetPromise, 
        phonePromise, 
        cnsActionPromise, 
        cnsReportPromise,
        maintenanceQuery,
        taskPromise
    ]);

    const activities: UserActivityItem[] = [];

    assets?.forEach((item: any) => {
        activities.push({
            id: `asset-${item.id}`,
            type: 'ASSET',
            description: item.change_description,
            date: item.changed_at,
            moduleName: 'مدیریت اموال'
        });
    });

    phones?.forEach((item: any) => {
        activities.push({
            id: `phone-${item.id}`,
            type: 'PHONE',
            description: item.change_description,
            date: item.changed_at,
            moduleName: 'مدیریت تلفن'
        });
    });

    cnsActions?.forEach((item: any) => {
        activities.push({
            id: `cns-action-${item.id}`,
            type: 'CNS_FAULT',
            description: item.action_description,
            date: item.action_time,
            moduleName: 'خرابی CNS'
        });
    });

    cnsReports?.forEach((item: any) => {
        activities.push({
            id: `cns-report-${item.id}`,
            type: 'CNS_FAULT',
            description: `ثبت خرابی جدید (${item.fault_type}): ${item.description.substring(0, 50)}...`,
            date: item.created_at,
            moduleName: 'خرابی CNS'
        });
    });

    maintenance?.forEach((item: any) => {
        const title = item.schedule?.title || 'برنامه حذف شده';
        activities.push({
            id: `pm-${item.id}`,
            type: 'MAINTENANCE',
            description: `انجام سرویس «${title}»: ${item.notes || ''}`,
            date: item.performed_at,
            moduleName: 'سرویس و نگهداری'
        });
    });

    tasks?.forEach((item: any) => {
        const title = item.task?.title || 'تسک';
        activities.push({
            id: `task-${item.id}`,
            type: 'TASK',
            description: `تسک «${title}»: ${item.action_description}`,
            date: item.created_at,
            moduleName: 'مدیریت تسک'
        });
    });

    // Sort all by date descending
    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Return top 100
    return activities.slice(0, 100);
};
