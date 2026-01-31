
import { AssetStatus, FaultType } from './types';

export const ASSET_STATUSES: AssetStatus[] = [
  AssetStatus.IN_USE,
  AssetStatus.NEEDS_REPAIR,
  AssetStatus.IN_STORAGE,
  AssetStatus.DECOMMISSIONED,
  AssetStatus.NOT_AVAILABLE,
  AssetStatus.TRANSFERRED,
];

export const FAULT_TYPES: FaultType[] = [
    FaultType.DISCONNECTED,
    FaultType.NOISE,
    FaultType.ONE_WAY,
    FaultType.OTHER
];

// Database Version Tracking
export const DB_VERSION = '1.0.5';
export const LATEST_SQL_UPDATE = `-- Version ${DB_VERSION}
-- Table: shift_requests
CREATE TABLE IF NOT EXISTS public.shift_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL, -- 'LEAVE', 'SICK_LEAVE', 'EXCHANGE', 'INVITATION'
  requester_id uuid REFERENCES public.users(id),
  provider_id uuid REFERENCES public.users(id), -- For EXCHANGE
  supervisor_id uuid REFERENCES public.users(id), -- Head of shift
  dates text[] NOT NULL, -- Array of ISO dates
  description text,
  status text DEFAULT 'PENDING', -- 'PENDING_PROVIDER', 'PENDING_SUPERVISOR', 'APPROVED', 'REJECTED'
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- RLS for shift_requests
ALTER TABLE public.shift_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for shift_requests" ON public.shift_requests;
CREATE POLICY "Enable all access for shift_requests" ON public.shift_requests FOR ALL USING (true) WITH CHECK (true);
`;

// Supabase table names
export const TABLES = {
  ASSETS: 'assets',
  CATEGORIES: 'categories',
  LOCATIONS: 'locations',
  MAINTENANCE_LOGS: 'maintenance_logs',
  AUDIT_LOGS: 'audit_logs',
  ASSET_STATUSES: 'asset_statuses',
  NODES: 'nodes',
  PHONE_LINES: 'phone_lines',
  ROUTE_NODES: 'route_nodes',
  PHONE_LINE_LOGS: 'phone_line_logs',
  PHONE_LINE_FAULTS: 'phone_line_faults',
  PHONE_LINE_FAULT_VOICE_NOTES: 'phone_line_fault_voice_notes',
  TAGS: 'tags',
  PHONE_LINE_TAGS: 'phone_line_tags',
  CONTACTS: 'contacts',
  CONTACT_GROUPS: 'contact_groups',
  CONTACT_PHONE_NUMBERS: 'contact_phone_numbers',
  CONTACT_EMAILS: 'contact_emails',
  CONTACT_GROUP_MEMBERS: 'contact_group_members',
  CNS_EQUIPMENT: 'cns_equipment',
  CNS_FAULT_REPORTS: 'cns_fault_reports',
  CNS_ACTION_LOGS: 'cns_action_logs',
  CNS_MAINTENANCE_SCHEDULES: 'cns_maintenance_schedules',
  CNS_MAINTENANCE_LOGS: 'cns_maintenance_logs',
  TASKS: 'tasks',
  TASK_LOGS: 'task_logs',
  ROLES: 'roles',
  USERS: 'users',
  REFRESH_TOKENS: 'refresh_tokens',
  APP_SETTINGS: 'app_settings',
  SMS_LOGS: 'sms_logs',
  SHIFT_REQUESTS: 'shift_requests',
};

export const STORAGE_BUCKETS = {
  ASSET_IMAGES: 'asset_images',
  FAULT_VOICE_NOTES: 'fault_voice_notes',
  CNS_ATTACHMENTS: 'cns_attachments',
  TASK_ATTACHMENTS: 'task_attachments',
};

export const SETTINGS_KEYS = {
  DASHBOARD_CARDS: 'dashboard_cards',
  FONTS: 'custom_fonts',
  APP_FONT: 'app_font_name',
  PDF_FONT: 'pdf_id',
  SMS_CONFIG: 'sms_config', 
  TELEGRAM_CONFIG: 'telegram_config',
  NOTIFICATION_DEFAULTS: 'notification_defaults',
  DASHBOARD_ORDER: 'dashboard_module_order',
  PHONE_WIRE_COLORS: 'phone_wire_colors',
  PHONE_LINE_DASHBOARD_CARDS: 'phone_line_dashboard_cards',
  SHIFT_TEMPLATES: 'shift_notification_templates', // New Key
};

