export const dynamic = 'force-dynamic';
import { Nav } from '@/components/Nav';
import { prisma } from '@/lib/prisma';

export default async function Page() {
  const [players, cards, rounds, pointEvents] = await Promise.all([
    prisma.player.count(),
    prisma.card.count(),
    prisma.round.count(),
    prisma.pointEvent.count(),
  ]);

  return (
    <main className="p-8">
      <Nav />
      <h1 className="text-3xl font-bold mb-4">Stats</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded border border-zinc-800 p-4"><p>Players</p><p className="text-2xl font-bold">{players}</p></div>
        <div className="rounded border border-zinc-800 p-4"><p>Cards</p><p className="text-2xl font-bold">{cards}</p></div>
        <div className="rounded border border-zinc-800 p-4"><p>Rounds</p><p className="text-2xl font-bold">{rounds}</p></div>
        <div className="rounded border border-zinc-800 p-4"><p>Point Events</p><p className="text-2xl font-bold">{pointEvents}</p></div>
      </div>
    </main>
  );
}
