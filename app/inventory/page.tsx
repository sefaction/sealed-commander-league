import { requireAuth } from '@/lib/auth';
import { Nav } from '@/components/Nav';
import { prisma } from '@/lib/prisma';
import { InventoryBrowser } from '@/components/InventoryBrowser';

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAuth();
  const p = await searchParams;
  const where: any = {};
  if (p.cardName) where.card = { ...(where.card || {}), name: { contains: p.cardName, mode: 'insensitive' } };
  if (p.oracleText) where.card = { ...(where.card || {}), oracleText: { contains: p.oracleText, mode: 'insensitive' } };
  if (p.typeLine) where.card = { ...(where.card || {}), typeLine: { contains: p.typeLine, mode: 'insensitive' } };
  if (p.ownerId) where.currentOwnerId = p.ownerId;
  if (p.originalOpenerId) where.originalOpenerId = p.originalOpenerId;
  if (p.roundId) where.roundId = p.roundId;
  if (p.set) where.card = { ...(where.card || {}), setCode: p.set.toLowerCase() };
  if (p.rarity) where.card = { ...(where.card || {}), rarity: p.rarity };
  if (p.foil === 'true') where.foil = true;
  if (p.foil === 'false') where.foil = false;
  if (p.manaValueMin || p.manaValueMax) where.card = { ...(where.card || {}), manaValue: { gte: p.manaValueMin ? Number(p.manaValueMin) : undefined, lte: p.manaValueMax ? Number(p.manaValueMax) : undefined } };
  const colorIdentityNeedle = p.colorIdentity?.trim().toUpperCase();
  const keywordNeedle = p.keyword?.trim().toLowerCase();
  const priceMin = p.priceMin ? Number(p.priceMin) : undefined;
  const priceMax = p.priceMax ? Number(p.priceMax) : undefined;

  const [items, players, rounds] = await Promise.all([
    prisma.inventoryItem.findMany({ where, include: { card: true, currentOwner: true, originalOpener: true, round: true }, orderBy: { createdAt: 'desc' } }),
    prisma.player.findMany({ orderBy: { displayName: 'asc' } }),
    prisma.round.findMany({ orderBy: { startDate: 'desc' } }),
  ]);

  const rows = items.map(i => ({
    id: i.id,
    cardName: i.card.name,
    quantity: i.quantity,
    currentOwner: i.currentOwner.displayName,
    originalOpener: i.originalOpener.displayName,
    setCode: i.card.setCode.toUpperCase(),
    setName: i.card.setName ?? '',
    rarity: i.card.rarity,
    manaCost: i.card.manaCost ?? '',
    manaValue: i.card.manaValue ?? undefined,
    typeLine: i.card.typeLine,
    colorIdentity: Array.isArray(i.card.colorIdentity) ? i.card.colorIdentity.join(',') : JSON.stringify(i.card.colorIdentity ?? ''),
    colors: Array.isArray(i.card.colors) ? i.card.colors.join(',') : JSON.stringify(i.card.colors ?? ''),
    priceUsd: (i.card.prices as any)?.usd ?? '',
    priceUsdFoil: (i.card.prices as any)?.usd_foil ?? '',
    priceUsdEtched: (i.card.prices as any)?.usd_etched ?? '',
    priceEur: (i.card.prices as any)?.eur ?? '',
    priceEurFoil: (i.card.prices as any)?.eur_foil ?? '',
    priceTix: (i.card.prices as any)?.tix ?? '',
    foil: i.foil,
    roundOpened: i.round.name,
    oracleText: i.card.oracleText ?? '',
    powerToughness: [i.card.power, i.card.toughness].filter(Boolean).join('/'),
    power: i.card.power ?? '',
    toughness: i.card.toughness ?? '',
    loyalty: i.card.loyalty ?? '',
    defense: i.card.defense ?? '',
    legalities: (i.card.legalities as any) ?? {},
    artist: i.card.artist ?? '',
    collectorNumber: i.card.collectorNumber,
    keywords: Array.isArray(i.card.keywords) ? i.card.keywords.join(', ') : JSON.stringify(i.card.keywords ?? ''),
    notes: i.notes ?? '',
    condition: i.condition,
    imageUri: (i.card.imageUris as any)?.normal ?? (i.card.imageUris as any)?.small ?? (i.card.imageUris as any)?.front ?? i.card.imageUri ?? '',
    imageSmall: (i.card.imageUris as any)?.small ?? '',
    scryfallUri: i.card.scryfallUri ?? '',
  })).filter((row) => {
    if (colorIdentityNeedle) {
      const colorHaystack = row.colorIdentity.toUpperCase();
      if (!colorHaystack.includes(colorIdentityNeedle)) return false;
    }

    if (keywordNeedle) {
      const keywordHaystack = row.keywords.toLowerCase();
      if (!keywordHaystack.includes(keywordNeedle)) return false;
    }

    const usdPrice = row.priceUsd ? Number(row.priceUsd) : undefined;
    if (priceMin !== undefined && (usdPrice === undefined || Number.isNaN(usdPrice) || usdPrice < priceMin)) return false;
    if (priceMax !== undefined && (usdPrice === undefined || Number.isNaN(usdPrice) || usdPrice > priceMax)) return false;

    return true;
  });

  return <main className="p-8 space-y-4"><Nav /><h1 className="text-3xl font-bold">Inventory Browser</h1>
    <details open className="border border-zinc-800 rounded p-3"><summary className="cursor-pointer font-semibold">Advanced Filters</summary>
      <form className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
        <input name="cardName" defaultValue={p.cardName} placeholder="card name contains" className="border p-2 bg-zinc-900" />
        <input name="oracleText" defaultValue={p.oracleText} placeholder="oracle text contains" className="border p-2 bg-zinc-900" />
        <input name="typeLine" defaultValue={p.typeLine} placeholder="type line contains" className="border p-2 bg-zinc-900" />
        <select name="ownerId" defaultValue={p.ownerId} className="border p-2 bg-zinc-900"><option value="">current owner</option>{players.map(pl => <option key={pl.id} value={pl.id}>{pl.displayName}</option>)}</select>
        <select name="originalOpenerId" defaultValue={p.originalOpenerId} className="border p-2 bg-zinc-900"><option value="">original opener</option>{players.map(pl => <option key={pl.id} value={pl.id}>{pl.displayName}</option>)}</select>
        <select name="roundId" defaultValue={p.roundId} className="border p-2 bg-zinc-900"><option value="">round opened</option>{rounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <input name="set" defaultValue={p.set} placeholder="set" className="border p-2 bg-zinc-900" />
        <input name="rarity" defaultValue={p.rarity} placeholder="rarity" className="border p-2 bg-zinc-900" />
        <input name="colorIdentity" defaultValue={p.colorIdentity} placeholder="color identity" className="border p-2 bg-zinc-900" />
        <input name="manaValueMin" defaultValue={p.manaValueMin} placeholder="mana value min" className="border p-2 bg-zinc-900" />
        <input name="manaValueMax" defaultValue={p.manaValueMax} placeholder="mana value max" className="border p-2 bg-zinc-900" />
        <input name="keyword" defaultValue={p.keyword} placeholder="keyword contains" className="border p-2 bg-zinc-900" />
        <select name="foil" defaultValue={p.foil} className="border p-2 bg-zinc-900"><option value="">foil/nonfoil</option><option value="true">foil</option><option value="false">nonfoil</option></select>
        <input name="priceMin" defaultValue={p.priceMin} placeholder="price min" className="border p-2 bg-zinc-900" />
        <input name="priceMax" defaultValue={p.priceMax} placeholder="price max" className="border p-2 bg-zinc-900" />
        <div className="col-span-2 flex gap-2"><button className="border px-3">Apply</button><a href="/inventory" className="border px-3 py-2">Clear Filters</a></div>
      </form>
    </details>
    <InventoryBrowser rows={rows} />
  </main>;
}
