import { UserCircle } from 'lucide-react';
import { Button, SidebarTrigger } from '@/shared/ui';

export function TopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <span className="text-lg font-semibold">Overseer</span>
      </div>
      <Button variant="ghost" size="icon" aria-label="User menu">
        <UserCircle />
      </Button>
    </header>
  );
}
