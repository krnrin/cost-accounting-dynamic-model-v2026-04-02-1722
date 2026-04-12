import { PrismaClient } from '@prisma/client';
// Singleton PrismaClient instance
const prisma = new PrismaClient();
export default prisma;
