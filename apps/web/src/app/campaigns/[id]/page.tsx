import { getCampaignById } from '@/entities/campaign';
import { CampaignView } from './campaign-view';

type CampaignPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CampaignPage({ params }: CampaignPageProps) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  return <CampaignView campaign={campaign} />;
}
