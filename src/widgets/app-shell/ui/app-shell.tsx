import type { ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@/shared/ui';
import type { CampaignSummary } from '@/entities/campaign';
import { AppSidebar } from './app-sidebar';
import { TopBar } from './top-bar';

type AppShellProps = { children: ReactNode; campaigns: CampaignSummary[] };

export function AppShell({ children, campaigns }: AppShellProps) {
  return (
    <SidebarProvider className="h-svh">
      <AppSidebar campaigns={campaigns} />
      <SidebarInset className="min-h-0">
        <TopBar />
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
