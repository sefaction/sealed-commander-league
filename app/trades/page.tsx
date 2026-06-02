export const dynamic = 'force-dynamic';
import { Nav } from '@/components/Nav';
import { prisma } from '@/lib/prisma';
import { isAdminUser, requireLogin } from '@/lib/auth';
import { InventorySourceType, TradeStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const activeStatuses: TradeStatus[] = [TradeStatus.PROPOSED, TradeStatus.ACCEPTED_PENDING_EXCHANGE, TradeStatus.PARTIALLY_COMMITTED];
const limitStatuses: TradeStatus[] = [...activeStatuses, TradeStatus.COMPLETED];
const terminalStatuses: TradeStatus[] = [TradeStatus.COMPLETED, TradeStatus.DECLINED, TradeStatus.CANCELLED, TradeStatus.CANCELED];
const physicalStatuses: TradeStatus[] = [TradeStatus.ACCEPTED_PENDING_EXCHANGE, TradeStatus.PARTIALLY_COMMITTED];

type SearchParams = { proposerId?: string; receiverId?: string; tradeRoundId?: string; message?: string };

function cardImage(item?: { card?: { imageUri?: string | null; imageUris?: unknown } } | null) {
  const images = item?.card?.imageUris as { small?: string; normal?: string } | null | undefined;
  return images?.small ?? images?.normal ?? item?.card?.imageUri ?? '';
}
function statusLabel(status: TradeStatus) {
  return status.toLowerCase();
}
function itemLabel(item: { card: { name: string; setCode: string; collectorNumber: string }; condition: string; foilStatus: string; quantity: number; round: { name: string } }) {
  return `${item.card.name} (${item.card.setCode.toUpperCase()} #${item.card.collectorNumber}) • ${item.foilStatus.toLowerCase()} • ${item.condition} • ${item.round.name} • qty ${item.quantity}`;
}

export default async function TradesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireLogin();
  const isAdmin = isAdminUser(user, user.player);
  const params = await searchParams;
  const players = await prisma.player.findMany({ where: { active: true }, orderBy: { displayName: 'asc' } });
  const rounds = await prisma.round.findMany({ where: { tradingEnabled: true }, orderBy: { startDate: 'desc' } });
  const selectedRoundId = params.tradeRoundId || rounds.find((r) => r.tradingStatus === 'OPEN')?.id || rounds[0]?.id || '';
  const proposerId = isAdmin ? (params.proposerId || user.playerId || players[0]?.id || '') : (user.playerId || '');
  const receiverId = params.receiverId || players.find((p) => p.id !== proposerId)?.id || '';
  if (!isAdmin && !user.playerId) return <main className="p-8"><Nav /><p className="rounded border border-red-800 p-3">Your user account is not linked to a player, so you cannot trade yet.</p></main>;

  const inventory = await prisma.inventoryItem.findMany({
    where: { currentOwnerId: { in: [proposerId, receiverId].filter(Boolean) }, quantity: { gt: 0 } },
    include: { card: true, currentOwner: true, originalOpener: true, round: true },
    orderBy: [{ currentOwner: { displayName: 'asc' } }, { card: { name: 'asc' } }],
  });
  const visibleTrades = await prisma.trade.findMany({
    where: isAdmin ? {} : { OR: [{ proposerPlayerId: user.playerId! }, { receiverPlayerId: user.playerId! }] },
    include: { tradeRound: true, proposerPlayer: true, receiverPlayer: true, offeredInventoryItem: { include: { card: true, round: true } }, requestedInventoryItem: { include: { card: true, round: true } }, events: { orderBy: { createdAt: 'asc' }, include: { actorPlayer: true, actorUser: true } } },
    orderBy: { proposedAt: 'desc' },
  });
  const activeReservations = await prisma.trade.findMany({ where: { status: { in: activeStatuses } }, select: { offeredInventoryItemId: true, requestedInventoryItemId: true } });
  const reservedCount = new Map<string, number>();
  for (const trade of activeReservations) for (const id of [trade.offeredInventoryItemId, trade.requestedInventoryItemId]) reservedCount.set(id, (reservedCount.get(id) || 0) + 1);
  const available = (id: string, quantity: number) => Math.max(0, quantity - (reservedCount.get(id) || 0));

  async function validateProposedTrade(data: { tradeRoundId: string; proposerPlayerId: string; receiverPlayerId: string; offeredInventoryItemId: string; requestedInventoryItemId: string }) {
    if (data.proposerPlayerId === data.receiverPlayerId) throw new Error('Proposer and receiver must be different players.');
    if (data.offeredInventoryItemId === data.requestedInventoryItemId) throw new Error('Trades must be exactly one card for one card.');
    const [round, offered, requested] = await Promise.all([
      prisma.round.findUnique({ where: { id: data.tradeRoundId } }),
      prisma.inventoryItem.findUnique({ where: { id: data.offeredInventoryItemId }, include: { currentOwner: true, round: true, card: true } }),
      prisma.inventoryItem.findUnique({ where: { id: data.requestedInventoryItemId }, include: { currentOwner: true, round: true, card: true } }),
    ]);
    if (!round || !round.tradingEnabled || round.tradingStatus !== 'OPEN') throw new Error('Trading is closed for this round.');
    if (!offered || offered.currentOwnerId !== data.proposerPlayerId) throw new Error('You can only offer cards from your own inventory.');
    if (!requested || requested.currentOwnerId !== data.receiverPlayerId) throw new Error('You can only request cards from the selected trade partner.');
    const reservationRows = await prisma.trade.findMany({ where: { status: { in: activeStatuses }, OR: [{ offeredInventoryItemId: { in: [offered.id, requested.id] } }, { requestedInventoryItemId: { in: [offered.id, requested.id] } }] }, select: { offeredInventoryItemId: true, requestedInventoryItemId: true } });
    const reservationCount = (id: string) => reservationRows.filter((t) => t.offeredInventoryItemId === id || t.requestedInventoryItemId === id).length;
    if (offered.quantity - reservationCount(offered.id) < 1 || requested.quantity - reservationCount(requested.id) < 1) throw new Error('That card is already reserved in another active trade.');
    if (!round.allowFutureRoundCards && (offered.round.monthNumber > round.monthNumber || requested.round.monthNumber > round.monthNumber)) throw new Error('Cards opened for a future round cannot be traded yet.');
    const used = await prisma.trade.count({ where: { tradeRoundId: round.id, status: { in: limitStatuses }, OR: [{ proposerPlayerId: data.proposerPlayerId, receiverPlayerId: data.receiverPlayerId }, { proposerPlayerId: data.receiverPlayerId, receiverPlayerId: data.proposerPlayerId }] } });
    if (used >= round.maxTradesPerOpponent) throw new Error(`This trade would exceed your trade limit with this player for the selected round. Used ${used} of ${round.maxTradesPerOpponent}.`);
    return { round, offered, requested };
  }

  async function createTrade(fd: FormData) {
    'use server';
    const actor = await requireLogin();
    const actorIsAdmin = isAdminUser(actor, actor.player);
    const proposerPlayerId = actorIsAdmin ? String(fd.get('proposerPlayerId') || '') : actor.playerId!;
    if (!actorIsAdmin && proposerPlayerId !== actor.playerId) throw new Error('Players cannot propose trades for another player.');
    const data = { tradeRoundId: String(fd.get('tradeRoundId') || ''), proposerPlayerId, receiverPlayerId: String(fd.get('receiverPlayerId') || ''), offeredInventoryItemId: String(fd.get('offeredInventoryItemId') || ''), requestedInventoryItemId: String(fd.get('requestedInventoryItemId') || '') };
    await validateProposedTrade(data);
    await prisma.trade.create({ data: { ...data, status: TradeStatus.PROPOSED, message: String(fd.get('message') || '') || null, createdByUserId: actor.id, events: { create: { eventType: 'proposed', actorUserId: actor.id, actorPlayerId: proposerPlayerId, message: 'Trade proposed.' } } } });
    revalidatePath('/trades');
  }

  async function loadTradeForAction(tradeId: string) {
    const trade = await prisma.trade.findUnique({ where: { id: tradeId }, include: { proposerPlayer: true, receiverPlayer: true, tradeRound: true, offeredInventoryItem: { include: { card: true, currentOwner: true, originalOpener: true, round: true, auditLogs: true } }, requestedInventoryItem: { include: { card: true, currentOwner: true, originalOpener: true, round: true, auditLogs: true } } } });
    if (!trade) throw new Error('Trade not found.');
    return trade;
  }

  async function actOnTrade(fd: FormData) {
    'use server';
    const actor = await requireLogin();
    const actorIsAdmin = isAdminUser(actor, actor.player);
    const tradeId = String(fd.get('tradeId') || '');
    const action = String(fd.get('action') || '');
    const trade = await loadTradeForAction(tradeId);
    if (!actorIsAdmin && actor.playerId !== trade.proposerPlayerId && actor.playerId !== trade.receiverPlayerId) throw new Error('You cannot act on another player\'s trade.');
    const now = new Date();
    if (action === 'accept') {
      if (actor.playerId !== trade.receiverPlayerId && !actorIsAdmin) throw new Error('Only the receiver can accept this trade.');
      if (trade.status !== TradeStatus.PROPOSED) throw new Error('Only proposed trades can be accepted.');
      await prisma.trade.update({ where: { id: trade.id }, data: { status: TradeStatus.ACCEPTED_PENDING_EXCHANGE, acceptedAt: now, events: { create: { eventType: 'accepted', actorUserId: actor.id, actorPlayerId: actor.playerId, message: 'Trade accepted; awaiting physical exchange.' } } } });
    } else if (action === 'decline') {
      if (actor.playerId !== trade.receiverPlayerId && !actorIsAdmin) throw new Error('Only the receiver can decline this trade.');
      if (trade.status !== TradeStatus.PROPOSED) throw new Error('Only proposed trades can be declined.');
      await prisma.trade.update({ where: { id: trade.id }, data: { status: TradeStatus.DECLINED, declinedAt: now, events: { create: { eventType: 'declined', actorUserId: actor.id, actorPlayerId: actor.playerId, message: String(fd.get('reason') || 'Trade declined.') } } } });
    } else if (action === 'cancel') {
      if (!actorIsAdmin && actor.playerId !== trade.proposerPlayerId) throw new Error('Only the proposer can cancel this trade.');
      if (terminalStatuses.includes(trade.status)) throw new Error('This trade can no longer be cancelled.');
      const reason = String(fd.get('reason') || 'Trade cancelled.');
      await prisma.trade.update({ where: { id: trade.id }, data: { status: TradeStatus.CANCELLED, cancelledAt: now, events: { create: { eventType: 'cancelled', actorUserId: actor.id, actorPlayerId: actor.playerId, message: reason } } } });
    }
    revalidatePath('/trades');
  }

  async function addToReceiver(tx: typeof prisma, tradeId: string, item: any, toPlayerId: string, actorUserId: string, reason: string) {
    const uniqueWhere = { currentOwnerId_originalOpenerId_cardId_foil_condition_roundId: { currentOwnerId: toPlayerId, originalOpenerId: item.originalOpenerId, cardId: item.cardId, foil: item.foil, condition: item.condition, roundId: item.roundId } };
    const existing = await tx.inventoryItem.findUnique({ where: uniqueWhere });
    if (existing) {
      const beforeJson = { ...existing } as any;
      const updated = await tx.inventoryItem.update({ where: { id: existing.id }, data: { quantity: { increment: 1 }, sourceType: InventorySourceType.TRADE } });
      await tx.inventoryAuditLog.create({ data: { inventoryItemId: updated.id, changedByUserId: actorUserId, tradeId, changeType: 'trade_completed', beforeJson, afterJson: updated as any, reason } });
    } else {
      const created = await tx.inventoryItem.create({ data: { currentOwnerId: toPlayerId, originalOpenerId: item.originalOpenerId, cardId: item.cardId, quantity: 1, foil: item.foil, foilStatus: item.foilStatus, sourceType: InventorySourceType.TRADE, condition: item.condition, language: item.language, roundId: item.roundId, notes: item.notes } });
      await tx.inventoryAuditLog.create({ data: { inventoryItemId: created.id, changedByUserId: actorUserId, tradeId, changeType: 'trade_completed', beforeJson: {}, afterJson: created as any, reason } });
    }
  }

  async function completeTradeIfReady(tradeId: string, actorUserId: string, force = false) {
    const trade = await loadTradeForAction(tradeId);
    if (!force && (!trade.proposerCommittedAt || !trade.receiverCommittedAt)) return;
    const reason = `Completed trade between ${trade.proposerPlayer.displayName} and ${trade.receiverPlayer.displayName}`;
    await prisma.$transaction(async (tx) => {
      const offered = await tx.inventoryItem.findUnique({ where: { id: trade.offeredInventoryItemId } });
      const requested = await tx.inventoryItem.findUnique({ where: { id: trade.requestedInventoryItemId } });
      if (!offered || !requested || offered.quantity < 1 || requested.quantity < 1) throw new Error('One of the traded cards is no longer available.');
      for (const item of [offered, requested]) {
        const beforeJson = { ...item } as any;
        const updated = await tx.inventoryItem.update({ where: { id: item.id }, data: { quantity: Math.max(0, item.quantity - 1) } });
        await tx.inventoryAuditLog.create({ data: { inventoryItemId: updated.id, changedByUserId: actorUserId, tradeId, changeType: 'trade_completed', beforeJson, afterJson: updated as any, reason } });
      }
      await addToReceiver(tx as any, tradeId, offered, trade.receiverPlayerId, actorUserId, reason);
      await addToReceiver(tx as any, tradeId, requested, trade.proposerPlayerId, actorUserId, reason);
      await tx.trade.update({ where: { id: tradeId }, data: { status: TradeStatus.COMPLETED, completedAt: new Date(), proposerCommittedAt: trade.proposerCommittedAt ?? new Date(), receiverCommittedAt: trade.receiverCommittedAt ?? new Date(), events: { create: { eventType: 'completed', actorUserId, message: reason } } } });
    });
  }

  async function confirmPhysicalTrade(fd: FormData) {
    'use server';
    const actor = await requireLogin();
    const actorIsAdmin = isAdminUser(actor, actor.player);
    const trade = await loadTradeForAction(String(fd.get('tradeId') || ''));
    if (!physicalStatuses.includes(trade.status)) throw new Error('This trade is not awaiting physical confirmation.');
    const data: any = { status: TradeStatus.PARTIALLY_COMMITTED };
    let eventType = 'physical_confirmed';
    if (actorIsAdmin && fd.get('forceComplete')) {
      const reason = String(fd.get('reason') || '');
      if (!reason) throw new Error('Admin force complete requires a reason.');
      await prisma.tradeEvent.create({ data: { tradeId: trade.id, eventType: 'admin_force_complete', actorUserId: actor.id, actorPlayerId: actor.playerId, message: reason } });
      await completeTradeIfReady(trade.id, actor.id, true);
      revalidatePath('/trades');
      return;
    }
    if (actor.playerId === trade.proposerPlayerId) { data.proposerCommittedAt = new Date(); eventType = 'proposer_confirmed_physical_exchange'; }
    else if (actor.playerId === trade.receiverPlayerId) { data.receiverCommittedAt = new Date(); eventType = 'receiver_confirmed_physical_exchange'; }
    else throw new Error('Only trade participants can confirm the physical exchange.');
    await prisma.trade.update({ where: { id: trade.id }, data: { ...data, events: { create: { eventType, actorUserId: actor.id, actorPlayerId: actor.playerId, message: 'Physical exchange confirmed.' } } } });
    await completeTradeIfReady(trade.id, actor.id);
    revalidatePath('/trades');
  }

  const myInventory = inventory.filter((item) => item.currentOwnerId === proposerId);
  const partnerInventory = inventory.filter((item) => item.currentOwnerId === receiverId);
  const sections = [
    ['My Active Trades', visibleTrades.filter((t) => activeStatuses.includes(t.status) && (t.proposerPlayerId === user.playerId || t.receiverPlayerId === user.playerId))],
    ['Proposed To Me', visibleTrades.filter((t) => t.status === TradeStatus.PROPOSED && t.receiverPlayerId === user.playerId)],
    ['Awaiting Physical Exchange', visibleTrades.filter((t) => physicalStatuses.includes(t.status))],
    ['Completed', visibleTrades.filter((t) => t.status === TradeStatus.COMPLETED)],
    ['Cancelled / Declined', visibleTrades.filter((t) => terminalStatuses.includes(t.status))],
  ] as const;

  return <main className="p-8 space-y-6"><Nav /><h1 className="text-3xl font-bold">Trades</h1>
    <section className="rounded border border-zinc-800 p-4 space-y-3"><h2 className="text-xl font-semibold">Create 1-for-1 Trade Proposal</h2><p className="text-sm text-zinc-400">Trades reserve exactly one offered card and one requested card. Inventory only transfers after both players confirm the physical exchange.</p>
      <form method="get" className="grid md:grid-cols-3 gap-2"><label className="text-sm">Trade round<select name="tradeRoundId" defaultValue={selectedRoundId} className="w-full border p-2 bg-zinc-900">{rounds.map((r) => <option key={r.id} value={r.id}>{r.name} — {r.tradingStatus.toLowerCase()} — limit {r.maxTradesPerOpponent}</option>)}</select></label>{isAdmin ? <label className="text-sm">Proposer<select name="proposerId" defaultValue={proposerId} className="w-full border p-2 bg-zinc-900">{players.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}</select></label> : null}<label className="text-sm">Trade partner<select name="receiverId" defaultValue={receiverId} className="w-full border p-2 bg-zinc-900">{players.filter((p) => p.id !== proposerId).map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}</select></label><button className="border px-3 py-2 md:self-end">Load cards</button></form>
      <form action={createTrade} className="grid md:grid-cols-2 gap-3"><input type="hidden" name="tradeRoundId" value={selectedRoundId} /><input type="hidden" name="receiverPlayerId" value={receiverId} />{isAdmin ? <input type="hidden" name="proposerPlayerId" value={proposerId} /> : null}<label className="text-sm">One card I am offering<select name="offeredInventoryItemId" required className="w-full border p-2 bg-zinc-900">{myInventory.map((item) => <option key={item.id} disabled={available(item.id, item.quantity) < 1} value={item.id}>{itemLabel(item)} • available {available(item.id, item.quantity)}</option>)}</select></label><label className="text-sm">One card I am requesting<select name="requestedInventoryItemId" required className="w-full border p-2 bg-zinc-900">{partnerInventory.map((item) => <option key={item.id} disabled={available(item.id, item.quantity) < 1} value={item.id}>{itemLabel(item)} • available {available(item.id, item.quantity)}</option>)}</select></label><label className="text-sm md:col-span-2">Message / notes<textarea name="message" className="w-full border p-2 bg-zinc-900" /></label><button className="border px-3 py-2 md:col-span-2">Submit Proposal</button></form>
    </section>

    {sections.map(([title, trades]) => <section key={title} className="space-y-3"><h2 className="text-xl font-semibold">{title}</h2>{trades.length ? trades.map((trade) => { const other = trade.proposerPlayerId === user.playerId ? trade.receiverPlayer : trade.proposerPlayer; const needsReceiver = trade.status === TradeStatus.PROPOSED && trade.receiverPlayerId === user.playerId; const needsPhysical = physicalStatuses.includes(trade.status) && ((trade.proposerPlayerId === user.playerId && !trade.proposerCommittedAt) || (trade.receiverPlayerId === user.playerId && !trade.receiverCommittedAt)); return <article key={trade.id} className="rounded border border-zinc-800 p-4 space-y-3"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">{trade.tradeRound.name}: {trade.proposerPlayer.displayName} ↔ {trade.receiverPlayer.displayName}</h3><p className="text-sm text-zinc-400">Status: {statusLabel(trade.status)} • Proposed {trade.proposedAt.toLocaleString()} {other ? `• Other player: ${other.displayName}` : ''}</p>{needsReceiver || needsPhysical ? <span className="inline-block rounded border border-amber-700 px-2 py-1 text-xs text-amber-200">Action needed</span> : null}</div>{trade.message ? <p className="text-sm text-zinc-300">{trade.message}</p> : null}</div><div className="grid md:grid-cols-2 gap-3"><div className="flex gap-3 rounded border border-zinc-900 p-2">{cardImage(trade.offeredInventoryItem) ? <img src={cardImage(trade.offeredInventoryItem)} alt="" className="h-24 rounded" /> : null}<div><div className="text-xs text-zinc-400">Offered by {trade.proposerPlayer.displayName}</div><div>{trade.offeredInventoryItem.card.name}</div><div className="text-xs text-zinc-400">qty 1 • {trade.offeredInventoryItem.round.name}</div></div></div><div className="flex gap-3 rounded border border-zinc-900 p-2">{cardImage(trade.requestedInventoryItem) ? <img src={cardImage(trade.requestedInventoryItem)} alt="" className="h-24 rounded" /> : null}<div><div className="text-xs text-zinc-400">Requested from {trade.receiverPlayer.displayName}</div><div>{trade.requestedInventoryItem.card.name}</div><div className="text-xs text-zinc-400">qty 1 • {trade.requestedInventoryItem.round.name}</div></div></div></div><details className="text-sm"><summary className="cursor-pointer">Timeline</summary><div className="mt-2 space-y-1">{trade.events.map((event) => <div key={event.id} className="border-l border-zinc-700 pl-2"><span className="font-semibold">{event.eventType}</span> — {event.createdAt.toLocaleString()} {event.actorPlayer ? `by ${event.actorPlayer.displayName}` : event.actorUser ? `by ${event.actorUser.username}` : ''}<div className="text-zinc-400">{event.message}</div></div>)}</div></details><div className="flex flex-wrap gap-2">{trade.status === TradeStatus.PROPOSED && (trade.receiverPlayerId === user.playerId || isAdmin) ? <><form action={actOnTrade}><input type="hidden" name="tradeId" value={trade.id} /><button name="action" value="accept" className="border px-3 py-2">Accept</button></form><form action={actOnTrade}><input type="hidden" name="tradeId" value={trade.id} /><button name="action" value="decline" className="border px-3 py-2">Decline</button></form></> : null}{trade.status === TradeStatus.PROPOSED && (trade.proposerPlayerId === user.playerId || isAdmin) ? <form action={actOnTrade}><input type="hidden" name="tradeId" value={trade.id} /><input type="hidden" name="reason" value="Cancelled by proposer." /><button name="action" value="cancel" className="border px-3 py-2">Cancel</button></form> : null}{physicalStatuses.includes(trade.status) && (trade.proposerPlayerId === user.playerId || trade.receiverPlayerId === user.playerId) ? <form action={confirmPhysicalTrade}><input type="hidden" name="tradeId" value={trade.id} /><button className="border px-3 py-2">Confirm Physical Trade</button></form> : null}{isAdmin && !terminalStatuses.includes(trade.status) ? <><form action={actOnTrade} className="flex gap-1"><input type="hidden" name="tradeId" value={trade.id} /><input name="reason" required placeholder="admin cancel reason" className="border p-2 bg-zinc-900" /><button name="action" value="cancel" className="border px-3 py-2">Admin Cancel</button></form><form action={confirmPhysicalTrade} className="flex gap-1"><input type="hidden" name="tradeId" value={trade.id} /><input type="hidden" name="forceComplete" value="1" /><input name="reason" required placeholder="force complete reason" className="border p-2 bg-zinc-900" /><button className="border px-3 py-2">Force Complete</button></form></> : null}</div></article>; }) : <p className="text-sm text-zinc-400">No trades in this section.</p>}</section>)}
  </main>;
}
