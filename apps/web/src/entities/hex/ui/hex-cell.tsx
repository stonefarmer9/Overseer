import { hexCorners, hexToPixel } from '@/shared/lib/hex-grid';
import type { Owner } from '@/entities/owner';
import { HexRecord } from '../model/types';

const SIZE = 30;

type HexCellProps = {
  hex: HexRecord;
  owner?: Owner;
  onSelect: (id: string) => void;
};

export function HexCell({ hex, owner, onSelect }: HexCellProps) {
  const centre = hexToPixel(hex, SIZE);
  const points = hexCorners(centre, SIZE)
    .map((point) => `${point.x}, ${point.y}`)
    .join(' ');

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Hex ${hex.q},${hex.r}`}
      onClick={() => onSelect(hex.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelect(hex.id);
        }
      }}
    >
      <polygon points={points} fill={owner?.colour ?? '#d4d4d8'} stroke="#52525b" />
    </g>
  );
}
