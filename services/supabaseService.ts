
/*
-- =================================================================
-- Full SQL Setup Script for Supabase
-- This script is idempotent and can be re-run safely.
-- =================================================================

-- ... (Previous Tables) ...

-- Table: sms_logs
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipients text[] NOT NULL,
  message text NOT NULL,
  status text NOT NULL, -- 'SUCCESS', 'FAILED'
  provider_id text, -- ID returned from IPPanel
  error_message text,
  sender_user text, -- User who sent the SMS
  sent_at timestamp with time zone DEFAULT now()
);

-- ... (RLS Policies for sms_logs) ...
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable public access for sms_logs" ON public.sms_logs;
CREATE POLICY "Enable public access for sms_logs" ON public.sms_logs FOR ALL USING (true) WITH CHECK (true);

*/


// This file is now a "barrel" file, re-exporting all Supabase service functions
// from their modularized files in the `services/` directory.
// The Supabase client is initialized in `services/client.ts`.

export * from './services/client';
export * from './services/seeder';

// Asset Management
export * from './services/assetService';
export * from './services/auditService';
export * from './services/categoryService';
export * from './services/locationService';
export * from './services/maintenanceService';
export * from './services/storageService';
export * from './services/dashboardService';

// Phone Line Management
export * from './services/nodeService';
export * from './services/tagService';
export * from './services/phoneLineService';
export * from './services/phoneLogService';
export * from './services/faultService';

// Contact Management
export * from './services/contactService';

// CNS Management
export * from './services/cnsService';
export * from './services/cnsMaintenanceService';

// Task Management
export * from './services/taskService';

// Authentication
export * from './services/authService';

// General
export * from './services/settingsService';
export * from './services/smsService'; // Export SMS Service
export * from './services/adminService'; // Export Admin Service

// Add SMS Logs Functions directly here or moving to smsService (prefer moving to smsService)
import { getSupabaseSafe } from './services/client';
import { TABLES } from './constants';

export const getSmsLogs = async (): Promise<any[]> => {
    const client = getSupabaseSafe();
    const { data, error } = await client
        .from(TABLES.SMS_LOGS)
        .select('*')
        .order('sent_at', { ascending: false });
    
    if (error) {
        // If table doesn't exist, return empty array without crashing
        if(error.code === '42P01') return [];
        console.error("Error fetching SMS logs:", error);
        throw error;
    }
    return data || [];
};

export const createSmsLog = async (logData: {
    recipients: string[],
    message: string,
    status: 'SUCCESS' | 'FAILED',
    provider_id?: string,
    error_message?: string,
    sender_user: string
}): Promise<void> => {
    const client = getSupabaseSafe();
    const { error } = await client.from(TABLES.SMS_LOGS).insert(logData);
    if (error) {
        console.error("Error creating SMS log:", error);
        // Don't throw, just log to console so UI flow isn't broken by logging failure
    }
};
