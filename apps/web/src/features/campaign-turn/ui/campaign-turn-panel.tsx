'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button } from '@warmaster/ui';
import { startCampaign, advanceTurn } from '../api/campaign-turn';

type Player = {
  id: string;
  name: string;
  color: string;
};

type CampaignTurnPanelProps = {
  campaignId: string;
  players: Player[];
  currentPlayerId: string | null;
  turnNumber: number | null;
};

export function CampaignTurnPanel({
  campaignId,
  players,
  currentPlayerId,
  turnNumber,
}: CampaignTurnPanelProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const hasActiveTurn = Boolean(currentPlayerId);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setPending(true);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {hasActiveTurn ? `Turn ${turnNumber ?? '-'}` : 'Campaign not started'}
        </span>
        {currentPlayer && (
          <Badge variant="outline" className="gap-1">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: currentPlayer.color }}
            />
            {currentPlayer.name}&apos;s turn
          </Badge>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!hasActiveTurn ? (
        <Button onClick={() => run(() => startCampaign(campaignId))} disabled={pending}>
          Start campaign
        </Button>
      ) : (
        <Button
          variant="secondary"
          onClick={() => run(() => advanceTurn(campaignId))}
          disabled={pending}
        >
          End turn
        </Button>
      )}
    </div>
  );
}
