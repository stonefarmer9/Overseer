import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { assignHexOwner } from '../api/assign-hex-owner';
import { AssignOwnerDrawer } from './assign-owner-drawer';

jest.mock('../api/assign-hex-owner', () => ({
  assignHexOwner: jest.fn(),
}));

const mockedAssign = jest.mocked(assignHexOwner);
const hex = { id: 'hex-1', q: 0, r: 0, ownerId: null };

function renderDrawer() {
  const onOpenChange = jest.fn();
  const onAssigned = jest.fn();
  render(<AssignOwnerDrawer hex={hex} open onOpenChange={onOpenChange} onAssigned={onAssigned} />);
  return { onOpenChange, onAssigned };
}

beforeEach(() => {
  mockedAssign.mockReset();
  mockedAssign.mockResolvedValue({ ok: true });
});

it('assigns the chosen owner to the hex', async () => {
  const { onAssigned } = renderDrawer();

  await userEvent.click(screen.getByRole('button', { name: 'Red' }));

  expect(mockedAssign).toHaveBeenCalledWith({ hexId: 'hex-1', ownerId: 'red' });
  expect(onAssigned).toHaveBeenCalledWith('hex-1', 'red');
});

it('clears the owner when Clear owner is chosen', async () => {
  const { onAssigned } = renderDrawer();

  await userEvent.click(screen.getByRole('button', { name: 'Clear owner' }));

  expect(mockedAssign).toHaveBeenCalledWith({ hexId: 'hex-1', ownerId: null });
  expect(onAssigned).toHaveBeenCalledWith('hex-1', null);
});

it('shows an error message when the assignment fails', async () => {
  mockedAssign.mockResolvedValue({ ok: false, error: 'Hex not found' });
  const { onAssigned } = renderDrawer();

  await userEvent.click(screen.getByRole('button', { name: 'Blue' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Hex not found');
  expect(onAssigned).not.toHaveBeenCalled();
});
