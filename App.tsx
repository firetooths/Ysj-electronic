
import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { SupabaseProvider } from './SupabaseContext';
import { Capacitor } from '@capacitor/core';

// Services
import { syncFullDatabase, processOfflineQueue } from './services/offlineService';

// Layouts
import { Layout } from './components/layout/Layout';
import { PhoneLineLayout } from './components/layout/PhoneLineLayout';
import { ContactLayout } from './components/layout/ContactLayout';
import { CNSLayout } from './components/layout/CNSLayout';
import { MaintenanceLayout } from './components/layout/MaintenanceLayout';
import { TaskLayout } from './components/layout/TaskLayout';
import { Header } from './components/layout/Header';

// UI
import { NetworkStatus } from './components/ui/NetworkStatus';

// Authentication
import { LoginPage } from './components/auth/LoginPage';
import { UserProfile } from './components/auth/UserProfile';

// Dashboard
import { MainDashboard, Dashboard } from './components/Dashboard';
import { OpenProcessesPage } from './components/OpenProcessesPage';

// Assets
import { AssetList } from './components/assets/AssetList';
import { AssetForm } from './components/assets/AssetForm';
import { AssetDetails } from './components/assets/AssetDetails';
import { AssetTransfer } from './components/assets/AssetTransfer';
import { TransferredAssetList } from './components/assets/TransferredAssetList';
import { CategoryManagement } from './components/categories/CategoryManagement';
import { LocationManagement } from './components/locations/LocationManagement';
import { StatusManagement } from './components/assets/StatusManagement';
import { BulkImportPage } from './components/bulk_import/BulkImportPage';
import { AssetSettingsPage, GlobalSettings } from './components/settings/SettingsPage';

// Phone Lines
import { PhoneLineDashboard } from './components/phone_lines/PhoneLineDashboard';
import { PhoneLineList } from './components/phone_lines/PhoneLineList';
import { PhoneLineForm } from './components/phone_lines/PhoneLineForm';
import { PhoneLineGraphView } from './components/phone_lines/PhoneLineGraphView';
import { NodeManagement } from './components/phone_lines/NodeManagement';
import { TagManagementPage } from './components/phone_lines/TagManagementPage';
import { PhoneLineSettings } from './components/phone_lines/PhoneLineSettings';
import { FaultListPage } from './components/phone_lines/FaultListPage';
import { AllLogsPage } from './components/phone_lines/AllLogsPage';
import { BulkImportPhoneLinesPage } from './components/phone_lines/BulkImportPhoneLinesPage';

// Contacts
import { ContactDashboard } from './components/contacts/ContactDashboard';
import { ContactList } from './components/contacts/ContactList';
import { ContactForm } from './components/contacts/ContactForm';
import { GroupManagement } from './components/contacts/GroupManagement';
import { BulkImportContacts } from './components/contacts/BulkImportContacts';

// CNS
import { CNSDashboard } from './components/cns/CNSDashboard';
import { EquipmentList } from './components/cns/EquipmentList';
import { EquipmentForm } from './components/cns/EquipmentForm';
import { FaultReportForm } from './components/cns/FaultReportForm';
import { FaultList as CNSFaultList } from './components/cns/FaultList';
import { FaultDetails as CNSFaultDetails } from './components/cns/FaultDetails';
import { BulkImportCNSEquipment } from './components/cns/BulkImportCNSEquipment';

// Maintenance
import { MaintenanceDashboard } from './components/cns/maintenance/MaintenanceDashboard';
import { ScheduleList } from './components/cns/maintenance/ScheduleList';
import { ScheduleForm } from './components/cns/maintenance/ScheduleForm';
import { ScheduleDetails } from './components/cns/maintenance/ScheduleDetails';

// Tasks
import { TaskDashboard } from './components/tasks/TaskDashboard';
import { TaskList } from './components/tasks/TaskList';
import { TaskForm } from './components/tasks/TaskForm';
import { TaskDetails } from './components/tasks/TaskDetails';

// Admin
import { UserManagement } from './components/admin/UserManagement';
import { RoleManagement } from './components/admin/RoleManagement';
import { UserActivityLog } from './components/admin/UserActivityLog';

// Tools
import { SmsTestPage } from './components/tools/SmsTestPage';

// Shifts
import { ShiftDashboard } from './components/shifts/ShiftDashboard';
import { ShiftSettings } from './components/shifts/ShiftSettings';
import { ShiftStatsPage } from './components/shifts/ShiftStatsPage';

/**
 * A wrapper for routes that require authentication
 */
const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

/**
 * A wrapper for routes that require Admin role
 */
const AdminRoute = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return user?.role?.name === 'Admin' ? <Outlet /> : <Navigate to="/" replace />;
};

/**
 * A simple layout for modules that don't have a specialized sidebar
 */
const GeneralLayout: React.FC<{ title: string }> = ({ title }) => (
    <div className="min-h-screen flex flex-col bg-gray-100">
        <Header title={title} />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto custom-scrollbar">
            <Outlet />
        </main>
    </div>
);

