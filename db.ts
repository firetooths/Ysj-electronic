
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
  cns_action_logs!: Table<any>;
  cns_maintenance_schedules!: Table<any>;
  cns_maintenance_logs!: Table<any>;
  task_logs!: Table<any>;

  constructor() {
    super('YasoujAirportDB');
    (this as any).version(1).stores({
      syncQueue: '++id, table, action, timestamp',
      
      // Primary Keys usually 'id'
      assets: 'id, asset_id_number, status, category_id, location_id',
      categories: 'id, parent_id',
      locations: 'id, parent_id',
      asset_statuses: 'id',
      
      phone_lines: 'id, phone_number',
      nodes: 'id',
      route_nodes: 'id, line_id, node_id',
      tags: 'id',
      phone_line_tags: 'id, phone_line_id, tag_id',
      
      contacts: 'id',
      contact_groups: 'id',
      
      cns_equipment: 'id',
      cns_fault_reports: 'id, equipment_id, status',
      
      tasks: 'id, status, assigned_to',
      shift_requests: 'id, requester_id, status',
      
      users: 'id, username',
      roles: 'id',
      app_settings: 'key', // key is PK

      maintenance_logs: 'id, asset_id',
      audit_logs: 'id, asset_id',
      phone_line_logs: 'id, phone_line_id',
      phone_line_faults: 'id, phone_line_id',
      cns_action_logs: 'id, report_id',
      cns_maintenance_schedules: 'id',
      cns_maintenance_logs: 'id, schedule_id',
      task_logs: 'id, task_id'
    });
  }
}

export const db = new AppDatabase();
