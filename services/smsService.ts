
import { getSetting } from './settingsService';
import { SETTINGS_KEYS } from '../constants';
import { createSmsLog } from '../supabaseService';

interface SmsResponse {
  data: {
    message_outbox_ids: number[];
  } | null;
  meta: {
    status: boolean;
    message: string;
    message_code?: string;
    errors?: any;
  };
}

interface SmsConfig {
  baseUrl: string;
  apiKey: string;
  fromNumber: string;
}

const DEFAULT_CONFIG: SmsConfig = {
    baseUrl: "https://edge.ippanel.com/v1",
    apiKey: "", // Empty by default
    fromNumber: "+983000505"
};

/**
 * Get SMS configuration from Supabase settings
 */
export const getSmsConfig = async (): Promise<SmsConfig> => {
    try {
        const configJson = await getSetting(SETTINGS_KEYS.SMS_CONFIG);
        if (configJson) {
            return JSON.parse(configJson);
        }
    } catch (e) {
        console.warn("Failed to load SMS config, using defaults", e);
    }
    return DEFAULT_CONFIG;
};

/**
 * Send SMS to recipients
 * @param recipients Array of phone numbers
 * @param message Message text
 * @param senderName Optional user name for logging
 */
export const sendSms = async (recipients: string[], message: string, senderName: string = 'System'): Promise<SmsResponse> => {
  const config = await getSmsConfig();

  if (!config.apiKey) {
      throw new Error("تنظیمات سامانه پیامک (API Key) انجام نشده است. لطفاً به بخش تنظیمات مراجعه کنید.");
  }

  const url = `${config.baseUrl}/api/send`;
  const formattedRecipients = recipients.map(formatPhoneNumberForSms);

  const payload = {
    sending_type: "webservice",
    from_number: config.fromNumber,
    message: message,
    params: {
      recipients: formattedRecipients
    }
  };

  let logStatus: 'SUCCESS' | 'FAILED' = 'FAILED';
  let providerId = undefined;
  let errorMsg = undefined;
  let responseData: SmsResponse | null = null;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.apiKey
      },
      body: JSON.stringify(payload)
    });

    responseData = await response.json();

    if (!response.ok) {
         if (responseData && responseData.meta && responseData.meta.message) {
            throw new Error(responseData.meta.message);
        }
        throw new Error(`HTTP Error: ${response.status}`);
    }

    if (responseData && responseData.meta && responseData.meta.status === false) {
        let apiErrorMsg = responseData.meta.message || 'خطا در ارسال پیامک';
        if (responseData.meta.errors) {
            try {
                const details = Object.values(responseData.meta.errors).flat().join(', ');
                if (details) apiErrorMsg += `: ${details}`;
            } catch (e) {}
        }
        throw new Error(apiErrorMsg);
    }

    logStatus = 'SUCCESS';
    if (responseData?.data?.message_outbox_ids) {
        providerId = responseData.data.message_outbox_ids.join(', ');
    }
    
    return responseData as SmsResponse;

  } catch (error: any) {
    console.error('Error sending SMS:', error);
    errorMsg = error.message;
    
    if (error.message === 'Failed to fetch') {
         errorMsg = 'خطای ارتباط با پنل پیامکی (احتمالاً محدودیت CORS یا قطعی اینترنت).';
         throw new Error(errorMsg);
    }
    
    throw new Error(error.message || 'خطای ناشناخته در ارسال پیامک');
  } finally {
      // Log the attempt regardless of success/failure
      await createSmsLog({
          recipients: formattedRecipients,
          message,
          status: logStatus,
          provider_id: providerId,
          error_message: errorMsg,
          sender_user: senderName
      });
  }
};

export const formatPhoneNumberForSms = (phone: string): string => {
    let cleanPhone = phone.trim();
    if (cleanPhone.startsWith('+98')) return cleanPhone;
    if (cleanPhone.startsWith('0098')) return `+${cleanPhone.substring(2)}`;
    if (cleanPhone.startsWith('09')) return `+98${cleanPhone.substring(1)}`;
    if (cleanPhone.startsWith('9')) return `+98${cleanPhone}`;
    return cleanPhone;
};
