import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/api/db';
import { assignHexOwner } from './assign-hex-owner';

jest.mock('@/shared/api/db', () => ({
  prisma: {
    hex: { findUnique: jest.fn(), update: jest.fn() },
    player: { findUnique: jest.fn() },
  },
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

const mockedHexFind = jest.mocked(prisma.hex.findUnique);
const mockedHexUpdate = jest.mocked(prisma.hex.update);
const mockedPlayerFind = jest.mocked(prisma.player.findUnique);

beforeEach(() => {
  jest.clearAllMocks();
  mockedHexFind.mockResolvedValue({ campaignId: 'campaign-1' } as never);
  mockedPlayerFind.mockResolvedValue({ campaignId: 'campaign-1' } as never);
  mockedHexUpdate.mockResolvedValue({} as never);
});

it('rejects an empty hex id without touching the database', async () => {
  const result = await assignHexOwner({ hexId: '', playerId: 'player-1' });

  expect(result).toEqual({ ok: false, error: 'Missing Hex Id' });
  expect(mockedHexFind).not.toHaveBeenCalled();
  expect(mockedHexUpdate).not.toHaveBeenCalled();
});

it('returns an error when the hex does not exist', async () => {
  mockedHexFind.mockResolvedValue(null);

  const result = await assignHexOwner({ hexId: 'unknown', playerId: 'player-1' });

  expect(result).toEqual({ ok: false, error: 'Hex not found' });
  expect(mockedHexUpdate).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});

it('rejects a player from a different campaign and does not update the hex', async () => {
  mockedPlayerFind.mockResolvedValue({ campaignId: 'campaign-2' } as never);

  const result = await assignHexOwner({ hexId: 'hex-1', playerId: 'player-9' });

  expect(result).toEqual({ ok: false, error: 'Player is not in this campaign' });
  expect(mockedHexUpdate).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});

it('rejects an unknown player and does not update the hex', async () => {
  mockedPlayerFind.mockResolvedValue(null);

  const result = await assignHexOwner({ hexId: 'hex-1', playerId: 'ghost' });

  expect(result).toEqual({ ok: false, error: 'Player is not in this campaign' });
  expect(mockedHexUpdate).not.toHaveBeenCalled();
});

it('assigns the owner and refreshes the campaign page when the player is in the same campaign', async () => {
  const result = await assignHexOwner({ hexId: 'hex-1', playerId: 'player-1' });

  expect(result).toEqual({ ok: true });
  expect(mockedPlayerFind).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 'player-1' } })
  );
  expect(mockedHexUpdate).toHaveBeenCalledWith({
    where: { id: 'hex-1' },
    data: { ownerId: 'player-1' },
  });
  expect(revalidatePath).toHaveBeenCalledWith('/campaigns/campaign-1');
});

it('clears the owner without looking up a player when playerId is null', async () => {
  const result = await assignHexOwner({ hexId: 'hex-1', playerId: null });

  expect(result).toEqual({ ok: true });
  expect(mockedPlayerFind).not.toHaveBeenCalled();
  expect(mockedHexUpdate).toHaveBeenCalledWith({
    where: { id: 'hex-1' },
    data: { ownerId: null },
  });
  expect(revalidatePath).toHaveBeenCalledWith('/campaigns/campaign-1');
});
