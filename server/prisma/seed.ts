/**
 * Seed script: creates admin user + G281 demo project with 2 harnesses.
 * Run: npx tsx prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('\u{1F331} Seeding database...');

  // 1. Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@harness.dev' },
    update: {},
    create: {
      email: 'admin@harness.dev',
      password: hashedPassword,
      name: '\u7cfb\u7edf\u7ba1\u7406\u5458',
      role: 'ADMIN',
    },
  });
  console.log(`  \u2705 Admin user: ${admin.email} (password: admin123)`);

  // 2. Create engineer user
  const engPassword = await bcrypt.hash('eng123', 10);
  const engineer = await prisma.user.upsert({
    where: { email: 'engineer@harness.dev' },
    update: {},
    create: {
      email: 'engineer@harness.dev',
      password: engPassword,
      name: '\u6210\u672c\u5de5\u7a0b\u5e08',
      role: 'ENGINEER',
    },
  });
  console.log(`  \u2705 Engineer user: ${engineer.email} (password: eng123)`);

  // 3. Create G281 demo project
  const costRates = {
    laborRate: 35,
    mfgRate: 46.69,
    wasteRate: 0.01,
    mgmtRate: 0.06,
    profitRate: 0.056627,
  };
  const metalPrices = {
    copper: 72.5,
    aluminum: 20.8,
  };
  const volumes = {
    years: [2025, 2026, 2027, 2028, 2029, 2030, 2031],
    annual: [8000, 50000, 80000, 80000, 60000, 40000, 20000],
  };

  const project = await prisma.project.upsert({
    where: { projectCode: 'G281' },
    update: {
      customer: '\u5409\u5229\u6c7d\u8f66',
      platform: 'SEA',
      status: 'active',
      costRates: JSON.stringify(costRates),
      metalPrices: JSON.stringify(metalPrices),
      volumes: JSON.stringify(volumes),
      createdBy: admin.id,
    },
    create: {
      projectCode: 'G281',
      projectName: 'G281\u9ad8\u538b\u7ebf\u675f\u9879\u76ee',
      customer: '\u5409\u5229\u6c7d\u8f66',
      platform: 'SEA',
      status: 'active',
      costRates: JSON.stringify(costRates),
      metalPrices: JSON.stringify(metalPrices),
      volumes: JSON.stringify(volumes),
      createdBy: admin.id,
    },
  });
  console.log(`  \u2705 Project: ${project.projectCode} \u2014 ${project.projectName}`);

  // 4. Create 2 sample harnesses
  const sampleHarnesses = [
    {
      harnessId: '6608442966',
      harnessName: '\u7535\u6c60\u5305\u6b63\u6781\u7ebf\u675f',
      input: {
        copperWeight: 0.842,
        aluminumWeight: 0,
        materialCost: 134.52,
        processHours: 0.0833,
        innerPack: 1.2,
        outerPack: 0.8,
        freight: 2.5,
        vehicleRatio: 1.0,
      },
    },
    {
      harnessId: '6608442967',
      harnessName: '\u7535\u6c60\u5305\u8d1f\u6781\u7ebf\u675f',
      input: {
        copperWeight: 0.756,
        aluminumWeight: 0,
        materialCost: 121.88,
        processHours: 0.075,
        innerPack: 1.1,
        outerPack: 0.7,
        freight: 2.3,
        vehicleRatio: 1.0,
      },
    },
  ];

  for (const h of sampleHarnesses) {
    await prisma.harness.upsert({
      where: {
        projectId_harnessId: {
          projectId: project.id,
          harnessId: h.harnessId,
        },
      },
      update: {},
      create: {
        projectId: project.id,
        harnessId: h.harnessId,
        harnessName: h.harnessName,
        input: JSON.stringify(h.input),
      },
    });
    console.log(`  \u2705 Harness: ${h.harnessId} \u2014 ${h.harnessName}`);
  }

  const scenario = await prisma.scenario.upsert({
    where: { id: 'seed-g281-scenario-initial' },
    update: {
      projectId: project.id,
      name: 'G281 \u521d\u59cb\u62a5\u4ef7\u573a\u666f',
      type: 'initial_quote',
      status: 'released',
      lifecycleYears: 7,
      volume: 8000,
      installRatio: 1,
    },
    create: {
      id: 'seed-g281-scenario-initial',
      projectId: project.id,
      name: 'G281 \u521d\u59cb\u62a5\u4ef7\u573a\u666f',
      type: 'initial_quote',
      status: 'released',
      lifecycleYears: 7,
      volume: 8000,
      installRatio: 1,
      rateSnapshot: JSON.stringify(costRates),
      quoteParamSnapshot: JSON.stringify({ metalPrices }),
      createdBy: admin.id,
    },
  });
  console.log(`  \u2705 Scenario: ${scenario.name}`);

  const alertRule = await prisma.alertRule.upsert({
    where: { id: 'seed-alert-rule-metal' },
    update: {
      name: '\u94dc\u4ef7\u6ce2\u52a8\u9884\u8b66',
      category: 'metal_price',
      severity: 'critical',
      enabled: true,
      description: '\u94dc\u4ef7\u6ce2\u52a8\u8d85\u8fc7\u9608\u503c\u65f6\u89e6\u53d1',
      condition: JSON.stringify({ metric: 'copper_delta_pct', operator: 'gte', threshold: 5, unit: '%' }),
      createdBy: admin.id,
    },
    create: {
      id: 'seed-alert-rule-metal',
      name: '\u94dc\u4ef7\u6ce2\u52a8\u9884\u8b66',
      category: 'metal_price',
      severity: 'critical',
      enabled: true,
      description: '\u94dc\u4ef7\u6ce2\u52a8\u8d85\u8fc7\u9608\u503c\u65f6\u89e6\u53d1',
      condition: JSON.stringify({ metric: 'copper_delta_pct', operator: 'gte', threshold: 5, unit: '%' }),
      createdBy: admin.id,
    },
  });
  console.log(`  \u2705 Alert rule: ${alertRule.name}`);

  const alertEvents = [
    {
      id: 'seed-alert-metal-price',
      title: '\u94dc\u4ef7\u4e0a\u6da8\u8d85\u9608\u503c',
      category: 'metal_price',
      severity: 'critical',
      status: 'active',
      detail: '\u5f53\u524d\u94dc\u4ef7\u8f83\u57fa\u51c6\u4e0a\u6da8 8.5%\uff0c\u5efa\u8bae\u590d\u6838\u62a5\u4ef7\u4e0e\u91d1\u5c5e\u8054\u52a8\u3002',
      impactAmount: 12800,
      sourceObjectType: 'project',
      sourceObjectId: project.id,
      ruleId: alertRule.id,
      metadata: { deltaPct: 8.5, metal: 'copper' },
    },
    {
      id: 'seed-alert-recovery-delay',
      title: '\u5206\u644a\u56de\u6536\u6ede\u540e',
      category: 'allocation_recovery',
      severity: 'warning',
      status: 'acknowledged',
      detail: '\u5de5\u88c5\u8d39\u56de\u6536\u8fdb\u5ea6\u4f4e\u4e8e\u8ba1\u5212 12%\uff0c\u9700\u8ddf\u8fdb\u88c5\u8f66\u91cf\u4e0e\u5355\u6839\u56de\u6536\u3002',
      impactAmount: 5600,
      sourceObjectType: 'scenario',
      sourceObjectId: scenario.id,
      ruleId: null,
      metadata: { lagPercent: 12, harnessId: '6608442966' },
    },
    {
      id: 'seed-alert-cost-anomaly',
      title: '\u7ebf\u675f\u6210\u672c\u5f02\u5e38\u504f\u9ad8',
      category: 'cost_anomaly',
      severity: 'warning',
      status: 'resolved',
      detail: '\u8fde\u63a5\u5668\u66ff\u6362\u5bfc\u81f4\u5355\u8f66\u6210\u672c\u589e\u52a0 15.2 \u5143\uff0c\u5df2\u5b8c\u6210\u590d\u6838\u3002',
      impactAmount: 1520,
      sourceObjectType: 'harness',
      sourceObjectId: '6608442967',
      ruleId: null,
      metadata: { harnessId: '6608442967', deltaPerVehicle: 15.2 },
    },
  ];

  for (const event of alertEvents) {
    await prisma.alertEvent.upsert({
      where: { id: event.id },
      update: {
        projectId: project.id,
        scenarioId: scenario.id,
        ruleId: event.ruleId,
        category: event.category,
        severity: event.severity,
        status: event.status,
        title: event.title,
        detail: event.detail,
        sourceObjectType: event.sourceObjectType,
        sourceObjectId: event.sourceObjectId,
        impactAmount: event.impactAmount,
        metadata: JSON.stringify(event.metadata),
      },
      create: {
        id: event.id,
        projectId: project.id,
        scenarioId: scenario.id,
        ruleId: event.ruleId,
        category: event.category,
        severity: event.severity,
        status: event.status,
        title: event.title,
        detail: event.detail,
        sourceObjectType: event.sourceObjectType,
        sourceObjectId: event.sourceObjectId,
        impactAmount: event.impactAmount,
        metadata: JSON.stringify(event.metadata),
      },
    });
    console.log(`  \u2705 Alert event: ${event.title}`);
  }

  console.log('\n\u{1F389} Seed complete!\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
