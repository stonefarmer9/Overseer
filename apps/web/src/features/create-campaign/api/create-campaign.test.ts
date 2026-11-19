import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/api/db';
import { createCampaign } from './create-campaign';

jest.mock('@/shared/api/db', () => ({
  prisma: { campaign: { create: jest.fn() } },
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

const mockedCreate = jest.mocked(prisma.campaign.create);

const valid = {
  name: 'Ork Incursion',
  size: 'large',
  attacker: { name: 'Alex', factionId: 'orks' },
  defender: { name: 'Sam', factionId: 'space-marines' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedCreate.mockResolvedValue({ id: 'campaign-1' } as never);
});

it('creates a campaign with two players and a 37 hex board for a large campaign', async () => {
  await createCampaign(valid);

  const data = mockedCreate.mock.calls[0][0].data;
  expect(data.name).toBe('Ork Incursion');
  expect(data.players?.create).toEqual([
    { role: 'attacker', name: 'Alex', factionId: 'orks' },
    { role: 'defender', name: 'Sam', factionId: 'space-marines' },
  ]);
  expect(data.hexes?.create).toHaveLength(37);
});

it('returns the new campaign id', async () => {
  await expect(createCampaign(valid)).resolves.toEqual({ ok: true, campaignId: 'campaign-1' });
});

it('refreshes the layout so the sidebar shows the new campaign', async () => {
  await createCampaign(valid);

  expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
});

it('does not write to the database when the input is invalid', async () => {
  const result = await createCampaign({ ...valid, name: '' });

  expect(result).toEqual({ ok: false, error: 'Campaign name is required' });
  expect(mockedCreate).not.toHaveBeenCalled();
});
