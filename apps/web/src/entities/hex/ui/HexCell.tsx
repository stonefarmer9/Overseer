import { hexCorners, hexToPixel, type HexCoord, type HexLayout } from '@shared/lib/hex';

type HexCellProps = {
  coord: HexCoord;
  layout: HexLayout;
  color?: string;
  selected?: boolean;
  interactive?: boolean;
  onClick?: () => void;
};

export function HexCell({ coord, layout, color, selected, interactive, onClick }: HexCellProps) {
  const center = hexToPixel(coord, layout);
  const points = hexCorners(center, layout.size)
    .map((p) => `${p.x},${p.y}`)
    .join(' ');

  return (
    <polygon
      points={points}
      fill={color ?? '#e2e8f0'}
      stroke={selected ? '#2563eb' : '#94a3b8'}
      strokeWidth={selected ? 3 : 1}
      style={{
        cursor: interactive ? 'pointer' : 'default',
        transition: 'fill 150ms',
      }}
      onClick={onClick}
      data-testid="hex"
      aria-label={`hex ${coord.q},${coord.r}`}
      role={interactive ? 'button' : undefined}
    />
  );
}
