'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/api/db';

export async function startCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { players: { orderBy: { turnOrder: 'asc' } }, turns: true },
  });

  if (!campaign || campaign.players.length === 0) {
    throw new Error('Campaign has no players');
  }

  const existingActive = campaign.turns.find((t) => t.status === 'active');
  if (existingActive) {
    return { turnId: existingActive.id };
  }

  const turn = await prisma.campaignTurn.create({
    data: {
      campaignId,
      turnNumber: 1,
      status: 'active',
      currentPlayerId: campaign.players[0].id,
    },
  });

  revalidatePath(`/campaigns/${campaignId}`);
  return { turnId: turn.id };
}

export async function advanceTurn(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      players: { orderBy: { turnOrder: 'asc' } },
      turns: { orderBy: { turnNumber: 'desc' } },
    },
  });

  if (!campaign || campaign.players.length === 0) {
    throw new Error('Campaign not found');
  }

  const activeTurn = campaign.turns.find((t) => t.status === 'active');
  if (!activeTurn || !activeTurn.currentPlayerId) {
    throw new Error('No active turn');
  }

  const currentIndex = campaign.players.findIndex((p) => p.id === activeTurn.currentPlayerId);
  const nextPlayer = campaign.players[(currentIndex + 1) % campaign.players.length];

  // When we wrap around to the first player, it's a new round.
  if (nextPlayer.turnOrder === 0) {
    await prisma.campaignTurn.update({
      where: { id: activeTurn.id },
      data: { status: 'completed' },
    });
    const next = await prisma.campaignTurn.create({
      data: {
        campaignId,
        turnNumber: activeTurn.turnNumber + 1,
        status: 'active',
        currentPlayerId: nextPlayer.id,
      },
    });
    revalidatePath(`/campaigns/${campaignId}`);
    return { turnNumber: next.turnNumber, currentPlayerId: nextPlayer.id };
  }

  await prisma.campaignTurn.update({
    where: { id: activeTurn.id },
    data: { currentPlayerId: nextPlayer.id },
  });

  revalidatePath(`/campaigns/${campaignId}`);
  return { turnNumber: activeTurn.turnNumber, currentPlayerId: nextPlayer.id };
}
