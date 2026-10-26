import { connection } from 'next/server';
import { getHexes } from '@/entities/hex/server';
import { HexMap } from '@/widgets/hex-map';

export default async function MapPage() {
  await connection();
  const hexes = await getHexes();
  return <HexMap hexes={hexes} />;
}
