import { hexCorners, hexToPixel } from '@/shared/lib/hex-grid';
import { HexRecord } from '../model/types';

const SIZE = 30;

type HexCellProps = {
  hex: HexRecord;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  onSelect: (id: string) => void;
};

export function HexCell({
  hex,
  fill = '#d4d4d4',
  stroke = '#52525b',
  strokeWidth = 1,
  onSelect,
}: HexCellProps) {
  const centre = hexToPixel(hex, SIZE);
  const points = hexCorners(centre, SIZE)
    .map((point) => `${point.x}, ${point.y}`)
    .join(' ');

  return (
    <g
      role="button"
      tabIndex={0}
      className="cursor-pointer outline-none focus-visible:[&>polygon]:stroke-3 focus-visible:[&>polygon]:stroke-blue-600"
      aria-label={`Hex ${hex.q},${hex.r}`}
      onClick={() => onSelect(hex.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelect(hex.id);
        }
      }}
    >
      <polygon points={points} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
    </g>
  );
}
