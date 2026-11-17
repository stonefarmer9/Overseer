export type FactionColours = { readonly primary: string; readonly secondary?: string };

export type Faction = {
  readonly id: string;
  readonly name: string;
  readonly colours: FactionColours;
};

export type FactionGroup = {
  readonly name: string;
  readonly factions: readonly Faction[];
};

export const FACTION_GROUPS = [
  {
    name: 'The Imperium of Man',
    factions: [
      { id: 'space-marines', name: 'Space Marines', colours: { primary: '#0047AB' } },
      { id: 'blood-angels', name: 'Blood Angels', colours: { primary: '#DC2626' } },
      { id: 'dark-angels', name: 'Dark Angels', colours: { primary: '#14532D' } },
      { id: 'space-wolves', name: 'Space Wolves', colours: { primary: '#6B7B8C' } },
      {
        id: 'black-templars',
        name: 'Black Templars',
        colours: { primary: '#000000', secondary: '#FFFFFF' },
      },
      {
        id: 'deathwatch',
        name: 'Deathwatch',
        colours: { primary: '#000000', secondary: '#DC2626' },
      },
      { id: 'grey-knights', name: 'Grey Knights', colours: { primary: '#C0C0C0' } },
      { id: 'astra-militarum', name: 'Astra Militarum', colours: { primary: '#808000' } },
      {
        id: 'adepta-sororitas',
        name: 'Adepta Sororitas',
        colours: { primary: '#FFFFFF', secondary: '#DC2626' },
      },
      { id: 'adeptus-mechanicus', name: 'Adeptus Mechanicus', colours: { primary: '#7F1D1D' } },
      { id: 'adeptus-custodes', name: 'Adeptus Custodes', colours: { primary: '#D4AF37' } },
      { id: 'imperial-knights', name: 'Imperial Knights', colours: { primary: '#1D4ED8' } },
      { id: 'imperial-agents', name: 'Imperial Agents', colours: { primary: '#FACC15' } },
    ],
  },
  {
    name: 'Chaos',
    factions: [
      {
        id: 'chaos-space-marines',
        name: 'Chaos Space Marines',
        colours: { primary: '#000000', secondary: '#D4AF37' },
      },
      { id: 'world-eaters', name: 'World Eaters', colours: { primary: '#8B0000' } },
      { id: 'thousand-sons', name: 'Thousand Sons', colours: { primary: '#1E90FF' } },
      { id: 'death-guard', name: 'Death Guard', colours: { primary: '#7C9A3B' } },
      { id: 'emperors-children', name: "Emperor's Children", colours: { primary: '#F472B6' } },
      { id: 'chaos-daemons', name: 'Chaos Daemons', colours: { primary: '#7E22CE' } },
      { id: 'chaos-knights', name: 'Chaos Knights', colours: { primary: '#0B1F3A' } },
    ],
  },
  {
    name: 'Xenos',
    factions: [
      { id: 'tyranids', name: 'Tyranids', colours: { primary: '#E8A87C' } },
      { id: 'orks', name: 'Orks', colours: { primary: '#22C55E' } },
      { id: 'necrons', name: 'Necrons', colours: { primary: '#0F3D2E' } },
      { id: 'aeldari', name: 'Aeldari', colours: { primary: '#FDE047' } },
      { id: 'drukhari', name: 'Drukhari', colours: { primary: '#14B8A6' } },
      { id: 'tau-empire', name: "T'au Empire", colours: { primary: '#F97316' } },
      { id: 'genestealer-cults', name: 'Genestealer Cults', colours: { primary: '#C084C8' } },
      { id: 'leagues-of-votann', name: 'Leagues of Votann', colours: { primary: '#4C1D95' } },
    ],
  },
] as const satisfies readonly FactionGroup[];

export type FactionId = (typeof FACTION_GROUPS)[number]['factions'][number]['id'];

type FactionEntry = (typeof FACTION_GROUPS)[number]['factions'][number];

export const FACTIONS: readonly FactionEntry[] = FACTION_GROUPS.reduce<FactionEntry[]>(
  (all, group) => [...all, ...group.factions],
  []
);
const FACTIONS_BY_ID = Object.fromEntries(
  FACTIONS.map((faction) => [faction.id, faction] as const)
) as Record<FactionId, Faction>;

export function getFaction(id: FactionId): Faction {
  return FACTIONS_BY_ID[id];
}

function isFactionId(value: unknown): value is FactionId {
  return typeof value === 'string' && Object.hasOwn(FACTIONS_BY_ID, value);
}

export function parseFactionId(raw: unknown): FactionId | null {
  return isFactionId(raw) ? raw : null;
}
