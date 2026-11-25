import { prisma } from '@/shared/api/db';
import { getCampaign, listCampaigns } from './campaign-queries';

jest.mock('server-only', () => ({}));

jest.mock('@/shared/api/db', () => ({
  prisma: { campaign: { findMany: jest.fn(), findUnique: jest.fn() } },
}));

const mockedFindMany = jest.mocked(prisma.campaign.findMany);
const mockedFindUnique = jest.mocked(prisma.campaign.findUnique);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('listCampaigns', () => {
  it('returns the campaigns found by Prisma', async () => {
    const rows = [
      { id: 'c1', name: 'Ork Incursion' },
      { id: 'c2', name: 'Siege of Vraks' },
    ];
    mockedFindMany.mockResolvedValue(rows as never);

    await expect(listCampaigns()).resolves.toEqual(rows);
  });

  it('selects only id and name, oldest campaign first', async () => {
    mockedFindMany.mockResolvedValue([] as never);

    await listCampaigns();

    expect(mockedFindMany).toHaveBeenCalledWith({
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('returns an empty list when there are no campaigns', async () => {
    mockedFindMany.mockResolvedValue([] as never);

    await expect(listCampaigns()).resolves.toEqual([]);
  });
});

describe('getCampaign', () => {
  const detail = {
    id: 'c1',
    name: 'Ork Incursion',
    size: 'large',
    players: [
      { id: 'p1', role: 'attacker', name: 'Alex', factionId: 'orks' },
      { id: 'p2', role: 'defender', name: 'Sam', factionId: 'space-marines' },
    ],
    hexes: [{ id: 'h1', q: 0, r: 0, ownerId: 'p1' }],
  };

  it('returns the campaign with its players and hexes', async () => {
    mockedFindUnique.mockResolvedValue(detail as never);

    await expect(getCampaign('c1')).resolves.toEqual(detail);
  });

  it('looks the campaign up by id with players ordered by role and hexes by row then column', async () => {
    mockedFindUnique.mockResolvedValue(detail as never);

    await getCampaign('c1');

    expect(mockedFindUnique).toHaveBeenCalledWith({
      where: { id: 'c1' },
      select: {
        id: true,
        name: true,
        size: true,
        players: {
          select: { id: true, role: true, name: true, factionId: true },
          orderBy: { role: 'asc' },
        },
        hexes: {
          select: { id: true, q: true, r: true, ownerId: true },
          orderBy: [{ r: 'asc' }, { q: 'asc' }],
        },
      },
    });
  });

  it('returns null for an unknown campaign id', async () => {
    mockedFindUnique.mockResolvedValue(null);

    await expect(getCampaign('missing')).resolves.toBeNull();
  });
});
