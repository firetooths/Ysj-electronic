
import { getSetting, setSetting } from './settingsService';
import { SETTINGS_KEYS } from '../constants';
import { sendSms } from './smsService';
import { sendTelegramMessage } from './telegramService';
import { User, ShiftRequest, ShiftRequestType } from '../types';
import { getNotificationDefaults } from './notificationService';
import { formatGregorianToJalali } from '../utils/dateUtils';

// --- Types ---

export type ShiftEventType = 
    | 'NEW_REQUEST_LEAVE'       // Request sent to Supervisor (Leave/Sick/Invitation)
    | 'NEW_REQUEST_EXCHANGE'    // Request sent to Provider (Exchange)
    | 'PROVIDER_ACCEPTED'       // Provider Accepted -> Sent to Supervisor
    | 'APPROVED'                // Final Approval -> Sent to Requester (and Provider)
    | 'REJECTED';               // Rejected -> Sent to Requester

export interface ShiftTemplate {
    sms: string;
    telegram: string;
    smsEnabled: boolean;      // New: Default setting
    telegramEnabled: boolean; // New: Default setting
}

export interface ShiftTemplates {
    NEW_REQUEST_LEAVE: ShiftTemplate;
    NEW_REQUEST_EXCHANGE: ShiftTemplate;
    PROVIDER_ACCEPTED: ShiftTemplate;
    APPROVED: ShiftTemplate;
    REJECTED: ShiftTemplate;
}

// --- Defaults ---

const DEFAULT_TEMPLATES: ShiftTemplates = {
    NEW_REQUEST_LEAVE: {
        sms: "درخواست جدید {type} از سوی {requester} برای تاریخ {dates} ثبت شد.\nمنتظر تایید شما.",
        telegram: "<b>درخواست جدید {type}</b>\n👤 درخواست دهنده: {requester}\n📅 تاریخ: {dates}\n📝 توضیحات: {details}\n🔗 <a href='{link}'>بررسی درخواست</a>",
        smsEnabled: true,
        telegramEnabled: true
    },
    NEW_REQUEST_EXCHANGE: {
        sms: "همکار گرامی {provider}، درخواست تعویض کشیک از سوی {requester} برای تاریخ {dates} برای شما ثبت شده است.",
        telegram: "<b>درخواست تامین کشیک (تعویض)</b>\n👤 درخواست دهنده: {requester}\n🔄 تامین کننده: {provider}\n📅 تاریخ: {dates}\n🔗 <a href='{link}'>مشاهده و تایید</a>",
        smsEnabled: true,
        telegramEnabled: true
    },
    PROVIDER_ACCEPTED: {
        sms: "درخواست تعویض {requester} توسط {provider} تایید شد و منتظر تایید نهایی شماست.",
        telegram: "<b>تایید اولیه تعویض شیفت</b>\n✅ همکار جایگزین ({provider}) تایید کرد.\n👤 درخواست دهنده: {requester}\n📅 تاریخ: {dates}\n🔗 <a href='{link}'>تایید نهایی</a>",
        smsEnabled: true,
        telegramEnabled: true
    },
    APPROVED: {
        sms: "درخواست {type} شما برای تاریخ {dates} تایید نهایی شد.",
        telegram: "✅ <b>درخواست شما تایید شد</b>\nنوع: {type}\nتاریخ: {dates}\nتایید کننده: {supervisor}",
        smsEnabled: true,
        telegramEnabled: true
    },
    REJECTED: {
        sms: "درخواست {type} شما برای تاریخ {dates} رد شد.",
        telegram: "❌ <b>درخواست شما رد شد</b>\nنوع: {type}\nتاریخ: {dates}\nتوضیحات: {details}",
        smsEnabled: true,
        telegramEnabled: true
    }
};

// --- Service Functions ---

export const getShiftTemplates = async (): Promise<ShiftTemplates> => {
    try {
        const saved = await getSetting(SETTINGS_KEYS.SHIFT_TEMPLATES);
        if (saved) {
            // Merge deep to ensure new boolean flags exist if loading old data
            const parsed = JSON.parse(saved);
            const merged: any = { ...DEFAULT_TEMPLATES };
            Object.keys(DEFAULT_TEMPLATES).forEach(key => {
                const k = key as keyof ShiftTemplates;
                if (parsed[k]) {
                    merged[k] = { ...DEFAULT_TEMPLATES[k], ...parsed[k] };
                }
            });
            return merged;
        }
    } catch (e) {
        console.warn("Failed to load shift templates, using defaults", e);
    }
    return DEFAULT_TEMPLATES;
};

export const saveShiftTemplates = async (templates: ShiftTemplates): Promise<void> => {
    await setSetting(SETTINGS_KEYS.SHIFT_TEMPLATES, JSON.stringify(templates));
};

const processTemplate = (template: string, variables: Record<string, string>): string => {
    let processed = template;
    for (const key in variables) {
        processed = processed.replace(new RegExp(`{${key}}`, 'g'), variables[key] || '');
    }
    return processed;
};

export const sendShiftNotification = async (
    eventType: ShiftEventType,
    request: ShiftRequest,
    targetUser: User,
    appLink: string,
    options?: { sms?: boolean; telegram?: boolean }, // New: Runtime overrides
    additionalData?: { requesterName?: string; providerName?: string; supervisorName?: string; }
) => {
    // 1. Check Global Settings (Main Switch)
    const defaults = await getNotificationDefaults();
    const moduleSettings = defaults.shift;

    const templates = await getShiftTemplates();
    const template = templates[eventType];
    
    // Determine if we should send based on Options > Template Default > Global Config
    const shouldSendSms = (options?.sms ?? template.smsEnabled) && moduleSettings.sms.enabled;
    const shouldSendTelegram = (options?.telegram ?? template.telegramEnabled) && moduleSettings.telegram.enabled;

    if (!shouldSendSms && !shouldSendTelegram) return;

    // Prepare Variables
    const requesterName = additionalData?.requesterName || request.requester?.full_name || request.requester?.username || 'ناشناس';
    const providerName = additionalData?.providerName || request.provider?.full_name || request.provider?.username || '---';
    const supervisorName = additionalData?.supervisorName || request.supervisor?.full_name || request.supervisor?.username || '---';
    const datesStr = request.dates.map(d => formatGregorianToJalali(d)).join('، ');

    const variables: Record<string, string> = {
        requester: requesterName,
        provider: providerName,
        supervisor: supervisorName,
        type: request.request_type,
        dates: datesStr,
        details: request.description || 'ندارد',
        status: request.status,
        link: appLink
    };

    // Process Messages
    const smsMessage = processTemplate(template.sms, variables) + (defaults.smsFooter ? `\n${defaults.smsFooter}` : '');
    const tgMessage = processTemplate(template.telegram, variables) + (defaults.telegramFooter ? `\n\n<i>${defaults.telegramFooter}</i>` : '');

    // Send SMS
    if (targetUser.phone_number && shouldSendSms) {
        try {
            await sendSms([targetUser.phone_number], smsMessage, 'ShiftSystem');
        } catch (e) {
            console.error(`SMS failed for ${targetUser.username}:`, e);
        }
    }

    // Send Telegram
    if (targetUser.telegram_chat_id && shouldSendTelegram) {
        try {
            await sendTelegramMessage(targetUser.telegram_chat_id, tgMessage);
        } catch (e) {
            console.error(`Telegram failed for ${targetUser.username}:`, e);
        }
    }
};
