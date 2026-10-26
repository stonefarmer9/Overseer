'use client';

import { useState } from 'react';
import { HexCell, type HexRecord } from '@/entities/hex';
import { getOwner } from '@/entities/owner';
import { AssignOwnerDrawer } from '@/features/assign-hex-owner';
import { hexToPixel, hexCorners } from '@/shared/lib/hex-grid';

const SIZE = 30;

type Props = { hexes: HexRecord[] };

export function HexMap({ hexes: initial }: Props) {
  const [hexes, setHexes] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = hexes.find((hex) => hex.id === selectedId) ?? null;

  const viewBox = computeViewBox(hexes, SIZE);

  if (hexes.length === 0) {
    return <p role="status">No hexes to show yet.</p>;
  }

  return (
    <>
      <svg viewBox={viewBox} className="w-full h-auto">
        {hexes.map((hex) => (
          <HexCell
            key={hex.id}
            hex={hex}
            owner={hex.ownerId ? getOwner(hex.ownerId) : undefined}
            onSelect={setSelectedId}
          />
        ))}
      </svg>
      <AssignOwnerDrawer
        hex={selected}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onAssigned={(hexId, ownerId) =>
          setHexes((prev) => prev.map((hex) => (hex.id === hexId ? { ...hex, ownerId } : hex)))
        }
      />
    </>
  );
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
