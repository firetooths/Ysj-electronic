
import { getSetting } from './settingsService';
import { SETTINGS_KEYS } from '../constants';
import { NotificationDefaults, ModuleSettings } from '../types';
import { sendSms } from './smsService';
import { sendTelegramMessage } from './telegramService';
import { getUsers } from './authService';

export const MODULE_FIELDS = {
    task: {
        title: 'عنوان تسک',
        priority: 'اولویت',
        description: 'توضیحات',
        assignee: 'مسئول انجام',
        creator: 'ایجاد کننده',
        link: 'لینک مشاهده'
    },
    cns: {
        equipment: 'تجهیز',
        faultType: 'نوع خرابی',
        priority: 'اولویت',
        description: 'توضیحات',
        reporter: 'گزارش دهنده',
        link: 'لینک مشاهده'
    },
    phone: {
        phoneNumber: 'شماره تلفن',
        faultType: 'نوع خرابی',
        description: 'توضیحات',
        reporter: 'گزارش دهنده',
        link: 'لینک مشاهده'
    },
    maintenance: {
        title: 'عنوان فعالیت',
        recurrence: 'بازه تکرار',
        startDate: 'تاریخ شروع',
        description: 'توضیحات',
        link: 'لینک مشاهده'
    },
    shift: {
        requester: 'درخواست دهنده',
        type: 'نوع درخواست',
        dates: 'تاریخ‌ها',
        supervisor: 'مسئول تایید',
        status: 'وضعیت فعلی',
        link: 'لینک مشاهده'
    }
};

const DEFAULT_FIELDS = {
    task: ['title', 'priority', 'assignee', 'link'],
    cns: ['equipment', 'faultType', 'priority', 'link'],
    phone: ['phoneNumber', 'faultType', 'link'],
    maintenance: ['title', 'recurrence', 'link'],
    shift: ['requester', 'type', 'dates', 'link']
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationDefaults = {
    task: { 
        sms: { enabled: true, notifyAdminsOnAction: true, fields: ['title', 'priority'] }, 
        telegram: { enabled: true, notifyAdminsOnAction: true, fields: DEFAULT_FIELDS.task } 
    },
    cns: { 
        sms: { enabled: true, notifyAdminsOnAction: true, fields: ['equipment', 'faultType'] }, 
        telegram: { enabled: true, notifyAdminsOnAction: true, fields: DEFAULT_FIELDS.cns } 
    },
    phone: { 
        sms: { enabled: true, notifyAdminsOnAction: true, fields: ['phoneNumber', 'faultType'] }, 
        telegram: { enabled: true, notifyAdminsOnAction: true, fields: DEFAULT_FIELDS.phone } 
    },
    maintenance: { 
        sms: { enabled: true, notifyAdminsOnAction: true, fields: ['title', 'recurrence'] }, 
        telegram: { enabled: true, notifyAdminsOnAction: true, fields: DEFAULT_FIELDS.maintenance } 
    },
    shift: { 
        sms: { enabled: true, notifyAdminsOnAction: true, fields: ['requester', 'type', 'dates'] }, 
        telegram: { enabled: true, notifyAdminsOnAction: true, fields: DEFAULT_FIELDS.shift } 
    },
    smsFooter: '',
    telegramFooter: ''
};

/**
 * Retrieves the current notification defaults from settings or returns the hardcoded defaults.
 */
export const getNotificationDefaults = async (): Promise<NotificationDefaults> => {
    try {
        const saved = await getSetting(SETTINGS_KEYS.NOTIFICATION_DEFAULTS);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Deep merge shift module if missing from the saved JSON in database
            return {
                ...DEFAULT_NOTIFICATION_SETTINGS,
                ...parsed,
                // Ensure shift module exists even if parsed object is old
                shift: parsed.shift || DEFAULT_NOTIFICATION_SETTINGS.shift
            };
        }
    } catch (e) {
        console.warn("Failed to load notification settings, using code defaults", e);
    }
    return DEFAULT_NOTIFICATION_SETTINGS;
};

