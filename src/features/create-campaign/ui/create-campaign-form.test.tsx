import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createCampaign } from '../api/create-campaign';
import { CreateCampaignForm } from './create-campaign-form';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../api/create-campaign', () => ({
  createCampaign: jest.fn(),
}));

const mockedCreate = jest.mocked(createCampaign);

beforeEach(() => {
  mockPush.mockReset();
  mockedCreate.mockReset();
  mockedCreate.mockResolvedValue({ ok: true, campaignId: 'campaign-1' });
});

it('shows an error when the campaign name is empty', async () => {
  mockedCreate.mockResolvedValue({ ok: false, error: 'Campaign name is required' });
  render(<CreateCampaignForm />);

  await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Campaign name is required');
});

it('selects a large board by default', () => {
  render(<CreateCampaignForm />);

  expect(screen.getByLabelText('Campaign size')).toHaveTextContent('Large');
});
