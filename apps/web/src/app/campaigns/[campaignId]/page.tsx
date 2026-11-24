import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { getCampaign } from '@/entities/campaign/server';
import { getFactionName } from '@/entities/factions';
import { HexMap } from '@/widgets/hex-map';

type PageProps = { params: Promise<{ campaignId: string }> };

export default async function CampaignPage({ params }: PageProps) {
  await connection();
  const { campaignId } = await params;
  const campaign = await getCampaign(campaignId);

  if (!campaign) notFound();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-col gap-1 p-6 pb-0">
        <h1 className="text-2xl font-semibold">{campaign.name}</h1>
        <p className="text-muted-foreground">
          {campaign.size} board, {campaign.hexes.length} hexes
        </p>
        <ul className="flex flex-col gap-1">
          {campaign.players.map((player) => (
            <li key={player.id}>
              {player.role}: {player.name} ({getFactionName(player.factionId)})
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Players are names only for now. Anyone with this link can change the board.
        </p>
      </header>
      <div className="h-[70vh] w-full">
        <HexMap hexes={campaign.hexes} players={campaign.players} />
      </div>
    </div>
  );
}
