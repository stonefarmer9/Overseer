import { parseFactionId, getFaction } from './model/factions';

export function getFactionName(raw: string): string {
  const factionId = parseFactionId(raw);
  return factionId ? getFaction(factionId).name : 'Unknown faction';
}
