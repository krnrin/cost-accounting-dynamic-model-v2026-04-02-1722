/**
 * DashboardPage — thin orchestrator.
 *
 * All state, data-loading, and derived computations live in useDashboardData.
 * All chart configs live in components/dashboard/chartConfigs.
 * All visual sections are separate components under components/dashboard/.
 *
 * Original monolith: 57 KB / ~1 400 lines.
 * After split: ~120 lines (this file) + 10 focused modules.
 */
import { Spin, Empty, Row } from '@douyinfe/semi-ui';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  KpiSection,
  ChartGrid,
  AllocationProgress,
  LifecyclePnLTable,
  HarnessProfitTable,
} from '@/components/dashboard';
import { MultiImportDialog } from '@/components/MultiImportDialog';
import ScenarioSelector from '@/components/ScenarioSelector';
import AlertBanner from '@/components/AlertBanner';
import MetalImpactSummary from '@/components/MetalImpactSummary';
import '@/components/dashboard/dashboard.css';

export default function DashboardPage() {
  const d = useDashboardData();

  if (d.loading) {
    return (
      <div className="db-loading">
        <Spin size="large" />
      </div>
    );
  }

  if (!d.project) {
    return <Empty description="未找到项目" />;
  }

  return (
    <div className="db-root">
      <ScenarioSelector />
      <Row gutter={[16, 16]}>
        <AlertBanner
          projectId={d.id!}
          currentPrices={d.scenario?.config?.metalPrices ?? d.defaultMetalPrices}
          basePrices={d.defaultMetalPrices}
          thresholds={d.alertThresholds}
        />

        {d.summary && d.metalClientCheck.hasAlert && (
          <MetalImpactSummary
            harnesses={d.summary.harnesses.map((result) => ({
              harnessId: result.harnessId,
              harnessName: result.harnessName,
              result,
            }))}
            basePrices={d.defaultMetalPrices}
            newPrices={d.scenario?.config?.metalPrices ?? d.defaultMetalPrices}
            title="金属价格联动影响"
          />
        )}

        {/* Row 1: Project info + KPI cards */}
        <KpiSection
          id={d.id}
          sid={d.sid}
          project={d.project}
          scenario={d.scenario}
          harnessCount={d.harnessCount}
          totalHours={d.totalHours}
          mode={d.mode}
          setMode={d.setMode}
          vehicleCost={d.vehicleCost}
          snapshotCustomerVehicleCost={d.snapshotCustomerVehicleCost}
          customerVehicleCost={d.customerVehicleCost}
          internalVehicleCost={d.internalVehicleCost}
          grossMargin={d.grossMargin}
          allocPerVehicle={d.allocPerVehicle}
          allocSummary={d.allocSummary}
        />

        {/* Row 2: Allocation recovery KPIs + progress bars */}
        <AllocationProgress
          id={d.id}
          sid={d.sid}
          allocSummary={d.allocSummary}
          recoverySummary={d.recoverySummary}
          allocRecoveryItems={d.allocRecoveryItems}
          allocPerVehicle={d.allocPerVehicle}
        />

        {/* Row 3-4: Charts */}
        <ChartGrid
          summary={d.summary}
          scenario={d.scenario}
          effectiveCustomerHarnesses={d.effectiveCustomerHarnesses}
          internalSummary={d.internalSummary}
          internalHarnesses={d.internalHarnesses}
        />

        {/* Row 5: Lifecycle P&L */}
        {d.lifecyclePnL && <LifecyclePnLTable lifecyclePnL={d.lifecyclePnL} />}

        {/* Row 6: Harness profit detail */}
        <HarnessProfitTable
          id={d.id}
          sid={d.sid}
          project={d.project}
          summary={d.summary}
          internalProject={d.internalSummary}
          harnessTableData={d.harnessTableData}
          showMohDetail={d.showMohDetail}
          setShowMohDetail={d.setShowMohDetail}
          setShowMultiImport={d.setShowMultiImport}
          customerVehicleCost={d.customerVehicleCost}
          internalVehicleCost={d.internalVehicleCost}
          allocPerVehicle={d.allocPerVehicle}
        />
      </Row>

      <MultiImportDialog
        visible={d.showMultiImport}
        onClose={() => d.setShowMultiImport(false)}
        projectId={d.id!}
        scenarioId={d.sid}
        onImported={d.loadData}
      />
    </div>
  );
}
