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
    update: {},
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
