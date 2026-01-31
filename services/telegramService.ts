import { getSetting } from './settingsService';
import { SETTINGS_KEYS } from '../constants';

interface TelegramConfig {
    botToken: string;
    botUsername: string;
    isEnabled: boolean;
}

const DEFAULT_CONFIG: TelegramConfig = {
    botToken: '',
    botUsername: '',
    isEnabled: false,
};

/**
 * Get Telegram configuration from Supabase settings
 */
export const getTelegramConfig = async (): Promise<TelegramConfig> => {
    try {
        const configJson = await getSetting(SETTINGS_KEYS.TELEGRAM_CONFIG);
        if (configJson) {
            return JSON.parse(configJson);
        }
    } catch (e) {
        console.warn("Failed to load Telegram config, using defaults", e);
    }
    return DEFAULT_CONFIG;
};

/**
 * Send a message to a specific chat ID
 */
export const sendTelegramMessage = async (chatId: string, message: string): Promise<boolean> => {
    const config = await getTelegramConfig();

    if (!config.isEnabled || !config.botToken) {
        console.warn("Telegram notification skipped: disabled or no token.");
        return false;
    }

    try {
        const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
            }),
        });

        const data = await response.json();
        
        if (!data.ok) {
            console.error("Telegram API Error:", data);
            return false;
        }

        return true;
    } catch (error) {
        console.error("Failed to send Telegram message:", error);
        return false;
    }
};
