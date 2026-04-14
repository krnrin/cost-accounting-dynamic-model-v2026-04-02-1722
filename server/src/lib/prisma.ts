import { PrismaClient } from '@prisma/client';

// Singleton PrismaClient instance
const prisma = new PrismaClient();

// P2-#3: Graceful shutdown — close DB connections on process exit
async function gracefulDisconnect() {
  try {
    await prisma.$disconnect();
  } catch (e) {
    console.error('[prisma] disconnect error:', e);
  }
}

process.on('beforeExit', gracefulDisconnect);
process.on('SIGINT', async () => { await gracefulDisconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await gracefulDisconnect(); process.exit(0); });

export default prisma;
