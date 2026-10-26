import { distance, hexCorners, hexesInRadius, hexToPixel, neighbours } from './index';

describe('hex-grid', () => {
  it('returns six distinct neighbours of the origin', () => {
    const n = neighbours({ q: 0, r: 0 });
    const unique = new Set(n.map((h) => `${h.q},${h.r}`));
    expect(unique.size).toBe(6);
  });

  it('measures distance between two hexes', () => {
    expect(distance({ q: 0, r: 0 }, { q: 2, r: -1 })).toBe(2);
  });

  it('builds a radius-3 map with 37 hexes', () => {
    expect(hexesInRadius(3)).toHaveLength(37);
  });

  it('puts the first corner of a flat-top hex on the x-axis', () => {
    const [first] = hexCorners(hexToPixel({ q: 0, r: 0 }, 10), 10);
    expect(first.x).toBeCloseTo(10);
    expect(first.y).toBeCloseTo(0);
  });
});
