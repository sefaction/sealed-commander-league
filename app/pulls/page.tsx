import { requireAuth } from '@/lib/auth';
import { Nav } from '@/components/Nav';
import { prisma } from '@/lib/prisma';

export default async function Page() {
  await requireAuth();
  const ownerships = await prisma.cardOwnership.count();
  const cards = await prisma.card.count();

  return <main className="p-8"><Nav /><h1 className="text-3xl font-bold mb-4">Pulls</h1><p className="text-zinc-300">Tracked pulled card entries: <strong>{ownerships}</strong>. Unique cards indexed: <strong>{cards}</strong>.</p></main>;
}
