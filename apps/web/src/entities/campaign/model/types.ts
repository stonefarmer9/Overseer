export type CampaignSummary = { id: string; name: string };

export type PlayerRecord = {
  id: string;
  role: string;
  name: string;
  factionId: string;
};

export type CampaignHexRecord = {
  id: string;
  q: number;
  r: number;
  ownerId: string | null;
};

export type CampaignDetail = {
  id: string;
  name: string;
  size: string;
  players: PlayerRecord[];
  hexes: CampaignHexRecord[];
};
