import { notFound } from 'next/navigation';
import { prisma } from '@/shared/api/db';

export async function getCampaigns() {
  return prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: { players: { orderBy: { turnOrder: 'asc' } }, map: true },
  });
}

export async function getCampaignById(id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      players: { orderBy: { turnOrder: 'asc' } },
      map: { include: { hexes: { include: { owner: true } } } },
      turns: { orderBy: { turnNumber: 'desc' }, take: 1 },
    },
  });

  if (!campaign) {
    notFound();
  }

  return campaign;
}
