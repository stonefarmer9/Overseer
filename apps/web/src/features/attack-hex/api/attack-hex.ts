'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/api/db';

export type RecordAttackInput = {
  campaignId: string;
  turnId: string;
  attackerId: string;
  fromHexId: string | null;
  toHexId: string;
  outcome: 'attacker' | 'defender';
};

export async function recordAttackOutcome(input: RecordAttackInput) {
  const targetHex = await prisma.hex.findUnique({ where: { id: input.toHexId } });
  if (!targetHex) {
    throw new Error('Target hex not found');
  }

  const turn = await prisma.campaignTurn.findUnique({ where: { id: input.turnId } });
  if (!turn) {
    throw new Error('Active turn not found');
  }

  const defenderId = targetHex.ownerId;

  const attack = await prisma.attack.create({
    data: {
      turnId: input.turnId,
      attackerId: input.attackerId,
      fromHexId: input.fromHexId,
      toHexId: input.toHexId,
      outcome: input.outcome,
      defenderId,
    },
  });

  // If the attacker won, flip ownership of the target hex.
  if (input.outcome === 'attacker') {
    await prisma.hex.update({
      where: { id: input.toHexId },
      data: { ownerId: input.attackerId },
    });
  }

  revalidatePath(`/campaigns/${input.campaignId}`);
  return { attackId: attack.id };
}
