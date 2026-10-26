import type { ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@warmaster/ui';
import { AppSidebar } from './app-sidebar';
import { TopBar } from './top-bar';

type AppShellProps = { children: ReactNode };

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider className="h-svh">
      <AppSidebar />
      <SidebarInset className="min-h-0">
        <TopBar />
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
