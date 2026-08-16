'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@warmaster/ui';
import { recordAttackOutcome } from '../api/attack-hex';

type HexNode = {
  id: string;
  q: number;
  r: number;
  ownerId: string | null;
};

type AttackHexPanelProps = {
  campaignId: string;
  turnId: string;
  attackerId: string;
  selectedHex: HexNode | null;
  onClearSelection: () => void;
};

export function AttackHexPanel({
  campaignId,
  turnId,
  attackerId,
  selectedHex,
  onClearSelection,
}: AttackHexPanelProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwnHex = selectedHex?.ownerId === attackerId;

  async function submit(outcome: 'attacker' | 'defender') {
    if (!selectedHex) return;
    setError(null);
    setPending(true);
    try {
      await recordAttackOutcome({
        campaignId,
        turnId,
        attackerId,
        fromHexId: null,
        toHexId: selectedHex.id,
        outcome,
      });
      onClearSelection();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record attack');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <p className="text-sm">
        {selectedHex
          ? isOwnHex
            ? `Selected your hex (${selectedHex.q},${selectedHex.r}).`
            : `Attacking hex (${selectedHex.q},${selectedHex.r}). Select the battle outcome:`
          : 'Select a target hex on the map to attack.'}
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {selectedHex && !isOwnHex && (
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={() => submit('attacker')}>
            Attacker won
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => submit('defender')}
          >
            Defender held
          </Button>
        </div>
      )}
    </div>
  );
}
