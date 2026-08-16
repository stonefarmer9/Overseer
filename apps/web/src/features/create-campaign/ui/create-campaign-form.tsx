'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@warmaster/ui';
import { createCampaign } from '../api/create-campaign';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

export function CreateCampaignForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [radius, setRadius] = useState('3');
  const [players, setPlayers] = useState(['', '']);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function updatePlayer(index: number, value: string) {
    setPlayers((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  function addPlayer() {
    if (players.length < MAX_PLAYERS) setPlayers((prev) => [...prev, '']);
  }

  function removePlayer(index: number) {
    if (players.length > MIN_PLAYERS) {
      setPlayers((prev) => prev.filter((_, i) => i !== index));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { id } = await createCampaign({ name, radius: Number(radius), players });
      router.push(`/campaigns/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>New Campaign</CardTitle>
          <CardDescription>Create a planet and invite players to conquer it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Campaign name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Battle for Cormora"
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="radius">Planet size</Label>
            <Select value={radius} onValueChange={setRadius}>
              <SelectTrigger id="radius" className="w-full">
                <SelectValue placeholder="Select planet size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Small (7 hexes)</SelectItem>
                <SelectItem value="3">Medium (37 hexes)</SelectItem>
                <SelectItem value="5">Large (91 hexes)</SelectItem>
                <SelectItem value="7">Huge (169 hexes)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Players</Label>
            {players.map((player, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={player}
                  onChange={(e) => updatePlayer(index, e.target.value)}
                  placeholder={`Player ${index + 1} name`}
                  aria-label={`Player ${index + 1}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removePlayer(index)}
                  disabled={players.length <= MIN_PLAYERS}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={addPlayer}>
              + Add player
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-2">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? 'Creating...' : 'Create campaign'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
