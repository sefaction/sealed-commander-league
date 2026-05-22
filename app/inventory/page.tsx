import { requireAuth } from '@/lib/auth';
import { Nav } from '@/components/Nav';
import { prisma } from '@/lib/prisma';

export default async function Page() {
  await requireAuth();
  const inventory = await prisma.cardOwnership.groupBy({ by: ['currentOwnerId'], _sum: { quantity: true } });
  const players = await prisma.player.findMany({ where: { id: { in: inventory.map((i: { currentOwnerId: string }) => i.currentOwnerId) } } });
  const byId = new Map(players.map((p) => [p.id, p.displayName]));

  return (
    <main className="p-8">
      <Nav />
      <h1 className="text-3xl font-bold mb-4">Inventory</h1>
      <ul className="space-y-2">
        {inventory.map((row) => <li key={row.currentOwnerId} className="rounded border border-zinc-800 p-3">{byId.get(row.currentOwnerId) ?? 'Unknown'}: {row._sum.quantity ?? 0} cards</li>)}
      </ul>
    </main>
  );
}
