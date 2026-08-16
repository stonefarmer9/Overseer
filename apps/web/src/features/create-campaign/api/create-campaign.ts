'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/api/db';
import { hexesInRadius } from '@shared/lib/hex';

const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];

export type CreateCampaignInput = {
  name: string;
  radius: number;
  players: string[];
};

export async function createCampaign(input: CreateCampaignInput) {
  const name = input.name.trim();
  const radius = Math.max(0, Math.min(20, Math.floor(input.radius) || 3));
  const playerNames = input.players
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 6);

  if (!name) {
    throw new Error('Campaign name is required');
  }
  if (playerNames.length < 2) {
    throw new Error('At least two players are required');
  }

  const map = await prisma.planetMap.create({
    data: {
      campaign: {
        create: {
          name,
          radius,
          players: {
            create: playerNames.map((playerName, i) => ({
              name: playerName,
              color: PLAYER_COLORS[i % PLAYER_COLORS.length],
              turnOrder: i,
            })),
          },
        },
      },
      hexes: {
        create: hexesInRadius(radius).map((h) => ({ q: h.q, r: h.r })),
      },
    },
  });

  revalidatePath('/');
  return { id: map.campaignId };
}
