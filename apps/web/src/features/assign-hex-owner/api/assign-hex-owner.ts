'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/api/db';

type AssignInput = { hexId: string; playerId: string | null };
type AssignResult = { ok: true } | { ok: false; error: string };

export async function assignHexOwner(input: AssignInput): Promise<AssignResult> {
  if (!input.hexId) {
    return { ok: false, error: 'Missing Hex Id' };
  }

  const hex = await prisma.hex.findUnique({
    where: { id: input.hexId },
    select: { campaignId: true },
  });

  if (!hex) {
    return { ok: false, error: 'Hex not found' };
  }

  if (input.playerId !== null) {
    const player = await prisma.player.findUnique({
      where: { id: input.playerId },
      select: { campaignId: true },
    });
    if (!player || player.campaignId !== hex.campaignId) {
      return { ok: false, error: 'Player is not in this campaign' };
    }
  }

  await prisma.hex.update({
    where: { id: input.hexId },
    data: { ownerId: input.playerId },
  });
  revalidatePath(`/campaigns/${hex.campaignId}`);
  return { ok: true };
}
