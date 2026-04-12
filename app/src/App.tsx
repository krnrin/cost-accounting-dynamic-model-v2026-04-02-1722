import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';
import RouteErrorBoundary from '@/components/RouteErrorBoundary';
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
import NewProjectWizard from '@/pages/NewProjectWizard';
import VersionManager from '@/pages/VersionManager';
import EngineerWorkbench from '@/pages/EngineerWorkbench';
import SWUpdatePrompt from '@/components/SWUpdatePrompt';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/hooks/useTheme';
import { useGlobalErrorHandler } from '@/hooks/useGlobalErrorHandler';

export default function App() {
  const { isAuthenticated, restoreToken } = useAuthStore();

  // Restore JWT token to syncService on app startup
  useEffect(() => {
    restoreToken();
  }, [restoreToken]);

  useTheme();

  // Global error handler: catches unhandled errors & promise rejections,
  // shows Toast notification, and logs to console
  useGlobalErrorHandler();

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
        <Route path="/project/:id/s/:sid/harness/:harnessId/edit" element={
          <RouteErrorBoundary><HarnessEditPage /></RouteErrorBoundary>
        } />
        <Route path="/project/:id/s/:sid/bom-workbook" element={
          <RouteErrorBoundary><BomWorkbookPage /></RouteErrorBoundary>
        } />
        {/* Legacy full-screen routes (backward compat) */}
        <Route path="/project/:id/harness/:harnessId/edit" element={
          <RouteErrorBoundary><HarnessEditPage /></RouteErrorBoundary>
        } />
        <Route path="/project/:id/bom-workbook" element={
          <RouteErrorBoundary><BomWorkbookPage /></RouteErrorBoundary>
        } />
        <Route element={<MainLayout />}>
          <Route path="/" element={<RouteErrorBoundary><ProjectListPage /></RouteErrorBoundary>} />
          <Route path="/manager" element={<RouteErrorBoundary><ManagerDashboardPage /></RouteErrorBoundary>} />
          <Route path="/wizard" element={<RouteErrorBoundary><WizardPage /></RouteErrorBoundary>} />
          <Route path="/project/new" element={<RouteErrorBoundary><NewProjectWizard /></RouteErrorBoundary>} />
          {/* 项目级页面 */}
          <Route path="/project/:id" element={<RouteErrorBoundary><ProjectDashboardOverviewPage /></RouteErrorBoundary>} />
          <Route path="/project/:id/scenarios" element={<RouteErrorBoundary><ProjectScenariosPage /></RouteErrorBoundary>} />
          <Route path="/project/:id/scenario/:sid" element={<RouteErrorBoundary><DashboardPage /></RouteErrorBoundary>} />
          <Route path="/project/:id/compare" element={<RouteErrorBoundary><ScenarioComparePage /></RouteErrorBoundary>} />
          <Route path="/project/:id/bom/diff" element={<RouteErrorBoundary><BomDiffPage /></RouteErrorBoundary>} />
          <Route path="/project/:id/versions" element={<RouteErrorBoundary><VersionManager /></RouteErrorBoundary>} />
          {/* 场景级页面 */}
          <Route path="/project/:id/s/:sid" element={<RouteErrorBoundary><DashboardPage /></RouteErrorBoundary>} />
          <Route path="/project/:id/s/:sid/harness/:harnessId" element={<RouteErrorBoundary><HarnessDetailPage /></RouteErrorBoundary>} />
          <Route path="/project/:id/s/:sid/quote" element={<RouteErrorBoundary><QuotePage /></RouteErrorBoundary>} />
          <Route path="/project/:id/s/:sid/simulation" element={<RouteErrorBoundary><SimulationPage /></RouteErrorBoundary>} />
          <Route path="/project/:id/s/:sid/annual-drop" element={<RouteErrorBoundary><AnnualDropPage /></RouteErrorBoundary>} />
          <Route path="/project/:id/s/:sid/alloc" element={<RouteErrorBoundary><AllocManagerPage /></RouteErrorBoundary>} />
          <Route path="/project/:id/s/:sid/change-engine" element={<RouteErrorBoundary><ChangeEnginePage /></RouteErrorBoundary>} />
          <Route path="/project/:id/s/:sid/tracking" element={<RouteErrorBoundary><TrackingPage /></RouteErrorBoundary>} />
          <Route path="/project/:id/s/:sid/config" element={<RouteErrorBoundary><ConfigMatrixPage /></RouteErrorBoundary>} />
          <Route path="/project/:id/s/:sid/pricing/connectors" element={<RouteErrorBoundary><ConnectorPricingPage /></RouteErrorBoundary>} />
          <Route path="/project/:id/s/:sid/pricing/wires" element={<RouteErrorBoundary><WirePricingPage /></RouteErrorBoundary>} />
          <Route path="/project/:id/s/:sid/pricing/devparts" element={<RouteErrorBoundary><DevPartPricingPage /></RouteErrorBoundary>} />
          <Route path="/project/:id/s/:sid/workbench" element={<RouteErrorBoundary><EngineerWorkbench /></RouteErrorBoundary>} />
          <Route path="/project/:id/alerts" element={<RouteErrorBoundary><AlertsPage /></RouteErrorBoundary>} />
          <Route path="/alerts" element={<RouteErrorBoundary><AlertsPage /></RouteErrorBoundary>} />
          <Route path="/settings/alert-rules" element={<RouteErrorBoundary><AlertsPage mode="rules" /></RouteErrorBoundary>} />
          <Route path="/profile" element={<RouteErrorBoundary><ProfilePage /></RouteErrorBoundary>} />
          <Route path="/settings" element={<RouteErrorBoundary><SettingsPage /></RouteErrorBoundary>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
