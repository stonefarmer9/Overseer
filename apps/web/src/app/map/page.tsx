import { getHexes } from '@/entities/hex/server';
import { HexMap } from '@/widgets/hex-map';

export default async function MapPage() {
  const hexes = await getHexes();
  return <HexMap hexes={hexes} />;
}
