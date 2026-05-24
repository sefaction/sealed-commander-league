import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/Nav';

export default async function DashboardPage() {
  await requireAuth();
  const [players, leagues, seasons, rounds] = await Promise.all([
    prisma.player.count(), prisma.league.count(), prisma.season.count(), prisma.round.count(),
  ]);

  return <main className="p-8"><Nav /><h1 className="mb-6 text-3xl font-bold">Dashboard</h1>
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[
      ['Players', players], ['Leagues', leagues], ['Seasons', seasons], ['Rounds', rounds],
    ].map(([label, value]) => <div key={String(label)} className="rounded border border-zinc-800 p-4"><p>{label}</p><p className="text-2xl font-bold">{String(value)}</p></div>)}</div>
  </main>;
}
