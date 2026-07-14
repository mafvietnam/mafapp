import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/auth-context';
import GuidePage from './pages/guide-page';
import LoginPage from './pages/login-page';
import SsoCallbackPage from './pages/sso-callback-page';
import ProfilePage from './pages/profile-page';
import DashboardPage from './pages/dashboard-page';
import CalculatorPage from './pages/calculator-page';
import ProtectedRoute from './components/layout/protected-route';
import AdminProtectedRoute from './components/layout/admin-protected-route';
import AppLayout from './components/layout/app-layout';
import AdminLayout from './components/admin/admin-layout';
import AdminDashboardPage from './pages/admin/admin-dashboard-page';
import AdminUsersPage from './pages/admin/admin-users-page';
import AdminPlaceholderPage from './pages/admin/admin-placeholder-page';
import AdminGarminPage from './pages/admin/admin-garmin-page';
import AdminStravaPage from './pages/admin/admin-strava-page';
import AdminAiPage from './pages/admin/admin-ai-page';
import AdminSettingsPage from './pages/admin/admin-settings-page';

// Lazy-loaded: pulls in the (heavier, phase-04-added) MAF analysis chart deps in a separate chunk.
const ActivityDetailPage = lazy(() => import('./pages/activity-detail-page'));
// Lazy-loaded: shares the recharts chunk with the detail page (MAF trend chart).
const JournalPage = lazy(() => import('./pages/journal-page'));

const routeSuspenseFallback = (
  <div className="flex justify-center py-20">
    <div className="w-8 h-8 border-2 border-maf-violet border-t-transparent rounded-full animate-spin" />
  </div>
);

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        {/* Login redirects to WordPress, callback handles SSO code */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<SsoCallbackPage />} />

        {/* Admin routes — requires ADMIN role */}
        <Route element={<AdminProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/stats" element={<AdminPlaceholderPage title="Thống kê" />} />
            <Route path="/admin/coaches" element={<AdminPlaceholderPage title="Huấn luyện viên" />} />
            <Route path="/admin/library" element={<AdminPlaceholderPage title="Thư viện Giáo án" />} />
            <Route path="/admin/challenges" element={<AdminPlaceholderPage title="Thử thách & Sự kiện" />} />
            <Route path="/admin/garmin" element={<AdminGarminPage />} />
            <Route path="/admin/strava" element={<AdminStravaPage />} />
            <Route path="/admin/ai" element={<AdminAiPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            <Route path="/admin/permissions" element={<AdminPlaceholderPage title="Phân quyền" />} />
          </Route>
        </Route>

        {/* All routes require authentication */}
        <Route element={<ProtectedRoute />}>
          {/* Root redirects to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* All pages inside dark theme layout */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route
              path="/journal"
              element={
                <Suspense fallback={routeSuspenseFallback}>
                  <JournalPage />
                </Suspense>
              }
            />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/plan" element={<CalculatorPage />} />
            <Route path="/guide" element={<GuidePage />} />
            <Route
              path="/activities/:id"
              element={
                <Suspense fallback={routeSuspenseFallback}>
                  <ActivityDetailPage />
                </Suspense>
              }
            />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
};

export default App;
