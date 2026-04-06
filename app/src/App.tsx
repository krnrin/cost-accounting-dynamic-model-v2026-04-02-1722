import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';
import MainLayout from '@/layouts/MainLayout';
import LoginPage from '@/pages/LoginPage';
import ProjectListPage from '@/pages/ProjectListPage';
import WizardPage from '@/pages/WizardPage';
import DashboardPage from '@/pages/DashboardPage';
import HarnessDetailPage from '@/pages/HarnessDetailPage';
import HarnessEditPage from '@/pages/HarnessEditPage';
import BomWorkbookPage from '@/pages/BomWorkbookPage';
import QuotePage from '@/pages/QuotePage';
import SimulationPage from '@/pages/SimulationPage';
import AnnualDropPage from '@/pages/AnnualDropPage';
import SettingsPage from '@/pages/SettingsPage';
import ManagerDashboardPage from '@/pages/ManagerDashboardPage';
import NotFoundPage from '@/pages/NotFoundPage';
import SWUpdatePrompt from '@/components/SWUpdatePrompt';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/hooks/useTheme';

export default function App() {
  const { isAuthenticated, restoreToken } = useAuthStore();

  // Restore JWT token to syncService on app startup
  useEffect(() => {
    restoreToken();
  }, [restoreToken]);

  useTheme();

  if (!isAuthenticated) {
    return (
      <ErrorBoundary>
        <LoginPage />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <SWUpdatePrompt />
      <Routes>
        {/* Full-screen pages (no sidebar/header) for immersive Excel experience */}
        <Route path="/project/:id/harness/:harnessId/edit" element={<HarnessEditPage />} />
        <Route path="/project/:id/bom-workbook" element={<BomWorkbookPage />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<ProjectListPage />} />
          <Route path="/manager" element={<ManagerDashboardPage />} />
          <Route path="/wizard" element={<WizardPage />} />
          <Route path="/project/:id" element={<DashboardPage />} />
          <Route path="/project/:id/harness/:harnessId" element={<HarnessDetailPage />} />
          <Route path="/project/:id/quote" element={<QuotePage />} />
          <Route path="/project/:id/simulation" element={<SimulationPage />} />
          <Route path="/project/:id/annual-drop" element={<AnnualDropPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
