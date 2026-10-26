import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { HexCell } from './hex-cell';

const hex = { id: 'a', q: 0, r: 0, ownerId: null };

function renderCell(ui: ReactElement) {
  return render(<svg>{ui}</svg>);
}

it('calls onSelect when the hex is clicked', async () => {
  const onSelect = jest.fn();
  renderCell(<HexCell hex={hex} onSelect={onSelect} />);

  await userEvent.click(screen.getByRole('button', { name: 'Hex 0,0' }));

  expect(onSelect).toHaveBeenCalledWith('a');
});

it('fills the hex with the owner colour', () => {
  const { container } = renderCell(
    <HexCell hex={hex} owner={{ id: 'red', name: 'Red', colour: '#dc2626' }} onSelect={() => {}} />
  );

  expect(container.querySelector('polygon')).toHaveAttribute('fill', '#dc2626');
});
