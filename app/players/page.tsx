import { requireAuth } from '@/lib/auth';
import { Nav } from '@/components/Nav';
import { prisma } from '@/lib/prisma';

export default async function Page() {
  await requireAuth();
  const players = await prisma.player.findMany({ orderBy: { displayName: 'asc' } });

  return (
    <main className="p-8">
      <Nav />
      <h1 className="text-3xl font-bold mb-4">Players</h1>
      <p className="mb-4 text-zinc-300">{players.length} registered players.</p>
      <ul className="space-y-2">
        {players.map((player) => (
          <li key={player.id} className="rounded border border-zinc-800 p-3">
            {player.displayName}
          </li>
        ))}
      </ul>
    </main>
  );
}
