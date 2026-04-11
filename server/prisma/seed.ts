/**
 * Seed script: creates admin user + G281 demo project with 2 harnesses.
 * Run: npx tsx prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@harness.dev' },
    update: {},
    create: {
      email: 'admin@harness.dev',
      password: hashedPassword,
      name: '系统管理员',
      role: 'ADMIN',
    },
  });
  console.log(`  ✅ Admin user: ${admin.email} (password: admin123)`);

  // 2. Create engineer user
  const engPassword = await bcrypt.hash('eng123', 10);
  const engineer = await prisma.user.upsert({
    where: { email: 'engineer@harness.dev' },
    update: {},
    create: {
      email: 'engineer@harness.dev',
      password: engPassword,
      name: '成本工程师',
      role: 'ENGINEER',
    },
  });
  console.log(`  ✅ Engineer user: ${engineer.email} (password: eng123)`);

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
      customer: '吉利汽车',
      platform: 'SEA',
      status: 'active',
      costRates: JSON.stringify(costRates),
      metalPrices: JSON.stringify(metalPrices),
      volumes: JSON.stringify(volumes),
      createdBy: admin.id,
    },
    create: {
      projectCode: 'G281',
      projectName: 'G281高压线束项目',
      customer: '吉利汽车',
      platform: 'SEA',
      status: 'active',
      costRates: JSON.stringify(costRates),
      metalPrices: JSON.stringify(metalPrices),
      volumes: JSON.stringify(volumes),
      createdBy: admin.id,
    },
  });
  console.log(`  ✅ Project: ${project.projectCode} — ${project.projectName}`);

  // 4. Create 2 sample harnesses
  const sampleHarnesses = [
    {
      harnessId: '6608442966',
      harnessName: '电池包正极线束',
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
      harnessName: '电池包负极线束',
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
    console.log(`  ✅ Harness: ${h.harnessId} — ${h.harnessName}`);
  }

  const scenario = await prisma.scenario.upsert({
    where: { id: 'seed-g281-scenario-initial' },
    update: {
      projectId: project.id,
      name: 'G281 初始报价场景',
      type: 'initial_quote',
      status: 'released',
      lifecycleYears: 7,
      volume: 8000,
      installRatio: 1,
    },
    create: {
      id: 'seed-g281-scenario-initial',
      projectId: project.id,
      name: 'G281 初始报价场景',
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
  console.log(`  ✅ Scenario: ${scenario.name}`);

  const alertRule = await prisma.alertRule.upsert({
    where: { id: 'seed-alert-rule-metal' },
    update: {
      name: '铜价波动预警',
      category: 'metal_price',
      severity: 'critical',
      enabled: true,
      description: '铜价波动超过阈值时触发',
      condition: JSON.stringify({ metric: 'copper_delta_pct', operator: 'gte', threshold: 5, unit: '%' }),
      createdBy: admin.id,
    },
    create: {
      id: 'seed-alert-rule-metal',
      name: '铜价波动预警',
      category: 'metal_price',
      severity: 'critical',
      enabled: true,
      description: '铜价波动超过阈值时触发',
      condition: JSON.stringify({ metric: 'copper_delta_pct', operator: 'gte', threshold: 5, unit: '%' }),
      createdBy: admin.id,
    },
  });
  console.log(`  ✅ Alert rule: ${alertRule.name}`);

  const alertEvents = [
    {
      id: 'seed-alert-metal-price',
      title: '铜价上涨超阈值',
      category: 'metal_price',
      severity: 'critical',
      status: 'active',
      detail: '当前铜价较基准上涨 8.5%，建议复核报价与金属联动。',
      impactAmount: 12800,
      sourceObjectType: 'project',
      sourceObjectId: project.id,
      ruleId: alertRule.id,
      metadata: { deltaPct: 8.5, metal: 'copper' },
    },
    {
      id: 'seed-alert-recovery-delay',
      title: '分摊回收滞后',
      category: 'allocation_recovery',
      severity: 'warning',
      status: 'acknowledged',
      detail: '工装费回收进度低于计划 12%，需跟进装车量与单根回收。',
      impactAmount: 5600,
      sourceObjectType: 'scenario',
      sourceObjectId: scenario.id,
      ruleId: null,
      metadata: { lagPercent: 12, harnessId: '6608442966' },
    },
    {
      id: 'seed-alert-cost-anomaly',
      title: '线束成本异常偏高',
      category: 'cost_anomaly',
      severity: 'warning',
      status: 'resolved',
      detail: '连接器替换导致单车成本增加 15.2 元，已完成复核。',
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
    console.log(`  ✅ Alert event: ${event.title}`);
  }

  console.log('\n🎉 Seed complete!\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