export const DASHBOARD_MODULES_INFO = [
    { id: 'open_processes', title: 'کارتابل جامع (خرابی‌ها و تسک‌ها)' },
    { id: 'shifts', title: 'تامین و تعویض شیفت' },
    { id: 'assets', title: 'مدیریت اموال' },
    { id: 'phone_lines', title: 'مدیریت خطوط تلفن' },
    { id: 'contacts', title: 'مدیریت مخاطبین' },
    { id: 'cns', title: 'اعلام خرابی تجهیزات CNS' },
    { id: 'maintenance', title: 'سرویس و نگهداری (PM)' },
    { id: 'tasks', title: 'تسک‌ها و پیگیری' },
    { id: 'admin_users', title: 'مدیریت کاربران (ادمین)' },
    { id: 'admin_roles', title: 'مدیریت نقش‌ها (ادمین)' },
    { id: 'admin_sms', title: 'مدیریت پیامک (ادمین)' },
];

export const DEFAULT_WIRE_COLORS = [
    { name: 'سفید-آبی', value: '#ffffff|#0000ff' },
    { name: 'آبی-سفید', value: '#0000ff|#ffffff' },
    { name: 'سفید-نارنجی', value: '#ffffff|#ffa500' },
    { name: 'نارنجی-سفید', value: '#ffa500|#ffffff' },
    { name: 'سفید-سبز', value: '#ffffff|#008000' },
    { name: 'سبز-سفید', value: '#008000|#ffffff' },
    { name: 'سفید-قهوه‌ای', value: '#ffffff|#8b4513' },
    { name: 'قهوه‌ای-سفید', value: '#8b4513|#ffffff' },
    { name: 'سفید-طوسی', value: '#ffffff|#808080' },
    { name: 'طوسی-سفید', value: '#808080|#ffffff' },
    { name: 'قرمز-آبی', value: '#ff0000|#0000ff' },
    { name: 'آبی-قرمز', value: '#0000ff|#ff0000' },
    { name: 'قرمز-نارنجی', value: '#ff0000|#ffa500' },
    { name: 'نارنجی-قرمز', value: '#ffa500|#ff0000' },
    { name: 'قرمز-سبز', value: '#ff0000|#008000' },
    { name: 'سبز-قرمز', value: '#008000|#ff0000' },
    { name: 'قرمز-قهوه‌ای', value: '#ff0000|#8b4513' },
    { name: 'قهوه‌ای-قرمز', value: '#8b4513|#ff0000' },
    { name: 'قرمز-طوسی', value: '#ff0000|#808080' },
    { name: 'طوسی-قرمز', value: '#808080|#ff0000' },
];

export const DEFAULT_CATEGORIES_DATA = [
  { name: 'تجهیزات IT', icon: 'fas fa-laptop' },
  { name: 'ابزار برقی', icon: 'fas fa-bolt' },
  { name: 'ابزار دستی', icon: 'fas fa-tools' },
  { name: 'لوازم اداری', icon: 'fas fa-chair' },
];

export const DEFAULT_LOCATIONS_DATA = [
  { name: 'انباری اصلی' },
  { name: 'بخش حسابداری' },
  { name: 'کارگاه فنی' },
  { name: 'دفتر مدیریت' },
];

export const DEFAULT_ASSETS_DATA = [
  { asset_id_number: '1001', name: 'دریل هیلتی', status: 'در حال استفاده', description: 'دریل چکشی بزرگ - انباری اصلی' },
  { asset_id_number: '2050', name: 'مانیتور LG 24', status: 'در حال استفاده', description: 'مانیتور بخش مالی - بخش حسابداری' },
  { asset_id_number: '5003', name: 'آچار شلاقی', status: 'در انبار', description: 'آچار بزرگ - کارگاه فنی' },
];
