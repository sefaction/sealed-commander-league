import { requireAuth } from '@/lib/auth';
import { Nav } from '@/components/Nav';
import { prisma } from '@/lib/prisma';

export default async function Page() {
  await requireAuth();
  const rounds = await prisma.round.findMany({
    orderBy: [{ monthNumber: 'desc' }],
    include: { season: { include: { league: true } } },
  });

  return (
    <main className="p-8">
      <Nav />
      <h1 className="text-3xl font-bold mb-4">Rounds</h1>
      <p className="mb-4 text-zinc-300">{rounds.length} rounds in database.</p>
      <ul className="space-y-2">
        {rounds.map((round) => (
          <li key={round.id} className="rounded border border-zinc-800 p-3">
            <p className="font-semibold">{round.name}</p>
            <p className="text-sm text-zinc-400">{round.season.league.name} • {round.season.name} • Month {round.monthNumber}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
