export type HexCoord = {
  q: number;
  r: number;
};

const HEX_DIRECTIONS: ReadonlyArray<HexCoord> = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexAdd(a: HexCoord, b: HexCoord): HexCoord {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -dq - dr;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

export function hexNeighbors(h: HexCoord): HexCoord[] {
  return HEX_DIRECTIONS.map((dir) => hexAdd(h, dir));
}

export function hexInRadius(h: HexCoord, radius: number): boolean {
  return hexDistance(h, { q: 0, r: 0 }) <= radius;
}

export function hexesInRadius(radius: number): HexCoord[] {
  const result: HexCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const s = -q - r;
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= radius) {
        result.push({ q: q + 0, r: r + 0 });
      }
    }
  }
  return result;
}

export type HexLayout = {
  size: number;
  originX: number;
  originY: number;
};

export type HexPoint = {
  x: number;
  y: number;
};

export function hexToPixel(h: HexCoord, layout: HexLayout): HexPoint {
  const { size, originX, originY } = layout;
  // pointy-top hex layout
  const x = size * (Math.sqrt(3) * h.q + (Math.sqrt(3) / 2) * h.r);
  const y = size * ((3 / 2) * h.r);
  return { x: x + originX, y: y + originY };
}

export function hexCorners(center: HexPoint, size: number): HexPoint[] {
  const corners: HexPoint[] = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30;
    const angleRad = (Math.PI / 180) * angleDeg;
    corners.push({
      x: center.x + size * Math.cos(angleRad),
      y: center.y + size * Math.sin(angleRad),
    });
  }
  return corners;
}

export function hexKey(h: HexCoord): string {
  return `${h.q},${h.r}`;
}
