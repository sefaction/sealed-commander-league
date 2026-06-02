export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/Nav';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [players, leagues, seasons, rounds] = await Promise.all([
    prisma.player.count(), prisma.league.count(), prisma.season.count(), prisma.round.count(),
  ]);
  const authMessage = params.auth === 'required' ? 'Please log in to access this page.' : params.auth === 'denied' ? 'You do not have permission to access that page.' : '';

  return <main className="p-8"><Nav /><h1 className="mb-6 text-3xl font-bold">Dashboard</h1>
    {authMessage ? <p className="mb-4 rounded border border-amber-800 bg-amber-950/40 p-3 text-amber-100">{authMessage}</p> : null}
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[
      ['Players', players], ['Leagues', leagues], ['Seasons', seasons], ['Rounds', rounds],
    ].map(([label, value]) => <div key={String(label)} className="rounded border border-zinc-800 p-4"><p>{label}</p><p className="text-2xl font-bold">{String(value)}</p></div>)}</div>
  </main>;
}
