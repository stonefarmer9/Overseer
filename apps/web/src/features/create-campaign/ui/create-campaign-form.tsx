'use client';

import { SyntheticEvent, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@warmaster/ui';
import { CAMPAIGN_SIZES, DEFAULT_CAMPAIGN_SIZE, type CampaignSize } from '@/entities/campaign';
import { createCampaign } from '../api/create-campaign';
import { PlayerFields, type PlayerRole, type PlayerState } from './player-fields';

type FormState = {
  name: string;
  size: CampaignSize;
  attacker: PlayerState;
  defender: PlayerState;
};

const EMPTY_PLAYER: PlayerState = { name: '', factionId: '' };

const INITIAL_STATE: FormState = {
  name: '',
  size: DEFAULT_CAMPAIGN_SIZE,
  attacker: EMPTY_PLAYER,
  defender: EMPTY_PLAYER,
};
export function CreateCampaignForm() {
  const router = useRouter();
  const [values, setValues] = useState<FormState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updatePlayer(role: PlayerRole, field: keyof PlayerState, value: string) {
    setValues((prev) => ({ ...prev, [role]: { ...prev[role], [field]: value } }));
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createCampaign(values);
      result.ok ? router.push(`/campaigns/${result.campaignId}`) : setError(result.error);
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">New Campaign</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="campaign-name">Campaign name</Label>
          <Input
            id="campaign-name"
            value={values.name}
            onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="campaign-size">Campaign size</Label>
          <Select
            value={values.size}
            onValueChange={(value) => {
              const size = CAMPAIGN_SIZES.find((size) => size === value);
              if (size) setValues((prev) => ({ ...prev, size }));
            }}
          >
            <SelectTrigger id="campaign-size" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAMPAIGN_SIZES.map((size) => (
                <SelectItem key={size} value={size}>
                  {size.charAt(0).toUpperCase() + size.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <PlayerFields
          role="attacker"
          value={values.attacker}
          onChange={(field, value) => updatePlayer('attacker', field, value)}
        />
        <PlayerFields
          role="defender"
          value={values.defender}
          onChange={(field, value) => updatePlayer('defender', field, value)}
        />

        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" disabled={pending}>
          Create campaign
        </Button>
      </form>
    </main>
  );
}
