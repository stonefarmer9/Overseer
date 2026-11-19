import { validateCampaign, type CampaignFormInput } from './validate-campaign';

const valid: CampaignFormInput = {
  name: 'Waaagh BOA-field',
  size: 'small',
  attacker: { name: 'Andy ', factionId: 'orks' },
  defender: { name: ' Andy-T', factionId: 'leagues-of-votann' },
};

describe('A campaign is validated at creation', () => {
  it('accepts a complete campaign and trims the names', () => {
    expect(validateCampaign({ ...valid, name: '   Waaagh BOA-field   ' })).toEqual({
      ok: true,
      draft: {
        name: 'Waaagh BOA-field',
        size: 'small',
        attacker: { name: 'Andy', factionId: 'orks' },
        defender: { name: 'Andy-T', factionId: 'leagues-of-votann' },
      },
    });
  });

  it('rejects a campaign with an empty name', () => {
    expect(validateCampaign({ ...valid, name: '   ' })).toEqual({
      ok: false,
      error: 'Campaign name is required',
    });
  });

  it('rejects an unknown size', () => {
    expect(validateCampaign({ ...valid, size: 'gigantic' })).toEqual({
      ok: false,
      error: 'size unknown/unset',
    });
  });

  it('rejects a player without a name', () => {
    expect(validateCampaign({ ...valid, attacker: { name: '', factionId: 'orks' } })).toEqual({
      ok: false,
      error: 'Both players need a name',
    });
  });

  it('rejects a faction that is not in the list', () => {
    expect(
      validateCampaign({ ...valid, defender: { name: 'Sam', factionId: 'not-a-faction' } })
    ).toEqual({ ok: false, error: 'Unknown faction/Faction not selected' });
  });
});
