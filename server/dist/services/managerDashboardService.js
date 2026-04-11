import prisma from '../lib/prisma.js';
import { fromJson } from '../lib/json.js';
function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function getQuoteUnitPrice(quote) {
    const quoteResult = fromJson(quote.quoteResult, {});
    return toNumber(quote.effectivePrice ?? quote.arrivalPrice ?? quoteResult.arrivalPrice ?? quoteResult.deliveredPrice, 0);
}
async function buildProjectSummaries() {
    const [projects, harnesses, scenarios, quotes, allocations, alerts] = await Promise.all([
        prisma.project.findMany({ orderBy: { updatedAt: 'desc' } }),
        prisma.harness.findMany(),
        prisma.scenario.findMany(),
        prisma.quote.findMany({ orderBy: { updatedAt: 'desc' } }),
        prisma.allocationItem.findMany(),
        prisma.alertEvent.findMany(),
    ]);
    return projects.map((project) => {
        const projectHarnesses = harnesses.filter((item) => item.projectId === project.id);
        const projectScenarios = scenarios.filter((item) => item.projectId === project.id);
        const projectQuotes = quotes.filter((item) => item.projectId === project.id);
        const projectAllocations = allocations.filter((item) => item.projectId === project.id);
        const projectAlerts = alerts.filter((item) => item.projectId === project.id);
        const latestQuote = projectQuotes[0] ?? null;
        const scenarioVolumes = new Map();
        for (const scenario of projectScenarios) {
            scenarioVolumes.set(scenario.id, toNumber(scenario.volume, 0));
        }
        const totalRevenue = projectQuotes.reduce((sum, quote) => {
            const volume = quote.scenarioId ? scenarioVolumes.get(quote.scenarioId) ?? 0 : 0;
            return sum + getQuoteUnitPrice(quote) * volume;
        }, 0);
        const totalInternalCost = projectQuotes.reduce((sum, quote) => {
            const volume = quote.scenarioId ? scenarioVolumes.get(quote.scenarioId) ?? 0 : 0;
            return sum + toNumber(quote.internalCostBaseline, 0) * volume;
        }, 0);
        const totalAllocationAmount = projectAllocations.reduce((sum, item) => sum + toNumber(item.totalAmount, 0), 0);
        const totalRecoveredAmount = projectAllocations.reduce((sum, item) => sum + toNumber(item.actualRecovered, 0), 0);
        const activeAlertCount = projectAlerts.filter((item) => ['active', 'acknowledged'].includes(item.status)).length;
        return {
            projectId: project.id,
            projectCode: project.projectCode,
            projectName: project.projectName,
            customer: project.customer,
            status: project.status,
            harnessCount: projectHarnesses.length,
            scenarioCount: projectScenarios.length,
            quoteCount: projectQuotes.length,
            alertCount: projectAlerts.length,
            activeAlertCount,
            totalRevenue,
            totalInternalCost,
            totalProfitGap: totalRevenue - totalInternalCost,
            totalAllocationAmount,
            totalRecoveredAmount,
            recoveryRate: totalAllocationAmount > 0 ? totalRecoveredAmount / totalAllocationAmount : 0,
            latestQuoteUpdatedAt: latestQuote?.updatedAt?.toISOString?.() ?? latestQuote?.updatedAt ?? null,
            updatedAt: project.updatedAt.toISOString(),
        };
    });
}
export class ManagerDashboardService {
    static async getOverview() {
        const projects = await buildProjectSummaries();
        const totals = projects.reduce((acc, project) => {
            acc.projectCount += 1;
            acc.harnessCount += project.harnessCount;
            acc.scenarioCount += project.scenarioCount;
            acc.quoteCount += project.quoteCount;
            acc.activeAlertCount += project.activeAlertCount;
            acc.totalRevenue += project.totalRevenue;
            acc.totalInternalCost += project.totalInternalCost;
            acc.totalProfitGap += project.totalProfitGap;
            acc.totalAllocationAmount += project.totalAllocationAmount;
            acc.totalRecoveredAmount += project.totalRecoveredAmount;
            return acc;
        }, {
            projectCount: 0,
            harnessCount: 0,
            scenarioCount: 0,
            quoteCount: 0,
            activeAlertCount: 0,
            totalRevenue: 0,
            totalInternalCost: 0,
            totalProfitGap: 0,
            totalAllocationAmount: 0,
            totalRecoveredAmount: 0,
        });
        return {
            ...totals,
            recoveryRate: totals.totalAllocationAmount > 0 ? totals.totalRecoveredAmount / totals.totalAllocationAmount : 0,
            projects,
        };
    }
    static async getProfitSummary() {
        const projects = await buildProjectSummaries();
        return projects.map((project) => ({
            projectId: project.projectId,
            projectCode: project.projectCode,
            projectName: project.projectName,
            customer: project.customer,
            revenue: project.totalRevenue,
            internalCost: project.totalInternalCost,
            profitGap: project.totalProfitGap,
            profitRate: project.totalRevenue > 0 ? project.totalProfitGap / project.totalRevenue : 0,
        }));
    }
    static async getRecoverySummary() {
        const projects = await buildProjectSummaries();
        return projects.map((project) => ({
            projectId: project.projectId,
            projectCode: project.projectCode,
            projectName: project.projectName,
            totalAllocationAmount: project.totalAllocationAmount,
            totalRecoveredAmount: project.totalRecoveredAmount,
            remainingRecoveryAmount: Math.max(0, project.totalAllocationAmount - project.totalRecoveredAmount),
            recoveryRate: project.recoveryRate,
        }));
    }
    static async getAlertSummary() {
        const projects = await buildProjectSummaries();
        return projects.map((project) => ({
            projectId: project.projectId,
            projectCode: project.projectCode,
            projectName: project.projectName,
            alertCount: project.alertCount,
            activeAlertCount: project.activeAlertCount,
        }));
    }
    static async getScenarioComparison() {
        const [projects, scenarios] = await Promise.all([
            prisma.project.findMany({ select: { id: true, projectCode: true, projectName: true, customer: true } }),
            prisma.scenario.findMany({ orderBy: [{ projectId: 'asc' }, { createdAt: 'asc' }] }),
        ]);
        const projectMap = new Map(projects.map((project) => [project.id, project]));
        return scenarios.map((scenario) => {
            const project = projectMap.get(scenario.projectId);
            return {
                projectId: scenario.projectId,
                projectCode: project?.projectCode ?? '',
                projectName: project?.projectName ?? '',
                customer: project?.customer ?? '',
                scenarioId: scenario.id,
                scenarioName: scenario.name,
                scenarioType: scenario.type,
                scenarioStatus: scenario.status,
                lifecycleYears: scenario.lifecycleYears,
                volume: toNumber(scenario.volume, 0),
                compareBaselineId: scenario.compareBaselineId,
                sourceScenarioId: scenario.sourceScenarioId,
                createdAt: scenario.createdAt.toISOString(),
            };
        });
    }
    static async getAnomalySummary() {
        const [projects, changes] = await Promise.all([
            prisma.project.findMany({ select: { id: true, projectCode: true, projectName: true } }),
            prisma.changeEvent.findMany({ orderBy: { updatedAt: 'desc' } }),
        ]);
        const projectMap = new Map(projects.map((project) => [project.id, project]));
        return changes
            .filter((change) => toNumber(change.costImpact, 0) !== 0 || toNumber(change.residualImpact, 0) !== 0)
            .map((change) => {
            const project = projectMap.get(change.projectId);
            return {
                projectId: change.projectId,
                projectCode: project?.projectCode ?? '',
                projectName: project?.projectName ?? '',
                changeId: change.id,
                scenarioId: change.scenarioId,
                changeType: change.changeType,
                status: change.status,
                costImpact: toNumber(change.costImpact, 0),
                residualImpact: toNumber(change.residualImpact, 0),
                totalImpact: toNumber(change.costImpact, 0) + toNumber(change.residualImpact, 0),
                updatedAt: change.updatedAt.toISOString(),
            };
        });
    }
}
