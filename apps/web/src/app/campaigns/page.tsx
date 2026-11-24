import Link from 'next/link';
import { connection } from 'next/server';
import { listCampaigns } from '@/entities/campaign/server';

export default async function CampaignsPage() {
  await connection();
  const campaigns = await listCampaigns();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <Link href="/campaigns/new" className="underline">
          New Campaign
        </Link>
      </div>
      {campaigns.length === 0 ? (
        <p className="text-muted-foreground">No campaigns yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {campaigns.map((campaign) => (
            <li key={campaign.id}>
              <Link href={`/campaigns/${campaign.id}`} className="underline">
                {campaign.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
