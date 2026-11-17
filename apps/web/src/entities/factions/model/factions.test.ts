import { FACTIONS, FACTION_GROUPS, getFaction, parseFactionId } from './factions';

describe('getFaction', () => {
  it('returns the faction for a valid id', () => {
    expect(getFaction('orks').name).toBe('Orks');
  });
});

describe('parseFactionId', () => {
  it('returns the id when it is a known faction', () => {
    expect(parseFactionId('orks')).toBe('orks');
  });

  it('returns null for an unknown id', () => {
    expect(parseFactionId('not-a-faction')).toBeNull();
  });

  it('returns null for inherited object keys and non-strings', () => {
    expect(parseFactionId('toString')).toBeNull();
    expect(parseFactionId(undefined)).toBeNull();
    expect(parseFactionId(42)).toBeNull();
  });
});

describe('faction data', () => {
  it('has 28 factions with unique ids', () => {
    const ids = FACTIONS.map((faction) => faction.id);
    expect(ids).toHaveLength(28);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has 13 Imperium, 7 Chaos and 8 Xenos factions', () => {
    expect(FACTION_GROUPS.map((group) => group.factions.length)).toEqual([13, 7, 8]);
  });

  it('gives every faction a retrievable entry', () => {
    for (const faction of FACTIONS) {
      expect(getFaction(faction.id)).toBe(faction);
    }
  });
});
