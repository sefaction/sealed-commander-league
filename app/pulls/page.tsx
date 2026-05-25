import { requireAuth } from '@/lib/auth';
import { Nav } from '@/components/Nav';
import { prisma } from '@/lib/prisma';
import { FoilStatus, InventorySourceType } from '@prisma/client';
import { searchCards } from '@/lib/scryfall';
import { revalidatePath } from 'next/cache';

export default async function PullsPage({ searchParams }: { searchParams: Promise<{ roundId?: string; playerId?: string; q?: string }> }) {
  await requireAuth();
  const params = await searchParams;
  const rounds = await prisma.round.findMany({ include: { season: { include: { league: true } } }, orderBy: { startDate: 'desc' } });
  const players = await prisma.player.findMany({ where: { active: true }, orderBy: { displayName: 'asc' } });

  const roundId = params.roundId ?? rounds[0]?.id;
  const playerId = params.playerId ?? players[0]?.id;

  const allocation = roundId && playerId ? await prisma.packAllocation.findUnique({ where: { roundId_playerId: { roundId, playerId } } }) : null;
  const q = params.q ?? '';
  const results = q ? await searchCards(q) : [];

  async function savePull(fd: FormData) {
    'use server';
    const roundId = String(fd.get('roundId'));
    const playerId = String(fd.get('playerId'));
    const scryfallId = String(fd.get('scryfallId'));
    const quantity = Number(fd.get('quantity'));
    const foil = fd.get('foil') === 'on';
    const foilStatus = foil ? FoilStatus.FOIL : FoilStatus.NONFOIL;
    const condition = String(fd.get('condition') || 'NM');
    const notes = String(fd.get('notes') || '') || null;

    const cardData = JSON.parse(String(fd.get('cardJson')));

    const card = await prisma.card.upsert({
      where: { scryfallId },
      update: {
        oracleId: cardData.oracle_id ?? null,
        name: cardData.name,
        manaCost: cardData.mana_cost ?? null,
        manaValue: cardData.cmc,
        colors: cardData.colors ?? [],
        colorIdentity: cardData.color_identity ?? [],
        typeLine: cardData.type_line,
        oracleText: cardData.oracle_text ?? null,
        power: cardData.power ?? null,
        toughness: cardData.toughness ?? null,
        loyalty: cardData.loyalty ?? null,
        defense: cardData.defense ?? null,
        keywords: cardData.keywords ?? null,
        legalities: cardData.legalities ?? null,
        setCode: cardData.set,
        setName: cardData.set_name,
        collectorNumber: cardData.collector_number,
        rarity: cardData.rarity,
        artist: cardData.artist ?? null,
        imageUri: cardData.image_uris?.normal ?? null,
        imageUris: cardData.image_uris ?? null,
        prices: cardData.prices ?? null,
        purchaseUris: cardData.purchase_uris ?? null,
        scryfallUri: cardData.scryfall_uri ?? null,
        lastSyncedAt: new Date(),
      },
      create: {
        scryfallId,
        oracleId: cardData.oracle_id ?? null,
        name: cardData.name,
        manaCost: cardData.mana_cost ?? null,
        manaValue: cardData.cmc,
        colors: cardData.colors ?? [],
        colorIdentity: cardData.color_identity ?? [],
        typeLine: cardData.type_line,
        oracleText: cardData.oracle_text ?? null,
        power: cardData.power ?? null,
        toughness: cardData.toughness ?? null,
        loyalty: cardData.loyalty ?? null,
        defense: cardData.defense ?? null,
        keywords: cardData.keywords ?? null,
        legalities: cardData.legalities ?? null,
        setCode: cardData.set,
        setName: cardData.set_name,
        collectorNumber: cardData.collector_number,
        rarity: cardData.rarity,
        artist: cardData.artist ?? null,
        imageUri: cardData.image_uris?.normal ?? null,
        imageUris: cardData.image_uris ?? null,
        prices: cardData.prices ?? null,
        purchaseUris: cardData.purchase_uris ?? null,
        scryfallUri: cardData.scryfall_uri ?? null,
        lastSyncedAt: new Date(),
      },
    });

    const pull = await prisma.pull.create({ data: { roundId, playerId, cardId: card.id, quantity, foil, condition, notes } });

    await prisma.inventoryItem.upsert({
      where: {
        currentOwnerId_originalOpenerId_cardId_foil_condition_roundId: {
          currentOwnerId: playerId,
          originalOpenerId: playerId,
          cardId: card.id,
          foil,
          condition,
          roundId,
        },
      },
      update: { quantity: { increment: quantity }, notes },
      create: {
        currentOwnerId: playerId,
        originalOpenerId: playerId,
        cardId: card.id,
        quantity,
        foil,
        foilStatus,
        condition,
        acquiredFromPullId: pull.id,
        roundId,
        notes,
        sourceType: InventorySourceType.PULL,
      },
    });

    await prisma.packAllocation.updateMany({ where: { roundId, playerId }, data: { packsOpened: { increment: 1 } } });
    revalidatePath('/pulls');
  }

  return <main className="p-8 space-y-4"><Nav /><h1 className="text-3xl font-bold">Pull Entry</h1>
    <form method="get" className="flex gap-2 flex-wrap">
      <select name="roundId" defaultValue={roundId} className="border p-2 bg-zinc-900">{rounds.map(r => <option key={r.id} value={r.id}>{r.season.league.name} - {r.name}</option>)}</select>
      <select name="playerId" defaultValue={playerId} className="border p-2 bg-zinc-900">{players.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}</select>
      <input name="q" placeholder="Search Scryfall" defaultValue={q} className="border p-2 bg-zinc-900" />
      <button className="border px-3">Load</button>
    </form>

    <div className="text-sm text-zinc-300">
      Packs Assigned: <strong>{allocation?.packsAssigned ?? 0}</strong> • Packs Opened: <strong>{allocation?.packsOpened ?? 0}</strong> • Remaining: <strong>{(allocation?.packsAssigned ?? 0) - (allocation?.packsOpened ?? 0)}</strong>
    </div>

    {results.length > 0 && <div className="space-y-2">
      <h2 className="font-semibold">Scryfall Results</h2>
      {results.slice(0, 12).map((card) => (
        <form key={card.id} action={savePull} className="border border-zinc-700 rounded p-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="roundId" value={roundId} />
          <input type="hidden" name="playerId" value={playerId} />
          <input type="hidden" name="scryfallId" value={card.id} />
          <input type="hidden" name="cardJson" value={JSON.stringify(card)} />
          <div className="min-w-[280px]"><strong>{card.name}</strong> ({card.set.toUpperCase()}) #{card.collector_number} • {card.rarity}</div>
          <input name="quantity" type="number" min={1} defaultValue={1} className="w-20 border p-1 bg-zinc-900" />
          <label><input name="foil" type="checkbox" /> foil</label>
          <select name="condition" defaultValue="NM" className="border p-1 bg-zinc-900"><option>NM</option><option>LP</option><option>MP</option><option>HP</option><option>DMG</option></select>
          <input name="notes" placeholder="notes" className="border p-1 bg-zinc-900" />
          <button className="border px-2">Save Pull</button>
        </form>
      ))}
    </div>}
  </main>;
}
