'use server';

import { prisma } from '@/lib/prisma';
import { isAdminUser, requireLogin } from '@/lib/auth';
import { InventorySourceType, TradeStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const activeStatuses: TradeStatus[] = [TradeStatus.PROPOSED, TradeStatus.ACCEPTED_PENDING_EXCHANGE, TradeStatus.PARTIALLY_COMMITTED];
const limitStatuses: TradeStatus[] = [...activeStatuses, TradeStatus.COMPLETED];
const terminalStatuses: TradeStatus[] = [TradeStatus.COMPLETED, TradeStatus.DECLINED, TradeStatus.CANCELLED, TradeStatus.CANCELED];
const physicalStatuses: TradeStatus[] = [TradeStatus.ACCEPTED_PENDING_EXCHANGE, TradeStatus.PARTIALLY_COMMITTED];

type ProposedTradeData = { tradeRoundId: string; proposerPlayerId: string; receiverPlayerId: string; offeredInventoryItemId: string; requestedInventoryItemId: string };
type InventoryForSnapshot = Awaited<ReturnType<typeof validateProposedTrade>>['offered'];

function inventorySnapshot(item: InventoryForSnapshot) {
  return {
    id: item.id,
    cardId: item.cardId,
    cardName: item.card.name,
    setCode: item.card.setCode,
    collectorNumber: item.card.collectorNumber,
    imageUri: item.card.imageUri,
    imageUris: item.card.imageUris,
    quantity: item.quantity,
    foil: item.foil,
    foilStatus: item.foilStatus,
    condition: item.condition,
    language: item.language,
    sourceType: item.sourceType,
    notes: item.notes,
    currentOwnerId: item.currentOwnerId,
    currentOwnerName: item.currentOwner.displayName,
    originalOpenerId: item.originalOpenerId,
    roundId: item.roundId,
    roundName: item.round.name,
  };
}

async function validateProposedTrade(data: ProposedTradeData) {
  if (data.proposerPlayerId === data.receiverPlayerId) throw new Error('Proposer and receiver must be different players.');
  if (data.offeredInventoryItemId === data.requestedInventoryItemId) throw new Error('Trades must be exactly one card for one card.');
  const [round, offered, requested] = await Promise.all([
    prisma.round.findUnique({ where: { id: data.tradeRoundId } }),
    prisma.inventoryItem.findUnique({ where: { id: data.offeredInventoryItemId }, include: { currentOwner: true, originalOpener: true, round: true, card: true } }),
    prisma.inventoryItem.findUnique({ where: { id: data.requestedInventoryItemId }, include: { currentOwner: true, originalOpener: true, round: true, card: true } }),
  ]);
  if (!round || !round.tradingEnabled || round.tradingStatus !== 'OPEN') throw new Error('Trading is closed for this round.');
  if (!offered || offered.currentOwnerId !== data.proposerPlayerId) throw new Error('You can only offer cards from your own inventory.');
  if (!requested || requested.currentOwnerId !== data.receiverPlayerId) throw new Error('You can only request cards from the selected trade partner.');
  if (offered.quantity < 1 || requested.quantity < 1) throw new Error('Both selected cards must have available quantity.');
  const reservationRows = await prisma.trade.findMany({ where: { status: { in: activeStatuses }, OR: [{ offeredInventoryItemId: { in: [offered.id, requested.id] } }, { requestedInventoryItemId: { in: [offered.id, requested.id] } }] }, select: { offeredInventoryItemId: true, requestedInventoryItemId: true } });
  const reservationCount = (id: string) => reservationRows.filter((t) => t.offeredInventoryItemId === id || t.requestedInventoryItemId === id).length;
  if (offered.quantity - reservationCount(offered.id) < 1 || requested.quantity - reservationCount(requested.id) < 1) throw new Error('That card is already reserved in another active trade.');
  if (!round.allowFutureRoundCards && (offered.round.monthNumber > round.monthNumber || requested.round.monthNumber > round.monthNumber)) throw new Error('Cards opened for a future round cannot be traded yet.');
  const used = await prisma.trade.count({ where: { tradeRoundId: round.id, status: { in: limitStatuses }, OR: [{ proposerPlayerId: data.proposerPlayerId, receiverPlayerId: data.receiverPlayerId }, { proposerPlayerId: data.receiverPlayerId, receiverPlayerId: data.proposerPlayerId }] } });
  if (used >= round.maxTradesPerOpponent) throw new Error(`This trade would exceed your trade limit with this player for the selected round. Used ${used} of ${round.maxTradesPerOpponent}.`);
  return { round, offered, requested };
}

async function loadTradeForAction(tradeId: string) {
  const trade = await prisma.trade.findUnique({ where: { id: tradeId }, include: { proposerPlayer: true, receiverPlayer: true, tradeRound: true, offeredInventoryItem: { include: { card: true, currentOwner: true, originalOpener: true, round: true, auditLogs: true } }, requestedInventoryItem: { include: { card: true, currentOwner: true, originalOpener: true, round: true, auditLogs: true } } } });
  if (!trade) throw new Error('Trade not found.');
  return trade;
}

export async function createTrade(fd: FormData) {
  const actor = await requireLogin();
  const actorIsAdmin = isAdminUser(actor, actor.player);
  const proposerPlayerId = actorIsAdmin ? String(fd.get('proposerPlayerId') || '') : actor.playerId!;
  if (!actorIsAdmin && proposerPlayerId !== actor.playerId) throw new Error('Players cannot propose trades for another player.');
  const data = { tradeRoundId: String(fd.get('tradeRoundId') || ''), proposerPlayerId, receiverPlayerId: String(fd.get('receiverPlayerId') || ''), offeredInventoryItemId: String(fd.get('offeredInventoryItemId') || ''), requestedInventoryItemId: String(fd.get('requestedInventoryItemId') || '') };
  const { offered, requested } = await validateProposedTrade(data);
  await prisma.trade.create({ data: { ...data, offeredSnapshotJson: inventorySnapshot(offered), requestedSnapshotJson: inventorySnapshot(requested), status: TradeStatus.PROPOSED, message: String(fd.get('message') || '') || null, createdByUserId: actor.id, events: { create: { eventType: 'proposed', actorUserId: actor.id, actorPlayerId: proposerPlayerId, message: 'Trade proposed.' } } } });
  revalidatePath('/trades');
}

export async function actOnTrade(fd: FormData) {
  const actor = await requireLogin();
  const actorIsAdmin = isAdminUser(actor, actor.player);
  const tradeId = String(fd.get('tradeId') || '');
  const action = String(fd.get('action') || '');
  const trade = await loadTradeForAction(tradeId);
  if (!actorIsAdmin && actor.playerId !== trade.proposerPlayerId && actor.playerId !== trade.receiverPlayerId) throw new Error('You cannot act on another player\'s trade.');
  const now = new Date();
  if (action === 'accept') {
    if (actor.playerId !== trade.receiverPlayerId) throw new Error('Only the receiver can accept this trade.');
    if (trade.status !== TradeStatus.PROPOSED) throw new Error('Only proposed trades can be accepted.');
    await prisma.trade.update({ where: { id: trade.id }, data: { status: TradeStatus.ACCEPTED_PENDING_EXCHANGE, acceptedAt: now, events: { create: { eventType: 'accepted', actorUserId: actor.id, actorPlayerId: actor.playerId, message: 'Trade accepted; awaiting physical exchange.' } } } });
  } else if (action === 'decline') {
    if (actor.playerId !== trade.receiverPlayerId) throw new Error('Only the receiver can decline this trade.');
    if (trade.status !== TradeStatus.PROPOSED) throw new Error('Only proposed trades can be declined.');
    await prisma.trade.update({ where: { id: trade.id }, data: { status: TradeStatus.DECLINED, declinedAt: now, events: { create: { eventType: 'declined', actorUserId: actor.id, actorPlayerId: actor.playerId, message: String(fd.get('reason') || 'Trade declined.') } } } });
  } else if (action === 'cancel') {
    if (!actorIsAdmin && actor.playerId !== trade.proposerPlayerId) throw new Error('Only the proposer can cancel this trade.');
    if (!actorIsAdmin && trade.status !== TradeStatus.PROPOSED) throw new Error('Only proposed trades can be cancelled by the proposer.');
    if (terminalStatuses.includes(trade.status)) throw new Error('This trade can no longer be cancelled.');
    const reason = String(fd.get('reason') || 'Trade cancelled.');
    await prisma.trade.update({ where: { id: trade.id }, data: { status: TradeStatus.CANCELLED, cancelledAt: now, events: { create: { eventType: actorIsAdmin && actor.playerId !== trade.proposerPlayerId ? 'admin_cancelled' : 'cancelled', actorUserId: actor.id, actorPlayerId: actor.playerId, message: reason } } } });
  } else {
    throw new Error('Unknown trade action.');
  }
  revalidatePath('/trades');
}

async function removeFromSource(tx: any, tradeId: string, item: NonNullable<Awaited<ReturnType<typeof loadTradeForAction>>['offeredInventoryItem']>, actorUserId: string, reason: string) {
  const beforeJson = { ...item } as any;
  if (item.quantity > 1) {
    const updated = await tx.inventoryItem.update({ where: { id: item.id }, data: { quantity: { decrement: 1 } } });
    await tx.inventoryAuditLog.create({ data: { inventoryItemId: updated.id, changedByUserId: actorUserId, tradeId, changeType: 'trade_completed', beforeJson, afterJson: updated as any, reason } });
    return;
  }
  await tx.inventoryAuditLog.create({ data: { inventoryItemId: item.id, changedByUserId: actorUserId, tradeId, changeType: 'trade_completed', beforeJson, afterJson: { ...beforeJson, quantity: 0, deleted: true }, reason } });
  await tx.inventoryItem.delete({ where: { id: item.id } });
}

async function addToReceiver(tx: any, tradeId: string, item: NonNullable<Awaited<ReturnType<typeof loadTradeForAction>>['offeredInventoryItem']>, toPlayerId: string, actorUserId: string, reason: string) {
  const existing = await tx.inventoryItem.findFirst({ where: { currentOwnerId: toPlayerId, originalOpenerId: item.originalOpenerId, cardId: item.cardId, foil: item.foil, foilStatus: item.foilStatus, condition: item.condition, language: item.language, roundId: item.roundId, quantity: { gt: 0 } } });
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
  if (!trade.offeredInventoryItem || !trade.requestedInventoryItem) throw new Error('One of the traded cards is no longer available.');
  const reason = `Completed trade between ${trade.proposerPlayer.displayName} and ${trade.receiverPlayer.displayName}`;
  await prisma.$transaction(async (tx) => {
    const offered = await tx.inventoryItem.findUnique({ where: { id: trade.offeredInventoryItem!.id }, include: { card: true, currentOwner: true, originalOpener: true, round: true, auditLogs: true } });
    const requested = await tx.inventoryItem.findUnique({ where: { id: trade.requestedInventoryItem!.id }, include: { card: true, currentOwner: true, originalOpener: true, round: true, auditLogs: true } });
    if (!offered || !requested || offered.quantity < 1 || requested.quantity < 1) throw new Error('One of the traded cards is no longer available.');
    await removeFromSource(tx, tradeId, offered as any, actorUserId, reason);
    await removeFromSource(tx, tradeId, requested as any, actorUserId, reason);
    await addToReceiver(tx, tradeId, offered as any, trade.receiverPlayerId, actorUserId, reason);
    await addToReceiver(tx, tradeId, requested as any, trade.proposerPlayerId, actorUserId, reason);
    await tx.trade.update({ where: { id: tradeId }, data: { status: TradeStatus.COMPLETED, completedAt: new Date(), proposerCommittedAt: trade.proposerCommittedAt ?? new Date(), receiverCommittedAt: trade.receiverCommittedAt ?? new Date(), events: { create: { eventType: 'completed', actorUserId, message: reason } } } });
  });
}

export async function confirmPhysicalTrade(fd: FormData) {
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
  if (actor.playerId === trade.proposerPlayerId) {
    if (trade.proposerCommittedAt) throw new Error('You have already confirmed this physical exchange.');
    data.proposerCommittedAt = new Date();
    eventType = 'proposer_confirmed_physical_exchange';
  } else if (actor.playerId === trade.receiverPlayerId) {
    if (trade.receiverCommittedAt) throw new Error('You have already confirmed this physical exchange.');
    data.receiverCommittedAt = new Date();
    eventType = 'receiver_confirmed_physical_exchange';
  } else {
    throw new Error('Only trade participants can confirm the physical exchange.');
  }
  await prisma.trade.update({ where: { id: trade.id }, data: { ...data, events: { create: { eventType, actorUserId: actor.id, actorPlayerId: actor.playerId, message: 'Physical exchange confirmed.' } } } });
  await completeTradeIfReady(trade.id, actor.id);
  revalidatePath('/trades');
}
