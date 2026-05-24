import { requireAuth } from '@/lib/auth';
import { Nav } from '@/components/Nav';
import { prisma } from '@/lib/prisma';

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAuth();
  const params = await searchParams;

  const where: any = {};
  if (params.ownerId) where.currentOwnerId = params.ownerId;
  if (params.roundId) where.roundId = params.roundId;
  if (params.setCode) where.card = { ...(where.card || {}), setCode: params.setCode.toLowerCase() };
  if (params.rarity) where.card = { ...(where.card || {}), rarity: params.rarity };
  if (params.type) where.card = { ...(where.card || {}), typeLine: { contains: params.type, mode: 'insensitive' } };
  if (params.color) where.card = { ...(where.card || {}), colorIdentity: { has: params.color } };
  if (params.q) where.card = { ...(where.card || {}), name: { contains: params.q, mode: 'insensitive' } };

  const [items, players, rounds] = await Promise.all([
    prisma.inventoryItem.findMany({ where, include: { card: true, currentOwner: true, originalOpener: true, round: true }, orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.player.findMany({ orderBy: { displayName: 'asc' } }),
    prisma.round.findMany({ orderBy: { startDate: 'desc' } }),
  ]);

  const selected = params.itemId ? items.find(i => i.id === params.itemId) ?? await prisma.inventoryItem.findUnique({ where: { id: params.itemId }, include: { card: true, currentOwner: true, originalOpener: true, round: true } }) : null;

  return (
    <main className="p-8 space-y-4">
      <Nav />
      <h1 className="text-3xl font-bold">Inventory</h1>
      <form className="flex flex-wrap gap-2" method="get">
        <input name="q" defaultValue={params.q} placeholder="Search card name" className="border p-2 bg-zinc-900" />
        <select name="ownerId" defaultValue={params.ownerId} className="border p-2 bg-zinc-900"><option value="">All owners</option>{players.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}</select>
        <select name="roundId" defaultValue={params.roundId} className="border p-2 bg-zinc-900"><option value="">All rounds</option>{rounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <input name="setCode" defaultValue={params.setCode} placeholder="Set" className="border p-2 bg-zinc-900 w-24" />
        <input name="rarity" defaultValue={params.rarity} placeholder="Rarity" className="border p-2 bg-zinc-900 w-24" />
        <input name="type" defaultValue={params.type} placeholder="Type" className="border p-2 bg-zinc-900 w-32" />
        <input name="color" defaultValue={params.color} placeholder="Color (W/U/B/R/G)" className="border p-2 bg-zinc-900 w-40" />
        <button className="border px-3">Filter</button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zinc-800">
          <thead><tr className="text-left border-b border-zinc-800"><th className="p-2">Card</th><th className="p-2">Set</th><th className="p-2">Rarity</th><th className="p-2">Qty</th><th className="p-2">Foil</th><th className="p-2">Owner</th><th className="p-2">Original Opener</th><th className="p-2">Round</th></tr></thead>
          <tbody>
            {items.map(i => <tr key={i.id} className="border-b border-zinc-800">
              <td className="p-2"><a href={`/inventory?${new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter(([,v])=>v)), itemId: i.id }).toString()}`} className="text-sky-400 underline">{i.card.name}</a></td>
              <td className="p-2">{i.card.setCode.toUpperCase()}</td>
              <td className="p-2">{i.card.rarity}</td>
              <td className="p-2">{i.quantity}</td>
              <td className="p-2">{i.foil ? 'Yes' : 'No'}</td>
              <td className="p-2">{i.currentOwner.displayName}</td>
              <td className="p-2">{i.originalOpener.displayName}</td>
              <td className="p-2">{i.round.name}</td>
            </tr>)}
          </tbody>
        </table>
      </div>

      {selected && <section className="border border-zinc-700 rounded p-4 space-y-2">
        <h2 className="text-xl font-semibold">{selected.card.name}</h2>
        {selected.card.imageUri && <img src={selected.card.imageUri} alt={selected.card.name} className="h-64" />}
        <p className="text-zinc-300">{selected.card.typeLine}</p>
        <p className="text-zinc-300 whitespace-pre-wrap">{selected.card.oracleText}</p>
        <p>Owner: <strong>{selected.currentOwner.displayName}</strong> • Original Opener: <strong>{selected.originalOpener.displayName}</strong></p>
        <p>Opened in: <strong>{selected.round.name}</strong></p>
        <p>History: <em>placeholder</em></p>
      </section>}
    </main>
  );
}
