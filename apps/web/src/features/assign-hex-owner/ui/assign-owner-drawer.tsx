import { useState, useTransition } from 'react';
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@overseer/ui';

import type { HexRecord } from '@/entities/hex';
import type { PlayerRecord } from '@/entities/campaign';
import { getFactionName } from '@/entities/factions';
import { assignHexOwner } from '../api/assign-hex-owner';

type Props = {
  hex: HexRecord | null;
  players: PlayerRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: (hexId: string, playerId: string | null) => void;
};

export function AssignOwnerDrawer({ hex, players, open, onOpenChange, onAssigned }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function assign(playerId: string | null) {
    if (!hex) return;
    setError(null);
    startTransition(async () => {
      const result = await assignHexOwner({ hexId: hex.id, playerId });
      if (result.ok) {
        onAssigned(hex.id, playerId);
        onOpenChange(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Assign owner</DrawerTitle>
          <DrawerDescription>{hex ? `Hex ${hex.q},${hex.r}` : ''}</DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-2 p-4">
          {players.map((player) => (
            <Button key={player.id} disabled={pending} onClick={() => assign(player.id)}>
              {getFactionName(player.factionId)} ({player.name})
            </Button>
          ))}
          <Button variant="outline" disabled={pending} onClick={() => assign(null)}>
            Clear owner
          </Button>
        </div>

        {error && (
          <p role="alert" className="p-4 text-destructive">
            {error}
          </p>
        )}
      </DrawerContent>
    </Drawer>
  );
}
