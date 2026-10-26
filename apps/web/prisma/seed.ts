import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { hexesInRadius } from '@/shared/lib/hex-grid';

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./dev.db' });

const prisma = new PrismaClient({ adapter });

async function main() {
  for (const { q, r } of hexesInRadius(3)) {
    await prisma.hex.upsert({
      where: { q_r: { q, r } },
      update: {},
      create: { q, r },
    });
  }
}

main().finally(() => prisma.$disconnect());
