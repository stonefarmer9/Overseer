import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PlayerRecord } from '@/entities/campaign';
import { assignHexOwner } from '../api/assign-hex-owner';
import { AssignOwnerDrawer } from './assign-owner-drawer';

jest.mock('../api/assign-hex-owner', () => ({
  assignHexOwner: jest.fn(),
}));

const mockedAssign = jest.mocked(assignHexOwner);
const hex = { id: 'hex-1', q: 0, r: 0, ownerId: null };
const players: PlayerRecord[] = [
  { id: 'player-attacker', role: 'attacker', name: 'Alex', factionId: 'orks' },
  { id: 'player-defender', role: 'defender', name: 'Sam', factionId: 'space-marines' },
];

function renderDrawer() {
  const onOpenChange = jest.fn();
  const onAssigned = jest.fn();
  render(
    <AssignOwnerDrawer
      hex={hex}
      players={players}
      open
      onOpenChange={onOpenChange}
      onAssigned={onAssigned}
    />
  );
  return { onAssigned };
}

beforeEach(() => {
  mockedAssign.mockReset();
  mockedAssign.mockResolvedValue({ ok: true });
});

it('assigns the chosen player to the hex', async () => {
  const { onAssigned } = renderDrawer();

  await userEvent.click(screen.getByRole('button', { name: 'Orks (Alex)' }));

  expect(mockedAssign).toHaveBeenCalledWith({ hexId: 'hex-1', playerId: 'player-attacker' });
  expect(onAssigned).toHaveBeenCalledWith('hex-1', 'player-attacker');
});

it('clears the owner when Clear owner is chosen', async () => {
  const { onAssigned } = renderDrawer();

  await userEvent.click(screen.getByRole('button', { name: 'Clear owner' }));

  expect(mockedAssign).toHaveBeenCalledWith({ hexId: 'hex-1', playerId: null });
  expect(onAssigned).toHaveBeenCalledWith('hex-1', null);
});

it('shows an error message when the assignment fails', async () => {
  mockedAssign.mockResolvedValue({ ok: false, error: 'Hex not found' });
  const { onAssigned } = renderDrawer();

  await userEvent.click(screen.getByRole('button', { name: 'Space Marines (Sam)' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Hex not found');
  expect(onAssigned).not.toHaveBeenCalled();
});