export const App: React.FC = () => {
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  // Sync Logic
  useEffect(() => {
      const runSync = async () => {
          if (navigator.onLine) {
              await processOfflineQueue(); // Push pending changes first
              const success = await syncFullDatabase(); // Then pull fresh data
              
              if (success) {
                  setShowSyncSuccess(true);
                  setTimeout(() => setShowSyncSuccess(false), 3000);
              }
          }
      };

      // Initial sync on app load (both browser and native)
      runSync();

      // Periodic sync check (every 60 seconds)
      const intervalId = setInterval(() => {
          if (navigator.onLine) {
              runSync();
          }
      }, 60000); 

      // Listen for online event to trigger immediate sync
      const handleOnline = () => {
          console.log("Network connected. Triggering sync...");
          runSync();
      };
      
      window.addEventListener('online', handleOnline);

      return () => {
          clearInterval(intervalId);
          window.removeEventListener('online', handleOnline);
      };
  }, []);

  return (
    <AuthProvider>
      <SupabaseProvider>
        <NetworkStatus />
        {showSyncSuccess && (
            <div className="fixed top-14 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-full shadow-lg z-50 text-sm animate-fade-in-down flex items-center">
                <i className="fas fa-check-circle ml-2"></i>
                همگام‌سازی کامل شد. آماده استفاده آفلاین.
            </div>
        )}
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<MainDashboard />} />
              <Route path="/open-processes" element={<GeneralLayout title="فرآیندهای باز" />}><Route index element={<OpenProcessesPage />} /></Route>
              <Route path="/profile" element={<GeneralLayout title="پروفایل کاربر" />}><Route index element={<UserProfile />} /></Route>
              
              {/* Admin Protected Routes */}
              <Route element={<AdminRoute />}>
                  <Route path="/settings" element={<GeneralLayout title="تنظیمات سیستم" />}><Route index element={<GlobalSettings />} /></Route>
                  <Route path="/admin">
                    <Route path="users" element={<GeneralLayout title="مدیریت کاربران" />}><Route index element={<UserManagement />} /></Route>
                    <Route path="users/:id/activity" element={<GeneralLayout title="فعالیت کاربر" />}><Route index element={<UserActivityLog />} /></Route>
                    <Route path="roles" element={<GeneralLayout title="مدیریت نقش‌ها" />}><Route index element={<RoleManagement />} /></Route>
                  </Route>
                  <Route path="/tools/sms-test" element={<GeneralLayout title="مدیریت پیامک" />}><Route index element={<SmsTestPage />} /></Route>
              </Route>

              {/* Asset Management Module */}
              <Route path="/asset-management" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="assets" element={<AssetList />} />
                <Route path="assets/new" element={<AssetForm />} />
                <Route path="assets/edit/:id" element={<AssetForm />} />
                <Route path="assets/:id" element={<AssetDetails />} />
                <Route path="assets/transfer/:id" element={<AssetTransfer />} />
                <Route path="transferred-assets" element={<TransferredAssetList />} />
                <Route path="categories" element={<CategoryManagement />} />
                <Route path="locations" element={<LocationManagement />} />
                <Route path="statuses" element={<StatusManagement />} />
                <Route path="bulk-import" element={<BulkImportPage />} />
                <Route path="settings" element={<AssetSettingsPage />} />
              </Route>

              {/* Phone Line Management Module */}
              <Route path="/phone-lines" element={<PhoneLineLayout />}>
                <Route index element={<PhoneLineDashboard />} />
                <Route path="list" element={<PhoneLineList />} />
                <Route path="new" element={<PhoneLineForm />} />
                <Route path="edit/:id" element={<PhoneLineForm />} />
                <Route path="view/:phoneNumber" element={<PhoneLineGraphView />} />
                <Route path="nodes" element={<NodeManagement />} />
                <Route path="tags" element={<TagManagementPage />} />
                <Route path="faults" element={<FaultListPage />} />
                <Route path="logs" element={<AllLogsPage />} />
                <Route path="bulk-import" element={<BulkImportPhoneLinesPage />} />
                <Route path="settings" element={<PhoneLineSettings />} />
              </Route>

              {/* Contact Management Module */}
              <Route path="/contacts" element={<ContactLayout />}>
                <Route index element={<ContactDashboard />} />
                <Route path="list" element={<ContactList />} />
                <Route path="new" element={<ContactForm />} />
                <Route path="edit/:id" element={<ContactForm />} />
                <Route path="groups" element={<GroupManagement />} />
                <Route path="bulk-import" element={<BulkImportContacts />} />
              </Route>

              {/* CNS Module */}
              <Route path="/cns" element={<CNSLayout />}>
                <Route index element={<CNSDashboard />} />
                <Route path="faults" element={<CNSFaultList />} />
                <Route path="faults/:id" element={<CNSFaultDetails />} />
                <Route path="new-fault" element={<FaultReportForm />} />
                <Route path="equipment" element={<EquipmentList />} />
                <Route path="equipment/new" element={<EquipmentForm />} />
                <Route path="equipment/edit/:id" element={<EquipmentForm />} />
                <Route path="equipment/bulk-import" element={<BulkImportCNSEquipment />} />
              </Route>

              {/* Maintenance Module */}
              <Route path="/maintenance" element={<MaintenanceLayout />}>
                <Route index element={<MaintenanceDashboard />} />
                <Route path="list" element={<ScheduleList />} />
                <Route path="new" element={<ScheduleForm />} />
                <Route path="edit/:id" element={<ScheduleForm />} />
                <Route path="details/:id" element={<ScheduleDetails />} />
              </Route>

              {/* Task Module */}
              <Route path="/tasks" element={<TaskLayout />}>
                <Route index element={<TaskDashboard />} />
                <Route path="list" element={<TaskList />} />
                <Route path="new" element={<TaskForm />} />
                <Route path="edit/:id" element={<TaskForm />} />
                <Route path=":id" element={<TaskDetails />} />
              </Route>

              {/* Shift Management Module */}
              <Route path="/shifts" element={<GeneralLayout title="سامانه تامین و تعویض شیفت" />}>
                <Route index element={<ShiftDashboard />} />
                <Route path="stats" element={<ShiftStatsPage />} />
                <Route path="settings" element={<ShiftSettings />} />
              </Route>

            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </SupabaseProvider>
    </AuthProvider>
  );
};
