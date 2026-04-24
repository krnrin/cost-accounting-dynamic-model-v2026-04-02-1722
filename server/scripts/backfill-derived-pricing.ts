import prisma from '../src/lib/prisma.js';
import { syncDerivedProjectPricingFromHarnesses } from '../src/services/projectPricingSeedService.js';

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    throw new Error('Usage: npx tsx scripts/backfill-derived-pricing.ts <projectId>');
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      projectCode: true,
      projectName: true,
      metalPrices: true,
      volumes: true,
    },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const harnesses = await prisma.harness.findMany({
    where: { projectId },
    select: { input: true },
  });

  const metalPrices = parseJson<{ copper?: number; aluminum?: number }>(project.metalPrices, {});
  const volumes = parseJson<Array<{ volume?: number }>>(project.volumes, []);
  const lifecycleTotalQty = volumes.reduce((sum, row) => sum + Number(row?.volume || 0), 0);

  const summary = await syncDerivedProjectPricingFromHarnesses(prisma, {
    projectId,
    harnessInputs: harnesses.map((item) => item.input),
    metalPrices,
    lifecycleTotalQty,
  });

  const [connectorCount, wireCount, devPartCount, auxiliaryCount] = await Promise.all([
    prisma.connectorPricing.count({ where: { projectId } }),
    prisma.wirePricing.count({ where: { projectId } }),
    prisma.devPartPricing.count({ where: { projectId } }),
    prisma.auxiliaryPricing.count({ where: { projectId } }),
  ]);

  console.log(JSON.stringify({
    projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    harnessCount: harnesses.length,
    created: summary,
    totals: {
      connectors: connectorCount,
      wires: wireCount,
      devParts: devPartCount,
      auxiliary: auxiliaryCount,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
