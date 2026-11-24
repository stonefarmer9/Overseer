import { CAMPAIGN_SIZES, type CampaignSize } from '@/entities/campaign';
import { parseFactionId, type FactionId } from '@/entities/factions';

type PlayerInput = { name?: unknown; factionId?: unknown };

export type CampaignFormInput = {
  name?: unknown;
  size?: unknown;
  attacker?: PlayerInput;
  defender?: PlayerInput;
};

export type CampaignDraft = {
  name: string;
  size: CampaignSize;
  attacker: { name: string; factionId: FactionId };
  defender: { name: string; factionId: FactionId };
};

export type ValidationResult = { ok: true; draft: CampaignDraft } | { ok: false; error: string };

type PlayerResult = { ok: true; player: CampaignDraft['attacker'] } | { ok: false; error: string };

function validatePlayer(playerInput: PlayerInput | undefined): PlayerResult {
  const name = typeof playerInput?.name === 'string' ? playerInput.name.trim() : '';
  if (!name) return { ok: false, error: 'Both players need a name' };

  const factionId = parseFactionId(playerInput?.factionId);
  if (!factionId) return { ok: false, error: 'Unknown faction/Faction not selected' };

  return { ok: true, player: { name, factionId } };
}

export function validateCampaign(input: CampaignFormInput): ValidationResult {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) return { ok: false, error: 'Campaign name is required' };

  const size = CAMPAIGN_SIZES.find((size) => size === input.size);
  if (!size) return { ok: false, error: 'size unknown/unset' };

  const attacker = validatePlayer(input.attacker);
  if (!attacker.ok) return attacker;

  const defender = validatePlayer(input.defender);
  if (!defender.ok) return defender;

  return {
    ok: true,
    draft: { name, size, attacker: attacker.player, defender: defender.player },
  };
}
