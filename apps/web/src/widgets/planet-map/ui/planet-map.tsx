'use client';

import { useMemo } from 'react';
import { HexCell, hexKey, hexesInRadius } from '@entities/hex';
import { Badge } from '@warmaster/ui';

export type Player = {
  id: string;
  name: string;
  color: string;
};

export type HexNode = {
  id: string;
  q: number;
  r: number;
  ownerId: string | null;
};

type PlanetMapProps = {
  radius: number;
  hexes: HexNode[];
  players: Player[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

const HEX_SIZE = 28;
const PADDING = 40;

export function PlanetMap({ radius, hexes, players, selectedId, onSelect }: PlanetMapProps) {
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const coords = useMemo(() => hexesInRadius(radius), [radius]);

  const coordHex = useMemo(() => {
    const map = new Map<string, HexNode>();
    for (const h of hexes) map.set(hexKey({ q: h.q, r: h.r }), h);
    return map;
  }, [hexes]);

  const layout = useMemo(() => {
    const center = (radius + 1) * HEX_SIZE;
    return { size: HEX_SIZE, originX: center, originY: center };
  }, [radius]);

  const svgWidth = (radius + 1) * 2 * HEX_SIZE + PADDING;
  const svgHeight = (radius + 1) * 2 * HEX_SIZE + PADDING;

  return (
    <div className="flex flex-col gap-2">
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="max-w-full"
        data-testid="planet-map"
      >
        {coords.map((c) => {
          const hex = coordHex.get(hexKey(c));
          if (!hex) return null;
          const owner = hex.ownerId ? playerById.get(hex.ownerId) : null;
          const isSelected = selectedId === hex.id;
          return (
            <HexCell
              key={hex.id}
              coord={c}
              layout={layout}
              color={owner?.color}
              selected={isSelected}
              interactive
              onClick={() => onSelect(isSelected ? null : hex.id)}
            />
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-2">
        {players.map((p) => (
          <Badge key={p.id} variant="outline" className="gap-1">
            <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}
