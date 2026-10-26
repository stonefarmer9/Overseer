'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/api/db';
import { getOwner, type OwnerId } from '@/entities/owner';

type AssignInput = { hexId: string; ownerId: OwnerId | null };
type AssignResult = { ok: true } | { ok: false; error: string };

export async function assignHexOwner(input: AssignInput): Promise<AssignResult> {
  if (!input.hexId) {
    return { ok: false, error: 'Missing Hex Id' };
  }
  if (input.ownerId !== null && !getOwner(input.ownerId)) {
    return { ok: false, error: 'Unknown owner' };
  }

  try {
    await prisma.hex.update({
      where: { id: input.hexId },
      data: { ownerId: input.ownerId },
    });
  } catch {
    return { ok: false, error: 'Hex not found' };
  }
  revalidatePath('/map');
  return { ok: true };
}
