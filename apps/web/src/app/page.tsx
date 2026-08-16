import Link from 'next/link';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@warmaster/ui';
import { getCampaigns } from '@/entities/campaign';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const campaigns = await getCampaigns();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <Link href="/campaigns/new">
          <Button>New campaign</Button>
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <p className="text-muted-foreground">
          No campaigns yet. Create your first planet to conquer.
        </p>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((campaign) => (
            <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {campaign.name}
                    <span className="text-sm font-normal text-muted-foreground">
                      radius {campaign.radius}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {campaign.players.map((p) => (
                      <span key={p.id} className="inline-flex items-center gap-1 text-sm">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        {p.name}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
