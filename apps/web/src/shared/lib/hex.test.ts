import {
  hexesInRadius,
  hexDistance,
  hexNeighbors,
  hexAdd,
  hexToPixel,
  hexCorners,
  hexKey,
} from './hex';

describe('hex math', () => {
  it('hexAdd adds coordinates', () => {
    expect(hexAdd({ q: 1, r: 2 }, { q: -1, r: 3 })).toEqual({ q: 0, r: 5 });
  });

  it('hexDistance computes axial distance', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: 0 })).toBe(3);
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: 2 })).toBe(4);
    expect(hexDistance({ q: 2, r: 2 }, { q: 0, r: 0 })).toBe(4);
  });

  it('hexNeighbors returns six neighbors', () => {
    const neighbors = hexNeighbors({ q: 0, r: 0 });
    expect(neighbors).toHaveLength(6);
    expect(neighbors).toContainEqual({ q: 1, r: 0 });
    expect(neighbors).toContainEqual({ q: 0, r: 1 });
    expect(neighbors).toContainEqual({ q: -1, r: 0 });
  });

  it('hexesInRadius(0) returns a single hex', () => {
    const coords = hexesInRadius(0);
    expect(coords).toHaveLength(1);
    expect(coords[0]).toEqual({ q: 0, r: 0 });
  });

  it('hexesInRadius(1) returns 7 hexes', () => {
    expect(hexesInRadius(1)).toHaveLength(7);
  });

  it('hexesInRadius(3) returns 37 hexes', () => {
    expect(hexesInRadius(3)).toHaveLength(37);
  });

  it('hexesInRadius coordinates are unique', () => {
    const coords = hexesInRadius(3);
    expect(new Set(coords.map(hexKey)).size).toBe(coords.length);
  });

  it('hexToPixel maps origin to origin point', () => {
    const layout = { size: 10, originX: 100, originY: 100 };
    const p = hexToPixel({ q: 0, r: 0 }, layout);
    expect(p).toEqual({ x: 100, y: 100 });
  });

  it('hexCorners returns 6 points', () => {
    expect(hexCorners({ x: 0, y: 0 }, 10)).toHaveLength(6);
  });
});
