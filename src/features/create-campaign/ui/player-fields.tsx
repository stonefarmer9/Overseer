import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@overseer/ui';
import { FACTION_GROUPS } from '@/entities/factions';

export type PlayerRole = 'attacker' | 'defender';

export type PlayerState = { name: string; factionId: string };

export type PlayerFieldsProps = {
  role: PlayerRole;
  value: PlayerState;
  onChange: (field: keyof PlayerState, value: string) => void;
};

const PLAYER_TITLES: Record<PlayerRole, string> = {
  attacker: 'Attacker',
  defender: 'Defender',
};

export function PlayerFields({ role, value, onChange }: PlayerFieldsProps) {
  const title = PLAYER_TITLES[role];

  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
      <legend className="px-1 font-medium">{title}</legend>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${role}-name`}>{title}</Label>
        <Input
          id={`${role}-name`}
          value={value.name}
          onChange={(event) => onChange('name', event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${role}-faction`}>{title} faction</Label>
        <Select
          value={value.factionId}
          onValueChange={(factionId) => onChange('factionId', factionId)}
        >
          <SelectTrigger id={`${role}-faction`} className="w-full">
            <SelectValue placeholder="Choose a faction" />
          </SelectTrigger>
          <SelectContent>
            {FACTION_GROUPS.map((group) => (
              <SelectGroup key={group.name}>
                <SelectLabel>{group.name}</SelectLabel>
                {group.factions.map((faction) => (
                  <SelectItem key={faction.id} value={faction.id}>
                    {faction.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
    </fieldset>
  );
}
