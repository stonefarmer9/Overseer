import 'server-only';
import { prisma } from '@/shared/api/db';
import type { CampaignDetail, CampaignSummary } from '../model/types';

export async function listCampaigns(): Promise<CampaignSummary[]> {
  return prisma.campaign.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getCampaign(id: string): Promise<CampaignDetail | null> {
  return prisma.campaign.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      size: true,
      players: {
        select: { id: true, role: true, name: true, factionId: true },
        orderBy: { role: 'asc' },
      },
      hexes: {
        select: { id: true, q: true, r: true, ownerId: true },
        orderBy: [{ r: 'asc' }, { q: 'asc' }],
      },
    },
  });
}
