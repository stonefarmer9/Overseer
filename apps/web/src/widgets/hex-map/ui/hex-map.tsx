'use client';

import { useState } from 'react';
import { HexCell, type HexRecord } from '@/entities/hex';
import type { PlayerRecord } from '@/entities/campaign';
import { getFaction, getFactionName, parseFactionId } from '@/entities/factions';

import { AssignOwnerDrawer } from '@/features/assign-hex-owner';
import { hexToPixel, hexCorners } from '@/shared/lib/hex-grid';

const SIZE = 30;

type Props = { hexes: HexRecord[]; players: PlayerRecord[] };

export function HexMap({ hexes: initial, players }: Props) {
  const [hexes, setHexes] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (hexes.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <p role="status" className="text-muted-foreground">
          No hexes to show yet.
        </p>
      </div>
    );
  }

  const selected = hexes.find((hex) => hex.id === selectedId) ?? null;

  const viewBox = computeViewBox(hexes, SIZE);

  return (
    <>
      <div className="h-full w-full p-4">
        <svg viewBox={viewBox} className="h-full w-full">
          {hexes.map((hex) => {
            const colours = coloursFor(hex, players);
            return (
              <HexCell
                key={hex.id}
                hex={hex}
                fill={colours?.primary}
                stroke={colours?.secondary}
                strokeWidth={colours?.secondary ? 3 : undefined}
                onSelect={setSelectedId}
              />
            );
          })}
        </svg>
      </div>
      <AssignOwnerDrawer
        hex={selected}
        players={players}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onAssigned={(hexId, playerId) =>
          setHexes((prev) =>
            prev.map((hex) => (hex.id === hexId ? { ...hex, ownerId: playerId } : hex))
          )
        }
      />
    </>
  );
}

function coloursFor(hex: HexRecord, players: PlayerRecord[]) {
  const player = players.find((candidate) => candidate.id === hex.ownerId);
  const factionId = parseFactionId(player?.factionId);
  return factionId ? getFaction(factionId).colours : undefined;
}

function computeViewBox(hexes: HexRecord[], size: number): string {
  const corners = hexes.flatMap((h) => hexCorners(hexToPixel(h, size), size));
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX;
  const height = Math.max(...ys) - minY;
  return `${minX} ${minY} ${width} ${height}`;
}
