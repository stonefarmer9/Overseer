import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerFields, type PlayerFieldsProps } from './player-fields';

const emptyValue: PlayerFieldsProps['value'] = { name: '', factionId: '' };

function renderFields(overrides: Partial<PlayerFieldsProps> = {}) {
  const onChange = jest.fn();
  render(<PlayerFields role="attacker" value={emptyValue} onChange={onChange} {...overrides} />);
  return { onChange };
}

it('labels the fields with the role', () => {
  renderFields({ role: 'defender' });

  expect(screen.getByRole('group', { name: 'Defender' })).toBeInTheDocument();
  expect(screen.getByLabelText('Defender')).toBeInTheDocument();
  expect(screen.getByLabelText('Defender faction')).toBeInTheDocument();
});

it('groups factions under Imperium, Chaos, and Xenos', async () => {
  renderFields();

  await userEvent.click(screen.getByLabelText('Attacker faction'));
  const list = await screen.findByRole('listbox');

  expect(within(list).getByRole('group', { name: 'The Imperium of Man' })).toHaveTextContent(
    'Space Marines'
  );
  expect(within(list).getByRole('group', { name: 'Chaos' })).toHaveTextContent(
    'Chaos Space Marines'
  );
  expect(within(list).getByRole('group', { name: 'Xenos' })).toHaveTextContent('Orks');
});
