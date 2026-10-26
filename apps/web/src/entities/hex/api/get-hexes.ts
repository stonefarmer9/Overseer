import 'server-only';
import { prisma } from '@/shared/api/db';
import type { HexRecord } from '../model/types';

export async function getHexes(): Promise<HexRecord[]> {
  return prisma.hex.findMany({
    select: { id: true, q: true, r: true, ownerId: true },
    orderBy: [{ r: 'asc' }, { q: 'asc' }],
  });
}
