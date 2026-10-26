import { useState, useTransition } from 'react';
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@warmaster/ui';
import { OWNERS, type OwnerId } from '@/entities/owner';
import type { HexRecord } from '@/entities/hex';
import { assignHexOwner } from '../api/assign-hex-owner';

type Props = {
  hex: HexRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: (hexId: string, ownerId: OwnerId | null) => void;
};

export function AssignOwnerDrawer({ hex, open, onOpenChange, onAssigned }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function assign(ownerId: OwnerId | null) {
    if (!hex) return;
    setError(null);
    startTransition(async () => {
      const result = await assignHexOwner({ hexId: hex.id, ownerId });
      if (result.ok) {
        onAssigned(hex.id, ownerId);
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
          {OWNERS.map((o) => (
            <Button key={o.id} disabled={pending} onClick={() => assign(o.id)}>
              {o.name}
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
