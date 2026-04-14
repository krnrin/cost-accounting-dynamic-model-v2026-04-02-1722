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
/**
 * groupByKey — 将数组按指定 key 分组到 Map
 * 比重复 .filter() 从 O(P×N) 降为 O(P+N)
 */
function groupByKey(items, keyFn) {
    const map = new Map();
    for (const item of items) {
        const key = keyFn(item);
        let arr = map.get(key);
        if (!arr) {
            arr = [];
            map.set(key, arr);
        }
        arr.push(item);
    }
    return map;
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
    // Pre-group by projectId — O(N) instead of O(P×N) per-project .filter()
    const harnessMap = groupByKey(harnesses, (i) => i.projectId);
    const scenarioMap = groupByKey(scenarios, (i) => i.projectId);
    const quoteMap = groupByKey(quotes, (i) => i.projectId);
    const allocationMap = groupByKey(allocations, (i) => i.projectId);
    const alertMap = groupByKey(alerts, (i) => i.projectId);
    return projects.map((project) => {
        const projectHarnesses = harnessMap.get(project.id) || [];
        const projectScenarios = scenarioMap.get(project.id) || [];
        const projectQuotes = quoteMap.get(project.id) || [];
        const projectAllocations = allocationMap.get(project.id) || [];
        const projectAlerts = alertMap.get(project.id) || [];
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
function buildProfitWaterfallContributions(project, annualDropRecords, changeEvents) {
    const quoteResult = fromJson(project.quoteResult, {});
    const revenue = toNumber(project.effectivePrice ?? project.arrivalPrice ?? quoteResult.arrivalPrice ?? quoteResult.deliveredPrice, 0);
    const materialCost = toNumber(quoteResult.materialCost ?? quoteResult.materialSubtotal, 0);
    const processCost = Math.max(0, toNumber(project.internalCostBaseline, 0) - materialCost);
    const remainingAllocation = Math.max(0, toNumber(project.arrivalPrice, revenue) - toNumber(project.exWorksPrice, revenue));
    const annualDropImpact = annualDropRecords.reduce((sum, record) => sum + Math.abs(toNumber(record.priceAfter, 0) - toNumber(record.priceBefore, 0)), 0);
    const changeImpact = changeEvents.reduce((sum, change) => sum + Math.abs(toNumber(change.costImpact, 0) + toNumber(change.residualImpact, 0)), 0);
    const metalImpact = toNumber(quoteResult.metalCostImpact ?? quoteResult.metalImpact ?? quoteResult.metalPriceImpact, 0);
    const finalProfit = revenue - materialCost - processCost - remainingAllocation - annualDropImpact - changeImpact - metalImpact;
    return [
        { key: 'revenue', label: '\u6536\u5165', value: revenue },
        { key: 'material', label: 'BOM\u6750\u6599', value: -materialCost },
        { key: 'process', label: '\u8d39\u7387/\u4eba\u5de5\u5236\u9020', value: -processCost },
        { key: 'allocation', label: '\u672a\u56de\u6536\u5206\u644a', value: -remainingAllocation },
        { key: 'annual_drop', label: '\u5e74\u964d\u5f71\u54cd', value: -annualDropImpact },
        { key: 'change', label: '\u8bbe\u53d8\u5f71\u54cd', value: -changeImpact },
        { key: 'metal', label: '\u91d1\u5c5e\u8054\u52a8', value: -metalImpact },
        { key: 'profit', label: '\u6700\u7ec8\u5229\u6da6', value: finalProfit },
    ];
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
    static async getProfitWaterfall() {
        const [projects, quotes, annualDrops, changes] = await Promise.all([
            prisma.project.findMany({
                select: { id: true, projectCode: true, projectName: true, customer: true },
                orderBy: { updatedAt: 'desc' },
            }),
            prisma.quote.findMany({
                orderBy: [{ projectId: 'asc' }, { updatedAt: 'desc' }],
            }),
            prisma.annualDropRecord.findMany(),
            prisma.changeEvent.findMany(),
        ]);
        const latestQuoteByProject = new Map();
        for (const quote of quotes) {
            if (!latestQuoteByProject.has(quote.projectId)) {
                latestQuoteByProject.set(quote.projectId, quote);
            }
        }
        // Pre-group by projectId
        const annualDropMap = groupByKey(annualDrops, (r) => r.projectId);
        const changeMap = groupByKey(changes, (c) => c.projectId);
        const rows = [];
        for (const project of projects) {
            const quote = latestQuoteByProject.get(project.id);
            if (!quote)
                continue;
            const projectAnnualDrops = annualDropMap.get(project.id) || [];
            const projectChanges = changeMap.get(project.id) || [];
            const contributions = buildProfitWaterfallContributions(quote, projectAnnualDrops, projectChanges);
            const contributionMap = new Map(contributions.map((item) => [item.key, item.value]));
            rows.push({
                projectId: project.id,
                projectCode: project.projectCode,
                projectName: project.projectName,
                customer: project.customer,
                revenue: contributionMap.get('revenue') ?? 0,
                materialCost: Math.abs(contributionMap.get('material') ?? 0),
                processCost: Math.abs(contributionMap.get('process') ?? 0),
                remainingAllocation: Math.abs(contributionMap.get('allocation') ?? 0),
                annualDropImpact: Math.abs(contributionMap.get('annual_drop') ?? 0),
                changeImpact: Math.abs(contributionMap.get('change') ?? 0),
                metalImpact: Math.abs(contributionMap.get('metal') ?? 0),
                finalProfit: contributionMap.get('profit') ?? 0,
            });
        }
        const contributionTotals = rows.reduce((acc, row) => {
            acc.revenue += row.revenue;
            acc.materialCost += row.materialCost;
            acc.processCost += row.processCost;
            acc.remainingAllocation += row.remainingAllocation;
            acc.annualDropImpact += row.annualDropImpact;
            acc.changeImpact += row.changeImpact;
            acc.metalImpact += row.metalImpact;
            acc.finalProfit += row.finalProfit;
            return acc;
        }, {
            revenue: 0,
            materialCost: 0,
            processCost: 0,
            remainingAllocation: 0,
            annualDropImpact: 0,
            changeImpact: 0,
            metalImpact: 0,
            finalProfit: 0,
        });
        return {
            dimensions: [
                { key: 'revenue', label: '\u6536\u5165' },
                { key: 'materialCost', label: 'BOM\u6750\u6599' },
                { key: 'processCost', label: '\u8d39\u7387/\u4eba\u5de5\u5236\u9020' },
                { key: 'remainingAllocation', label: '\u672a\u56de\u6536\u5206\u644a' },
                { key: 'annualDropImpact', label: '\u5e74\u964d\u5f71\u54cd' },
                { key: 'changeImpact', label: '\u8bbe\u53d8\u5f71\u54cd' },
                { key: 'metalImpact', label: '\u91d1\u5c5e\u8054\u52a8' },
                { key: 'finalProfit', label: '\u6700\u7ec8\u5229\u6da6' },
            ],
            totals: contributionTotals,
            projects: rows,
        };
    }
}
