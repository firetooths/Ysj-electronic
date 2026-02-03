
import Dexie, { Table } from 'dexie';

// Define the Offline Action Interface
export interface SyncAction {
  id?: number;
  table: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  data: any; // The payload (row data or ID)
  timestamp: number;
}

export class AppDatabase extends Dexie {
  // Sync Queue
  syncQueue!: Table<SyncAction>;

  // Mirrored Tables
  assets!: Table<any>;
  categories!: Table<any>;
  locations!: Table<any>;
  asset_statuses!: Table<any>;
  phone_lines!: Table<any>;
  nodes!: Table<any>;
  route_nodes!: Table<any>;
  tags!: Table<any>;
  phone_line_tags!: Table<any>;
  contacts!: Table<any>;
  contact_groups!: Table<any>;
  contact_group_members!: Table<any>;
  contact_phone_numbers!: Table<any>;
  contact_emails!: Table<any>;
  cns_equipment!: Table<any>;
  cns_fault_reports!: Table<any>;
  tasks!: Table<any>;
  shift_requests!: Table<any>;
  users!: Table<any>;
  roles!: Table<any>;
  app_settings!: Table<any>;
  
  // Additional tables needed for full offline functionality
  maintenance_logs!: Table<any>;
  audit_logs!: Table<any>;
  phone_line_logs!: Table<any>;
  phone_line_faults!: Table<any>;
  phone_line_fault_voice_notes!: Table<any>;
  cns_action_logs!: Table<any>;
  cns_maintenance_schedules!: Table<any>;
  cns_maintenance_logs!: Table<any>;
  task_logs!: Table<any>;
  sms_logs!: Table<any>;

  constructor() {
    super('YasoujAirportDB');
    
    // Update to version 2 to handle schema changes
    (this as any).version(2).stores({
      syncQueue: '++id, table, action, timestamp',
      
      // Assets
      assets: 'id, asset_id_number, status, category_id, location_id',
      categories: 'id, parent_id',
      locations: 'id, parent_id',
      asset_statuses: 'id',
      
      // Phone Lines
      phone_lines: 'id, phone_number',
      nodes: 'id',
      route_nodes: 'id, line_id, node_id',
      tags: 'id',
      // Fix: Use composite key for many-to-many relationship
      phone_line_tags: '[phone_line_id+tag_id], phone_line_id, tag_id',
      phone_line_logs: 'id, phone_line_id',
      phone_line_faults: 'id, phone_line_id',
      phone_line_fault_voice_notes: 'id, fault_id',
      
      // Contacts
      contacts: 'id',
      contact_groups: 'id',
      // Fix: Use composite key for many-to-many relationship
      contact_group_members: '[contact_id+group_id], contact_id, group_id',
      contact_phone_numbers: 'id, contact_id',
      contact_emails: 'id, contact_id',
      
      // CNS
      cns_equipment: 'id',
      cns_fault_reports: 'id, equipment_id, status',
      cns_action_logs: 'id, report_id',
      cns_maintenance_schedules: 'id',
      cns_maintenance_logs: 'id, schedule_id',
      
      // Tasks
      tasks: 'id, status, assigned_to',
      task_logs: 'id, task_id',
      
      // Shifts
      shift_requests: 'id, requester_id, status',
      
      // General/Admin
      users: 'id, username',
      roles: 'id',
      app_settings: 'key', // key is PK
      maintenance_logs: 'id, asset_id',
      audit_logs: 'id, asset_id',
      sms_logs: 'id'
    });
  }
}

export const db = new AppDatabase();
