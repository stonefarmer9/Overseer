'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@shared/api/db';
import { hexesInRadius } from '@/shared/lib/hex-grid';
import { radiusFor } from '@/entities/campaign';
import { validateCampaign, type CampaignFormInput } from '../lib/validate-campaign';

type CreateCampaignResult = { ok: true; campaignId: string } | { ok: false; error: string };

export async function createCampaign(input: CampaignFormInput): Promise<CreateCampaignResult> {
  const result = validateCampaign(input);
  if (!result.ok) return result;

  const { draft } = result;

  const campaign = await prisma.campaign.create({
    data: {
      name: draft.name,
      size: draft.size,
      players: {
        create: [
          { role: 'attacker', name: draft.attacker.name, factionId: draft.attacker.factionId },
          { role: 'defender', name: draft.defender.name, factionId: draft.defender.factionId },
        ],
      },
      hexes: {
        create: hexesInRadius(radiusFor(draft.size)).map(({ q, r }) => ({ q, r })),
      },
    },
  });
  revalidatePath('/', 'layout');
  return { ok: true, campaignId: campaign.id };
}
