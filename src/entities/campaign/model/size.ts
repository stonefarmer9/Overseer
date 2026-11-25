export const CAMPAIGN_SIZES = ['small', 'medium', 'large', 'huge'] as const;

export type CampaignSize = (typeof CAMPAIGN_SIZES)[number];

export const DEFAULT_CAMPAIGN_SIZE: CampaignSize = 'large';

const RADIUS_BY_SIZE: Record<CampaignSize, number> = {
  small: 1,
  medium: 2,
  large: 3,
  huge: 4,
};

export function radiusFor(size: CampaignSize): number {
  return RADIUS_BY_SIZE[size];
}
