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
import BomDiffPage from '@/pages/BomDiffPage';
import QuotePage from '@/pages/QuotePage';
import SimulationPage from '@/pages/SimulationPage';
import AnnualDropPage from '@/pages/AnnualDropPage';
import SettingsPage from '@/pages/SettingsPage';
import ManagerDashboardPage from '@/pages/ManagerDashboardPage';
import AllocManagerPage from '@/pages/AllocManagerPage';
import ChangeEnginePage from '@/pages/ChangeEnginePage';
import TrackingPage from '@/pages/TrackingPage';
import AlertsPage from '@/pages/AlertsPage';
import ProfilePage from '@/pages/ProfilePage';
import NotFoundPage from '@/pages/NotFoundPage';
import ProjectDashboardOverviewPage from '@/pages/ProjectDashboardOverviewPage';
import ProjectScenariosPage from '@/pages/ProjectScenariosPage';
import ScenarioComparePage from '@/pages/ScenarioComparePage';
import ConfigMatrixPage from '@/pages/ConfigMatrixPage';
import ConnectorPricingPage from '@/pages/ConnectorPricingPage';
import WirePricingPage from '@/pages/WirePricingPage';
import DevPartPricingPage from '@/pages/DevPartPricingPage';
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
        <Route path="/project/:id/s/:sid/harness/:harnessId/edit" element={<HarnessEditPage />} />
        <Route path="/project/:id/s/:sid/bom-workbook" element={<BomWorkbookPage />} />
        {/* Legacy full-screen routes (backward compat) */}
        <Route path="/project/:id/harness/:harnessId/edit" element={<HarnessEditPage />} />
        <Route path="/project/:id/bom-workbook" element={<BomWorkbookPage />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<ProjectListPage />} />
          <Route path="/manager" element={<ManagerDashboardPage />} />
          <Route path="/wizard" element={<WizardPage />} />
          {/* 项目级页面 */}
          <Route path="/project/:id" element={<ProjectDashboardOverviewPage />} />
          <Route path="/project/:id/scenarios" element={<ProjectScenariosPage />} />
          <Route path="/project/:id/scenario/:sid" element={<DashboardPage />} />
          <Route path="/project/:id/compare" element={<ScenarioComparePage />} />
          <Route path="/project/:id/bom/diff" element={<BomDiffPage />} />
          {/* 场景级页面 */}
          <Route path="/project/:id/s/:sid" element={<DashboardPage />} />
          <Route path="/project/:id/s/:sid/harness/:harnessId" element={<HarnessDetailPage />} />
          <Route path="/project/:id/s/:sid/quote" element={<QuotePage />} />
          <Route path="/project/:id/s/:sid/simulation" element={<SimulationPage />} />
          <Route path="/project/:id/s/:sid/annual-drop" element={<AnnualDropPage />} />
          <Route path="/project/:id/s/:sid/alloc" element={<AllocManagerPage />} />
          <Route path="/project/:id/s/:sid/change-engine" element={<ChangeEnginePage />} />
          <Route path="/project/:id/s/:sid/tracking" element={<TrackingPage />} />
          <Route path="/project/:id/s/:sid/config" element={<ConfigMatrixPage />} />
          <Route path="/project/:id/s/:sid/pricing/connectors" element={<ConnectorPricingPage />} />
          <Route path="/project/:id/s/:sid/pricing/wires" element={<WirePricingPage />} />
          <Route path="/project/:id/s/:sid/pricing/devparts" element={<DevPartPricingPage />} />
          <Route path="/project/:id/alerts" element={<AlertsPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/settings/alert-rules" element={<AlertsPage mode="rules" />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
