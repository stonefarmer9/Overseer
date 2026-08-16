'use client';

import { useMemo, useState } from 'react';
import { PlanetMap, type Player, type HexNode } from '@/widgets/planet-map';
import { CampaignTurnPanel } from '@/features/campaign-turn';
import { AttackHexPanel } from '@/features/attack-hex';

type CampaignData = {
  id: string;
  name: string;
  radius: number;
  players: { id: string; name: string; color: string; turnOrder: number }[];
  map: {
    hexes: { id: string; q: number; r: number; ownerId: string | null }[];
  } | null;
  turns: { id: string; turnNumber: number; status: string; currentPlayerId: string | null }[];
};

export function CampaignView({ campaign }: { campaign: CampaignData }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const players: Player[] = useMemo(
    () => campaign.players.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    [campaign.players]
  );

  const hexes: HexNode[] = useMemo(() => (campaign.map ? campaign.map.hexes : []), [campaign.map]);

  const activeTurn = campaign.turns.find((t) => t.status === 'active');
  const currentPlayerId = activeTurn?.currentPlayerId ?? null;

  const selectedHex = useMemo(
    () => hexes.find((h) => h.id === selectedId) ?? null,
    [hexes, selectedId]
  );

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{campaign.name}</h1>
      </div>

      <CampaignTurnPanel
        campaignId={campaign.id}
        players={players}
        currentPlayerId={currentPlayerId}
        turnNumber={activeTurn?.turnNumber ?? null}
      />

      <PlanetMap
        radius={campaign.radius}
        hexes={hexes}
        players={players}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {activeTurn && currentPlayerId && (
        <AttackHexPanel
          campaignId={campaign.id}
          turnId={activeTurn.id}
          attackerId={currentPlayerId}
          selectedHex={selectedHex}
          onClearSelection={() => setSelectedId(null)}
        />
      )}
    </main>
  );
}
