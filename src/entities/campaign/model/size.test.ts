import { radiusFor } from './size';
import { hexesInRadius } from '@/shared/lib/hex-grid';
describe('It draws the right size map dependant on size', () => {
  test('It returns 7 hexes for small', () => {
    expect(hexesInRadius(radiusFor('small')).length).toEqual(7);
  });
  test('It returns 19 hexes for medium', () => {
    expect(hexesInRadius(radiusFor('medium')).length).toEqual(19);
  });
  test('It returns 37 hexes for large', () => {
    expect(hexesInRadius(radiusFor('large')).length).toEqual(37);
  });
  test('It returns 61 hexes for huge', () => {
    expect(hexesInRadius(radiusFor('huge')).length).toEqual(61);
  });
});
