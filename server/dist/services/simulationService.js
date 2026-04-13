import prisma from '../lib/prisma.js';
import { fromJson, toJson } from '../lib/json.js';
function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}
function round2(value) {
    return Math.round(value * 100) / 100;
}
function buildResultSnapshot(scenario, input) {
    const costRates = fromJson(scenario.project.costRates, {});
    const metalPrices = fromJson(scenario.project.metalPrices, {});
    const volumesRaw = fromJson(scenario.project.volumes, {});
    const annualVolumes = Array.isArray(volumesRaw?.annual)
        ? volumesRaw.annual.map((v) => toNumber(v, 0))
        : Array.isArray(volumesRaw)
            ? volumesRaw.map((item) => toNumber(item?.volume, 0))
            : [];
    const baseVolume = annualVolumes[0] ?? toNumber(scenario.volume, 0);
    const copperAdj = toNumber(input.copperAdj, 0);
    const aluminumAdj = toNumber(input.aluminumAdj, 0);
    const volumeAdj = toNumber(input.volumeAdj, 0);
    const dropRate = toNumber(input.dropRate, 0);
    const hoursAdj = toNumber(input.hoursAdj, 0);
    const factorCostBase = copperAdj * 0.0035 +
        aluminumAdj * 0.0015 +
        hoursAdj * 0.002 +
        volumeAdj * -0.0012;
    const baselineCost = round2(toNumber(costRates.laborRate, 0) +
        toNumber(costRates.mfgRate, 0) +
        toNumber(metalPrices.copper, 0) * 0.012 +
        toNumber(metalPrices.aluminum, 0) * 0.006 +
        120);
    const simulatedCost = round2(baselineCost * (1 + factorCostBase));
    const baselineVolumeClamped = baseVolume > 0 ? baseVolume : 1;
    const simulatedVolume = Math.max(0, Math.round(baselineVolumeClamped * (1 + volumeAdj / 100)));
    const baselineAnnualValue = round2(baselineCost * baselineVolumeClamped);
    const simulatedAnnualValue = round2(simulatedCost * simulatedVolume);
    const baselineDropRate = 0;
    const simulatedAnnualDropCost = round2(simulatedCost * (1 - dropRate / 100));
    return {
        baseline: {
            vehicleCost: baselineCost,
            annualVolume: baselineVolumeClamped,
            annualValue: baselineAnnualValue,
            annualDropRate: baselineDropRate,
            scenarioId: scenario.id,
        },
        simulation: {
            vehicleCost: simulatedCost,
            annualVolume: simulatedVolume,
            annualValue: simulatedAnnualValue,
            annualDropRate: dropRate,
            annualDropCost: simulatedAnnualDropCost,
            deltas: {
                vehicleCost: round2(simulatedCost - baselineCost),
                annualValue: round2(simulatedAnnualValue - baselineAnnualValue),
                annualVolume: simulatedVolume - baselineVolumeClamped,
            },
        },
        assumptions: {
            copperAdj,
            aluminumAdj,
            volumeAdj,
            dropRate,
            hoursAdj,
        },
    };
}
function hydrate(task) {
    return {
        ...task,
        parameterSnapshot: fromJson(task.parameterSnapshot, {}),
        resultSnapshot: fromJson(task.resultSnapshot, {}),
    };
}
export class SimulationService {
    static async listByScenario(scenarioId) {
        const tasks = await prisma.simulationTask.findMany({
            where: { scenarioId },
            orderBy: { createdAt: 'desc' },
        });
        return tasks.map(hydrate);
    }
    static async getById(id) {
        const task = await prisma.simulationTask.findUnique({ where: { id } });
        if (!task) {
            const err = new Error('Simulation task not found');
            err.status = 404;
            throw err;
        }
        return hydrate(task);
    }
    static async create(projectId, scenarioId, data) {
        const created = await prisma.simulationTask.create({
            data: {
                projectId,
                scenarioId,
                name: data.name,
                status: data.status ?? 'draft',
                parameterSnapshot: toJson(data.parameterSnapshot ?? {}),
                resultSnapshot: toJson(data.resultSnapshot ?? {}),
                baselineScenarioId: data.baselineScenarioId,
                convertedScenarioId: data.convertedScenarioId,
                createdBy: data.createdBy,
            },
        });
        return hydrate(created);
    }
    static async update(id, data) {
        const current = await this.getById(id);
        const updated = await prisma.simulationTask.update({
            where: { id },
            data: {
                name: data.name ?? current.name,
                status: data.status ?? current.status,
                parameterSnapshot: data.parameterSnapshot !== undefined
                    ? toJson(data.parameterSnapshot)
                    : toJson(current.parameterSnapshot),
                resultSnapshot: data.resultSnapshot !== undefined
                    ? toJson(data.resultSnapshot)
                    : toJson(current.resultSnapshot),
                baselineScenarioId: data.baselineScenarioId ?? current.baselineScenarioId,
                convertedScenarioId: data.convertedScenarioId ?? current.convertedScenarioId,
            },
        });
        return hydrate(updated);
    }
    static async run(id) {
        const current = await this.getById(id);
        const scenario = await prisma.scenario.findUnique({
            where: { id: current.scenarioId },
            include: { project: true },
        });
        if (!scenario) {
            const err = new Error('Scenario not found');
            err.status = 404;
            throw err;
        }
        const resultSnapshot = buildResultSnapshot(scenario, current.parameterSnapshot);
        return this.update(id, {
            status: 'completed',
            resultSnapshot,
        });
    }
    static async convertToScenario(id) {
        const current = await this.getById(id);
        const sourceScenario = await prisma.scenario.findUnique({ where: { id: current.scenarioId } });
        if (!sourceScenario) {
            const err = new Error('Scenario not found');
            err.status = 404;
            throw err;
        }
        const nextScenario = await prisma.scenario.create({
            data: {
                projectId: sourceScenario.projectId,
                type: 'change',
                name: `${sourceScenario.name}-\u6a21\u62df\u8f6c\u573a\u666f`,
                status: 'draft',
                lifecycleYears: sourceScenario.lifecycleYears,
                volume: sourceScenario.volume,
                installRatio: sourceScenario.installRatio,
                rateSnapshot: sourceScenario.rateSnapshot,
                bomVersionRef: sourceScenario.bomVersionRef,
                quoteParamSnapshot: toJson({
                    ...fromJson(sourceScenario.quoteParamSnapshot, {}),
                    simulationTaskId: current.id,
                    simulationParameters: current.parameterSnapshot,
                }),
                sourceScenarioId: sourceScenario.id,
                compareBaselineId: sourceScenario.id,
                notes: current.name,
                createdBy: current.createdBy ?? sourceScenario.createdBy,
            },
        });
        const updatedTask = await prisma.simulationTask.update({
            where: { id },
            data: {
                status: 'converted',
                convertedScenarioId: nextScenario.id,
            },
        });
        return {
            task: hydrate(updatedTask),
            scenario: nextScenario,
        };
    }
}