/**
 * Core notification handler for specific users
 */
export const handleNotifications = async (
    targetUserNames: string | string[],
    module: keyof typeof MODULE_FIELDS,
    data: Record<string, any>,
    overrides?: { sms: boolean; telegram: boolean }
) => {
    const defaults = await getNotificationDefaults();
    const config = (defaults as any)[module];
    if (!config) return;

    const names = Array.isArray(targetUserNames) ? targetUserNames : [targetUserNames];
    
    try {
        const allUsers = await getUsers();
        const targetUsers = allUsers.filter(u => {
            const name = u.full_name || u.username;
            return names.includes(name);
        });

        if (targetUsers.length === 0) return;

        // Build Messages
        const smsMsg = buildMessage(module, data, config.sms.fields, defaults.smsFooter);
        const tgMsg = buildMessage(module, data, config.telegram.fields, defaults.telegramFooter, true);

        for (const user of targetUsers) {
            // SMS
            if (user.phone_number && (overrides?.sms ?? config.sms.enabled)) {
                try {
                    await sendSms([user.phone_number], smsMsg, 'NotifySystem');
                } catch (smsErr) {
                    console.error("SMS notify failed for user:", user.username, smsErr);
                }
            }
            // Telegram
            if (user.telegram_chat_id && (overrides?.telegram ?? config.telegram.enabled)) {
                await sendTelegramMessage(user.telegram_chat_id, tgMsg);
            }
        }
    } catch (e) {
        console.error("Notification dispatch failed", e);
    }
};

/**
 * Handles administrative notification when an action occurs (e.g. ticket closed)
 */
export const handleAdminActionNotification = async (
    module: keyof typeof MODULE_FIELDS,
    actionDesc: string,
    performerName: string,
    data: Record<string, any>
) => {
    const defaults = await getNotificationDefaults();
    const config = (defaults as any)[module];
    if (!config) return;
    
    // Only proceed if admin notification is enabled for either channel
    if (!config.sms.notifyAdminsOnAction && !config.telegram.notifyAdminsOnAction) return;

    try {
        const allUsers = await getUsers();
        const admins = allUsers.filter(u => u.role?.name === 'Admin');

        if (admins.length === 0) return;

        const moduleLabel = MODULE_FIELDS[module].link?.replace('لینک مشاهده', '') || 'سیستم';
        const baseMsg = `اقدام جدید در ${moduleLabel}\nتوسط: ${performerName}\nشرح: ${actionDesc}`;
        const smsMsg = baseMsg + (defaults.smsFooter ? `\n\n${defaults.smsFooter}` : '');
        const tgMsg = `<b>${baseMsg}</b>` + (defaults.telegramFooter ? `\n\n<i>${defaults.telegramFooter}</i>` : '');

        for (const admin of admins) {
            if (admin.phone_number && config.sms.notifyAdminsOnAction) {
                try {
                    await sendSms([admin.phone_number], smsMsg, 'AdminNotify');
                } catch (e) {}
            }
            if (admin.telegram_chat_id && config.telegram.notifyAdminsOnAction) {
                await sendTelegramMessage(admin.telegram_chat_id, tgMsg);
            }
        }
    } catch (e) {
        console.error("Admin notification failed", e);
    }
};

function buildMessage(module: string, data: Record<string, any>, fields: string[], footer: string, isHtml = false): string {
    const labels = (MODULE_FIELDS as any)[module];
    let msg = isHtml ? `🔔 <b>بروزرسانی در سامانه</b>\n\n` : `🔔 بروزرسانی در سامانه\n\n`;
    
    fields.forEach(f => {
        if (data[f]) {
            msg += isHtml ? `📌 <b>${labels[f]}:</b> ${data[f]}\n` : `${labels[f]}: ${data[f]}\n`;
        }
    });

    if (footer) {
        msg += isHtml ? `\n<i>${footer}</i>` : `\n${footer}`;
    }
    return msg;
}
