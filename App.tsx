
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { SupabaseProvider } from './SupabaseContext';
import { NetworkStatus } from './components/ui/NetworkStatus';
import { syncFullDatabase } from './services/offlineService';

// Auth
import { LoginPage } from './components/auth/LoginPage';
import { UserProfile } from './components/auth/UserProfile';

// Layouts
import { Layout } from './components/layout/Layout';
import { Header } from './components/layout/Header';
import { PhoneLineLayout } from './components/layout/PhoneLineLayout';
import { ContactLayout } from './components/layout/ContactLayout';
import { CNSLayout } from './components/layout/CNSLayout';
import { MaintenanceLayout } from './components/layout/MaintenanceLayout';
import { TaskLayout } from './components/layout/TaskLayout';

// Dashboards & Pages
import { MainDashboard, Dashboard } from './components/Dashboard';
import { OpenProcessesPage } from './components/OpenProcessesPage';

// Admin
import { UserManagement } from './components/admin/UserManagement';
import { RoleManagement } from './components/admin/RoleManagement';
import { UserActivityLog } from './components/admin/UserActivityLog';
import { SmsTestPage } from './components/tools/SmsTestPage';

// Settings
import { SettingsPage as GlobalSettings } from './components/settings/SettingsPage';

// Asset Management
import { AssetList } from './components/assets/AssetList';
import { AssetForm } from './components/assets/AssetForm';
import { AssetDetails } from './components/assets/AssetDetails';
import { AssetTransfer } from './components/assets/AssetTransfer';
import { TransferredAssetList } from './components/assets/TransferredAssetList';
import { CategoryManagement } from './components/categories/CategoryManagement';
import { LocationManagement } from './components/locations/LocationManagement';
import { StatusManagement } from './components/assets/StatusManagement';
import { BulkImportPage } from './components/bulk_import/BulkImportPage';
// AssetSettingsPage is missing from file list, using a placeholder/simple component to prevent error.
const AssetSettingsPage = () => <div className="p-4 text-center">تنظیمات اموال (در حال توسعه)</div>;

// Phone Lines
import { PhoneLineDashboard } from './components/phone_lines/PhoneLineDashboard';
import { PhoneLineList } from './components/phone_lines/PhoneLineList';
import { PhoneLineForm } from './components/phone_lines/PhoneLineForm';
import { PhoneLineGraphView } from './components/phone_lines/PhoneLineGraphView';
import { NodeManagement } from './components/phone_lines/NodeManagement';
import { TagManagementPage } from './components/phone_lines/TagManagementPage';
import { FaultListPage } from './components/phone_lines/FaultListPage';
import { AllLogsPage } from './components/phone_lines/AllLogsPage';
import { BulkImportPhoneLinesPage } from './components/phone_lines/BulkImportPhoneLinesPage';
import { PhoneLineSettings } from './components/phone_lines/PhoneLineSettings';

// Contacts
import { ContactDashboard } from './components/contacts/ContactDashboard';
import { ContactList } from './components/contacts/ContactList';
import { ContactForm } from './components/contacts/ContactForm';
import { GroupManagement } from './components/contacts/GroupManagement';
import { BulkImportContacts } from './components/contacts/BulkImportContacts';

// CNS
import { CNSDashboard } from './components/cns/CNSDashboard';
import { FaultList as CNSFaultList } from './components/cns/FaultList';
import { FaultDetails as CNSFaultDetails } from './components/cns/FaultDetails';
import { FaultReportForm } from './components/cns/FaultReportForm';
import { EquipmentList } from './components/cns/EquipmentList';
import { EquipmentForm } from './components/cns/EquipmentForm';
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

// Shifts
import { ShiftDashboard } from './components/shifts/ShiftDashboard';
import { ShiftStatsPage } from './components/shifts/ShiftStatsPage';
import { ShiftSettings } from './components/shifts/ShiftSettings';

// Components
const GeneralLayout: React.FC<{ title: string }> = ({ title }) => (
  <div className="min-h-screen bg-gray-100">
    <Header title={title} />
    <div className="pt-6">
        <Outlet />
    </div>
  </div>
);

const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null; // Or a spinner
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

const AdminRoute = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return user?.role?.name === 'Admin' ? <Outlet /> : <Navigate to="/" replace />;
};

export const App: React.FC = () => {
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  useEffect(() => {
      const runSync = async () => {
          if (navigator.onLine) {
              console.log("App mounted/Online: Triggering full database sync...");
              const success = await syncFullDatabase();
              if (success) {
                  setShowSyncSuccess(true);
                  setTimeout(() => setShowSyncSuccess(false), 3000);
              }
          }
      };
      runSync();
      const intervalId = setInterval(() => {
          if (navigator.onLine) runSync();
      }, 300000); 
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
                همگام‌سازی اطلاعات تکمیل شد.
            </div>
        )}
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<MainDashboard />} />
              <Route path="/open-processes" element={<GeneralLayout title="فرآیندهای باز" />}><Route index element={<OpenProcessesPage />} /></Route>
              <Route path="/profile" element={<GeneralLayout title="پروفایل کاربر" />}><Route index element={<UserProfile />} /></Route>
              
              <Route element={<AdminRoute />}>
                  <Route path="/settings" element={<GeneralLayout title="تنظیمات سیستم" />}><Route index element={<GlobalSettings />} /></Route>
                  <Route path="/admin">
                    <Route path="users" element={<GeneralLayout title="مدیریت کاربران" />}><Route index element={<UserManagement />} /></Route>
                    <Route path="users/:id/activity" element={<GeneralLayout title="فعالیت کاربر" />}><Route index element={<UserActivityLog />} /></Route>
                    <Route path="roles" element={<GeneralLayout title="مدیریت نقش‌ها" />}><Route index element={<RoleManagement />} /></Route>
                  </Route>
                  <Route path="/tools/sms-test" element={<GeneralLayout title="مدیریت پیامک" />}><Route index element={<SmsTestPage />} /></Route>
              </Route>

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

              <Route path="/contacts" element={<ContactLayout />}>
                <Route index element={<ContactDashboard />} />
                <Route path="list" element={<ContactList />} />
                <Route path="new" element={<ContactForm />} />
                <Route path="edit/:id" element={<ContactForm />} />
                <Route path="groups" element={<GroupManagement />} />
                <Route path="bulk-import" element={<BulkImportContacts />} />
              </Route>

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

              <Route path="/maintenance" element={<MaintenanceLayout />}>
                <Route index element={<MaintenanceDashboard />} />
                <Route path="list" element={<ScheduleList />} />
                <Route path="new" element={<ScheduleForm />} />
                <Route path="edit/:id" element={<ScheduleForm />} />
                <Route path="details/:id" element={<ScheduleDetails />} />
              </Route>

              <Route path="/tasks" element={<TaskLayout />}>
                <Route index element={<TaskDashboard />} />
                <Route path="list" element={<TaskList />} />
                <Route path="new" element={<TaskForm />} />
                <Route path="edit/:id" element={<TaskForm />} />
                <Route path=":id" element={<TaskDetails />} />
              </Route>

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
