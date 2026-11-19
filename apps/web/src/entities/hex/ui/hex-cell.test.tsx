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

it('fills the hex with the primary colour and outlines it with the secondary colour', () => {
  const { container } = renderCell(
    <HexCell hex={hex} fill="#000000" stroke="#D4AF37" strokeWidth={3} onSelect={() => {}} />
  );

  const polygon = container.querySelector('polygon');
  expect(polygon).toHaveAttribute('fill', '#000000');
  expect(polygon).toHaveAttribute('stroke', '#D4AF37');
  expect(polygon).toHaveAttribute('stroke-width', '3');
});

it('uses the neutral colours when no faction colour is given', () => {
  const { container } = renderCell(<HexCell hex={hex} onSelect={() => {}} />);

  const polygon = container.querySelector('polygon');
  expect(polygon).toHaveAttribute('fill', '#d4d4d4');
  expect(polygon).toHaveAttribute('stroke', '#52525b');
});
