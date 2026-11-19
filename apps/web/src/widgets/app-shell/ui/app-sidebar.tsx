import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@warmaster/ui';
import type { CampaignSummary } from '@/entities/campaign';

const PLACEHOLDER_SECTIONS = [
  { title: 'Battle History', items: ['Battle History 1', 'Battle History 2', 'Battle History 3'] },
  { title: 'Army List', items: ['Army List 1', 'Army List 2', 'Army List 3'] },
  { title: 'Settings', items: ['Settings 1', 'Settings 2', 'Settings 3'] },
];

type AppSidebarProps = { campaigns: CampaignSummary[] };

export function AppSidebar({ campaigns }: AppSidebarProps) {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarSection title="Campaigns">
              {campaigns.map((campaign) => (
                <SidebarMenuSubItem key={campaign.id}>
                  <SidebarMenuSubButton asChild>
                    <Link href={`/campaigns/${campaign.id}`}>{campaign.name}</Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild>
                  <Link href="/campaigns/new">New campaign</Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarSection>

            {PLACEHOLDER_SECTIONS.map((section) => (
              <SidebarSection key={section.title} title={section.title}>
                {section.items.map((item) => (
                  <SidebarMenuSubItem key={item}>
                    <SidebarMenuSubButton>{item}</SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarSection>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

type SidebarSectionProps = { title: string; children: ReactNode };

function SidebarSection({ title, children }: SidebarSectionProps) {
  return (
    <SidebarMenuItem>
      <Collapsible defaultOpen className="group/collapsible">
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            {title}
            <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>{children}</SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}
