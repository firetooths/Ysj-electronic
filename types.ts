
import { SupabaseClient } from '@supabase/supabase-js';

// --- Authentication & User Management ---

export type UserRole = 'Admin' | 'User' | 'Viewer';

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export interface User {
  id: string;
  username: string;
  full_name: string | null;
  phone_number: string | null;
  telegram_chat_id: string | null;
  role_id: string;
  is_active: boolean;
  last_online: string | null;
  created_at: string;
  role?: Role;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

// --- Asset Management ---

export enum AssetStatus {
  IN_USE = 'در حال استفاده',
  NEEDS_REPAIR = 'نیاز به تعمیر',
  IN_STORAGE = 'در انبار',
  DECOMMISSIONED = 'از رده خارج',
  NOT_AVAILABLE = 'موجود نیست',
  TRANSFERRED = 'منتقل شده',
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  parent_id: string | null;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface Asset {
  id: string;
  asset_id_number: string;
  name: string;
  category_id: string | null;
  location_id: string | null;
  status: string;
  description: string | null;
  image_urls: string[];
  is_verified: boolean;
  is_external: boolean;
  transferred_to: string | null;
  transferred_at: string | null;
  created_at: string;
  updated_at: string;
  category?: Category;
  location?: Location;
}

export interface AuditLog {
  id: string;
  asset_id: string;
  change_description: string;
  user_id: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

export interface MaintenanceLog {
  id: string;
  asset_id: string;
  log_date: string;
  work_done: string;
  cost: number | null;
  responsible_person: string | null;
  created_at: string;
}

export interface ExportableAsset {
  'شماره اموال': string;
  'نام تجهیز': string;
  'دسته بندی': string;
  'محل قرارگیری': string;
  'وضعیت': string;
  'تایید شده': string;
  'اموال تهران (خارج)': string;
  'توضیحات': string | null;
  'تاریخ ایجاد': string;
  'تاریخ آخرین بروزرسانی': string;
}

export interface AssetStatusItem {
  id: string;
  name: string;
  color: string | null;
  is_system: boolean;
  created_at: string;
}

// --- Phone Line Management ---

export enum NodeType {
  MDF = 'MDF',
  SLOT_DEVICE = 'Slot Device',
  CONVERTER = 'Converter',
  SOCKET = 'Socket',
}

export interface NodeConfig {
  type: NodeType;
  sets?: number;
  terminalsPerSet?: number;
  portsPerTerminal?: number;
  slots?: number;
  portsPerSlot?: number;
  ports?: number;
  description?: string;
  image_url?: string;
}

export interface Node {
  id: string;
  name: string;
  type: NodeType;
  config: NodeConfig;
  created_at: string;
}

export interface WireColor {
  name: string;
  value: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface PhoneLine {
  id: string;
  phone_number: string;
  consumer_unit: string | null;
  has_active_fault: boolean;
  created_at: string;
  tags?: Tag[];
  route_nodes?: RouteNode[];
}

export interface RouteNode {
  id: string;
  line_id: string;
  node_id: string;
  sequence: number;
  port_address: string;
  wire_1_color_name: string | null;
  wire_2_color_name: string | null;
  node?: Node;
  phone_line?: PhoneLine;
}

export interface PhoneLineLog {
  id: string;
  phone_line_id: string;
  change_description: string;
  user_id: string;
  changed_at: string;
  phone_line?: PhoneLine;
}

export enum FaultStatus {
  REPORTED = 'گزارش شده',
  RESOLVED = 'رفع شده',
}

export enum FaultType {
  DISCONNECTED = 'قطعی خط',
  NOISE = 'نویز شدید',
  ONE_WAY = 'یکطرفه شدن',
  OTHER = 'سایر',
}

export interface PhoneLineFault {
  id: string;
  phone_line_id: string;
  fault_type: FaultType;
  description: string | null;
  reporter_name: string | null;
  assigned_to: string | null;
  status: FaultStatus;
  reported_at: string;
  resolved_at: string | null;
  created_at: string;
  phone_line?: {
    phone_number: string;
    consumer_unit?: string | null;
  };
  phone_line_fault_voice_notes: { count: number }[];
  voice_notes?: PhoneLineFaultVoiceNote[];
}

export interface PhoneLineFaultVoiceNote {
  id: string;
  fault_id: string;
  audio_url: string;
  recorder_name: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface PortAssignment {
  portAddress: string;
  phoneNumber: string;
  consumerUnit: string | null;
  phoneLineId: string | null;
  routeNodeId: string | null;
}

export interface BulkPhoneLine {
  originalIndex: number;
  phone_number: string;
  consumer_unit: string | null;
  tags_string: string;
  isPhoneNumberValid: boolean;
  isPhoneNumberDuplicate: boolean;
  validTagIds: string[];
  invalidTagNames: string[];
  canImport: boolean;
}

export interface BulkAsset {
  originalIndex: number;
  asset_id_number: string | null;
  name: string;
  category_name: string;
  location_name: string;
  status: string;
  description: string | null;
  is_external: boolean;
  category_id?: string;
  location_id?: string;
  isValidAssetId: boolean;
  isExistingAssetId: boolean;
  isCategoryValid: boolean;
  isLocationValid: boolean;
  isStatusValid: boolean;
  canImport: boolean;
}

// --- Contact Management ---

export interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  organization: string | null;
  job_title: string | null;
  notes: string | null;
  created_at: string;
  phone_numbers?: ContactPhoneNumber[];
  emails?: ContactEmail[];
  groups?: ContactGroup[];
}

export interface ContactGroup {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ContactPhoneNumber {
  id?: string;
  contact_id?: string;
  phone_number: string;
  type: string;
}

export interface ContactEmail {
  id?: string;
  contact_id?: string;
  email: string;
  type: string;
}

// --- CNS Management ---

export enum CNSFaultStatus {
  REPORTED = 'ثبت شده',
  IN_PROGRESS = 'در حال رفع',
  CLOSED = 'بسته شده',
  REOPENED = 'بازگشایی شده',
}

export enum CNSFaultPriority {
  CRITICAL = 'حیاتی',
  HIGH = 'بالا',
  MEDIUM = 'متوسط',
  LOW = 'پایین',
}

export interface CNSEquipment {
  id: string;
  name_cns: string;
  operational_area: string;
  asset_number: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  location: string | null;
  support_contact: string | null;
  is_imported_from_amval: boolean;
  image_urls: string[];
  created_at: string;
  updated_at: string;
}

export interface CNSFaultReport {
  id: string;
  equipment_id: string;
  fault_type: string;
  priority_level: CNSFaultPriority;
  description: string;
  reporter_user: string;
  assigned_to: string | null;
  status: CNSFaultStatus;
  start_time: string;
  close_time: string | null;
  reopen_reason: string | null;
  created_at: string;
  updated_at: string;
  equipment?: CNSEquipment;
  action_logs?: CNSActionLog[];
  image_urls?: string[];
}

export interface CNSActionLog {
  id: string;
  report_id: string;
  action_user: string;
  action_description: string;
  status_change: string | null;
  audio_url: string | null;
  image_urls: string[] | null;
  action_time: string;
  created_at: string;
}

// --- Task Management ---

export enum TaskStatus {
  PENDING = 'در حال انجام',
  DONE = 'انجام شده',
}

export enum TaskPriority {
  HIGH = 'بالا',
  MEDIUM = 'متوسط',
  LOW = 'پایین',
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  assigned_to: string | null;
  status: TaskStatus;
  audio_url: string | null;
  image_urls: string[];
  completed_at: string | null;
  created_at: string;
}

export interface TaskLog {
  id: string;
  task_id: string;
  action_description: string;
  action_user: string;
  created_at: string;
}

// --- Maintenance Management ---

export enum RecurrenceType {
  WEEKLY = 'هفتگی',
  MONTHLY = 'ماهانه',
  TWO_MONTHS = 'دو ماهه',
  QUARTERLY = 'سه ماهه (فصلی)',
  SIX_MONTHS = 'شش ماهه',
  YEARLY = 'سالانه',
}

export interface MaintenanceSchedule {
  id: string;
  title: string;
  description: string | null;
  recurrence_type: RecurrenceType;
  start_date: string;
  warning_days: number;
  assigned_to: string | null;
  last_performed_at: string | null;
  created_at: string;
}

export interface CNSMaintenanceLog {
  id: string;
  schedule_id: string;
  performed_at: string;
  performer: string;
  notes: string | null;
  audio_url: string | null;
  image_url: string | null;
  created_at: string;
}

// --- Shift Management ---

export enum ShiftRequestType {
  LEAVE = 'مرخصی روزانه',
  SICK_LEAVE = 'مرخصی استعلاجی',
  EXCHANGE = 'تعویض شیفت',
  INVITATION = 'دعوت به کار',
}

export enum ShiftRequestStatus {
  PENDING_PROVIDER = 'در انتظار تایید همکار',
  PENDING_SUPERVISOR = 'در انتظار تایید مسئول',
  APPROVED = 'تایید نهایی شده',
  REJECTED = 'رد شده',
}

export interface ShiftRequest {
  id: string;
  request_type: ShiftRequestType;
  requester_id: string;
  provider_id: string | null;
  supervisor_id: string;
  dates: string[];
  description: string | null;
  status: ShiftRequestStatus;
  created_at: string;
  updated_at: string;
  requester?: User;
  provider?: User;
  supervisor?: User;
}

// --- Configuration & Context ---

export interface ModuleSettings {
  sms: {
    enabled: boolean;
    notifyAdminsOnAction: boolean;
    fields: string[];
  };
  telegram: {
    enabled: boolean;
    notifyAdminsOnAction: boolean;
    fields: string[];
  };
}

export interface NotificationDefaults {
  task: ModuleSettings;
  cns: ModuleSettings;
  phone: ModuleSettings;
  maintenance: ModuleSettings;
  shift: ModuleSettings;
  smsFooter: string;
  telegramFooter: string;
}

export interface CustomDashboardCard {
  id: string;
  name: string;
  filterType: 'category' | 'location';
  filterValue: string;
  filterValueName: string;
  statusFilter: string | 'all';
}

export interface PhoneLineDashboardCard {
  id: string;
  name: string;
  tagIds: string[];
  tagNames: string[];
}

export interface CustomFont {
  id: string;
  name: string;
  base64: string;
}

export interface SupabaseContextType {
  supabase: SupabaseClient | null;
  categories: Category[];
  locations: Location[];
  assetStatuses: AssetStatusItem[];
  refreshCategories: () => Promise<void>;
  refreshLocations: () => Promise<void>;
  refreshAssetStatuses: () => Promise<void>;
  nodes: Node[];
  wireColors: WireColor[];
  tags: Tag[];
  refreshNodes: () => Promise<void>;
  refreshWireColors: () => Promise<void>;
  refreshTags: () => Promise<void>;
  contactGroups: ContactGroup[];
  refreshContactGroups: () => Promise<void>;
  isLoading: boolean;
}
