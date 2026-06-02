import Papa from 'papaparse';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { FoilStatus, InventorySourceType } from '@prisma/client';
import { Nav } from '@/components/Nav';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findOrImportCard } from '@/lib/card-import';

const aliases: Record<string, string[]> = {
  quantity: ['quantity', 'count', 'qty', 'copies'],
  name: ['name', 'card name'],
  setCode: ['set', 'set code', 'edition'],
  collectorNumber: ['collector number', 'collector #', 'number', 'cn'],
  foil: ['foil', 'foil status', 'finish'],
  condition: ['condition'],
  language: ['language', 'lang'],
  notes: ['notes', 'comment', 'tag', 'tags'],
  scryfallId: ['scryfall id', 'scryfallid', 'scryfall_id'],
};

type ParsedRow = {
  quantity: number;
  name: string;
  setCode?: string;
  collectorNumber?: string;
  foilRaw?: string;
  foilStatus: FoilStatus;
  condition: string;
  language: string;
  notes?: string;
  scryfallId?: string;
  warning?: string;
};

function norm(value: string) { return value.trim().toLowerCase(); }
function getCell(row: Record<string, string>, key: keyof typeof aliases) {
  const wanted = aliases[key];
  const found = Object.entries(row).find(([header]) => wanted.includes(norm(header)));
  return found ? String(found[1] ?? '').trim() : '';
}
function parseFoil(value: string) {
  const v = norm(value);
  if (!v || ['nonfoil', 'non-foil', 'regular', 'normal', 'false', 'no', 'n', '0'].includes(v)) return { status: FoilStatus.NONFOIL, warning: '' };
  if (['foil', 'foiled', 'true', 'yes', 'y', '1'].includes(v)) return { status: FoilStatus.FOIL, warning: '' };
  if (['etched', 'etched foil', 'foil etched'].includes(v)) return { status: FoilStatus.ETCHED, warning: '' };
  return { status: FoilStatus.NONFOIL, warning: `Invalid foil value "${value}"; defaulted to NONFOIL.` };
}
function parseCondition(value: string) {
  const v = norm(value);
  if (!v) return 'NM';
  const map: Record<string, string> = {
    nm: 'NM',
    'near mint': 'NM',
    nearmint: 'NM',
    lp: 'LP',
    'lightly played': 'LP',
    lightlyplayed: 'LP',
    sp: 'LP',
    'slightly played': 'LP',
    mp: 'MP',
    'moderately played': 'MP',
    moderatelyplayed: 'MP',
    hp: 'HP',
    'heavily played': 'HP',
    heavilyplayed: 'HP',
    dmg: 'DMG',
    damaged: 'DMG',
    poor: 'DMG',
  };
  return map[v] ?? value.trim().toUpperCase();
}
function parseLanguage(value: string) {
  const v = norm(value);
  if (!v) return 'EN';
  const map: Record<string, string> = {
    en: 'EN', english: 'EN',
    ja: 'JA', japanese: 'JA',
    de: 'DE', german: 'DE',
    fr: 'FR', french: 'FR',
    es: 'ES', spanish: 'ES',
    it: 'IT', italian: 'IT',
    pt: 'PT', portuguese: 'PT',
    ru: 'RU', russian: 'RU',
    ko: 'KO', korean: 'KO',
    'zhs': 'ZHS', 'simplified chinese': 'ZHS',
    'zht': 'ZHT', 'traditional chinese': 'ZHT',
  };
  return map[v] ?? value.trim().toUpperCase();
}
function parseRow(row: Record<string, string>, rowNumber: number): ParsedRow & { error?: string } {
  const quantityRaw = getCell(row, 'quantity');
  const quantity = Number(quantityRaw || '0');
  const name = getCell(row, 'name');
  const foilRaw = getCell(row, 'foil');
  const foil = parseFoil(foilRaw);
  const conditionRaw = getCell(row, 'condition');
  const condition = parseCondition(conditionRaw);
  const language = parseLanguage(getCell(row, 'language'));
  const errors = [];
  if (!Number.isInteger(quantity) || quantity <= 0) errors.push('Quantity must be a positive integer.');
  if (!name) errors.push('Name is required.');
  return {
    quantity,
    name,
    setCode: getCell(row, 'setCode').toLowerCase() || undefined,
    collectorNumber: getCell(row, 'collectorNumber') || undefined,
    foilRaw,
    foilStatus: foil.status,
    condition,
    language,
    notes: getCell(row, 'notes') || undefined,
    scryfallId: getCell(row, 'scryfallId') || undefined,
    warning: foil.warning || undefined,
    error: errors.length ? `Row ${rowNumber}: ${errors.join(' ')}` : undefined,
  };
}
function isAdminUser(user: { username: string }, player?: { isAdmin: boolean } | null) {
  return user.username === (process.env.ADMIN_USERNAME || 'admin') || Boolean(player?.isAdmin);
}
function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export default async function ImportsPage({ searchParams }: { searchParams: Promise<{ batchId?: string }> }) {
  const user = await requireAuth();
  const userWithPlayer = await prisma.user.findUnique({ where: { id: user.id }, include: { player: true } });
  const isAdmin = isAdminUser(user, userWithPlayer?.player);
  const params = await searchParams;
  const players = await prisma.player.findMany({ where: { active: true }, orderBy: { displayName: 'asc' } });
  const rounds = await prisma.round.findMany({ orderBy: { startDate: 'desc' } });
  const defaultPlayer = userWithPlayer?.player ?? players[0];

  async function previewImport(fd: FormData) {
    'use server';
    const actionUser = await requireAuth();
    const actionUserWithPlayer = await prisma.user.findUnique({ where: { id: actionUser.id }, include: { player: true } });
    const actionIsAdmin = isAdminUser(actionUser, actionUserWithPlayer?.player);
    if (!actionIsAdmin && !actionUserWithPlayer?.playerId) throw new Error('Your login is not linked to a player. Ask an admin to link your account before importing.');
    const selectedPlayerId = actionIsAdmin ? String(fd.get('selectedPlayerId') || '') : String(actionUserWithPlayer!.playerId);
    const selectedOriginalOpenerId = actionIsAdmin ? String(fd.get('selectedOriginalOpenerId') || selectedPlayerId) : String(actionUserWithPlayer!.playerId);
    const selectedRoundId = String(fd.get('selectedRoundId') || '');
    const file = fd.get('csvFile') as File | null;
    const duplicateBehavior = ['add', 'separate', 'preview'].includes(String(fd.get('duplicateBehavior'))) ? String(fd.get('duplicateBehavior')) : 'add';
    if (!selectedPlayerId || !selectedOriginalOpenerId || !selectedRoundId || !file) throw new Error('Player, opener, round, and CSV file are required.');
    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim(), transform: (v) => String(v ?? '').trim() });
    if (parsed.errors.length) throw new Error(parsed.errors.map((e) => e.message).join('; '));

    const rows = parsed.data;
    const batch = await prisma.importBatch.create({ data: { importType: `pull_csv:${duplicateBehavior}`, filename: file.name || 'pull-import.csv', selectedPlayerId, selectedOriginalOpenerId, selectedRoundId, status: 'PREVIEW', totalRows: rows.length, createdByUserId: actionUser.id } });
    let matchedRows = 0, warningRows = 0, errorRows = 0;
    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const parsedRow = parseRow(row, rowNumber);
      let status = 'unmatched';
      let message = parsedRow.error || '';
      let cardId: string | undefined;
      if (parsedRow.error) {
        errorRows++;
      } else {
        const match = await findOrImportCard(parsedRow);
        status = match.status;
        message = [match.message, parsedRow.warning].filter(Boolean).join(' ');
        cardId = match.card?.id;
        if (match.status === 'matched' || match.status === 'new') matchedRows++;
        if (match.status === 'ambiguous' || match.status === 'unmatched') errorRows++;
      }
      if (parsedRow.warning) warningRows++;
      await prisma.importBatchItem.create({ data: { importBatchId: batch.id, rowNumber, rawRowJson: jsonSafe(row), parsedRowJson: jsonSafe(parsedRow), status, message: message || null, cardPrintingId: cardId, parsedFoilStatus: parsedRow.foilStatus, parsedCondition: parsedRow.condition } });
    }
    await prisma.importBatch.update({ where: { id: batch.id }, data: { matchedRows, warningRows, errorRows } });
    redirect(`/imports?batchId=${batch.id}`);
  }

  async function confirmImport(fd: FormData) {
    'use server';
    const actionUser = await requireAuth();
    const actionUserWithPlayer = await prisma.user.findUnique({ where: { id: actionUser.id }, include: { player: true } });
    const actionIsAdmin = isAdminUser(actionUser, actionUserWithPlayer?.player);
    const batchId = String(fd.get('batchId'));
    const skipUnresolved = fd.get('skipUnresolved') === 'on';
    const batch = await prisma.importBatch.findUnique({ where: { id: batchId }, include: { items: true } });
    if (!batch) throw new Error('Import batch not found.');
    if (!actionIsAdmin && batch.selectedPlayerId !== actionUserWithPlayer?.playerId) throw new Error('Not authorized for this import batch.');
    const duplicateBehavior = batch.importType.split(':')[1] || 'add';
    if (duplicateBehavior === 'preview') throw new Error('This batch was created as preview only. Upload again with an import duplicate behavior to commit it.');
    const unresolved = batch.items.filter((item) => item.status !== 'matched' && item.status !== 'new');
    if (unresolved.length && !skipUnresolved) throw new Error('Resolve or skip unmatched/ambiguous rows before confirming.');
    let skippedRows = 0, committedRows = 0;
    for (const item of batch.items) {
      if (!item.cardPrintingId || (item.status !== 'matched' && item.status !== 'new')) { skippedRows++; continue; }
      const parsedRow = item.parsedRowJson as ParsedRow;
      const foilStatus = (item.parsedFoilStatus || parsedRow.foilStatus || 'NONFOIL') as FoilStatus;
      const condition = item.parsedCondition || parsedRow.condition || 'NM';
      const pull = await prisma.pull.create({ data: { roundId: batch.selectedRoundId, playerId: batch.selectedOriginalOpenerId, cardId: item.cardPrintingId, quantity: parsedRow.quantity, foil: foilStatus !== FoilStatus.NONFOIL, condition, notes: parsedRow.notes || null } });
      const uniqueWhere = { currentOwnerId_originalOpenerId_cardId_foil_condition_roundId: { currentOwnerId: batch.selectedPlayerId, originalOpenerId: batch.selectedOriginalOpenerId, cardId: item.cardPrintingId, foil: foilStatus !== FoilStatus.NONFOIL, condition, roundId: batch.selectedRoundId } };
      const createData = { currentOwnerId: batch.selectedPlayerId, originalOpenerId: batch.selectedOriginalOpenerId, cardId: item.cardPrintingId, quantity: parsedRow.quantity, foil: foilStatus !== FoilStatus.NONFOIL, foilStatus, condition, acquiredFromPullId: pull.id, roundId: batch.selectedRoundId, notes: parsedRow.notes || null, sourceType: InventorySourceType.CSV_PULL_IMPORT, language: parsedRow.language || 'EN' };
      const existingInventory = duplicateBehavior === 'separate' ? await prisma.inventoryItem.findUnique({ where: uniqueWhere }) : null;
      const inventory = duplicateBehavior === 'separate' && !existingInventory
        ? await prisma.inventoryItem.create({ data: createData })
        : await prisma.inventoryItem.upsert({ where: uniqueWhere, update: { quantity: { increment: parsedRow.quantity }, notes: parsedRow.notes || undefined, sourceType: InventorySourceType.CSV_PULL_IMPORT, language: parsedRow.language || 'EN' }, create: createData });
      await prisma.importBatchItem.update({ where: { id: item.id }, data: { status: 'imported', inventoryItemId: inventory.id, pullId: pull.id } });
      committedRows++;
    }
    await prisma.importBatch.update({ where: { id: batch.id }, data: { status: 'IMPORTED', skippedRows, matchedRows: committedRows } });
    revalidatePath('/imports');
    revalidatePath('/inventory');
    redirect(`/imports?batchId=${batch.id}`);
  }

  const selectedBatch = params.batchId ? await prisma.importBatch.findUnique({ where: { id: params.batchId }, include: { selectedPlayer: true, selectedOriginalOpener: true, selectedRound: true, items: { include: { cardPrinting: true }, orderBy: { rowNumber: 'asc' } } } }) : null;
  if (selectedBatch && !isAdmin && selectedBatch.selectedPlayerId !== userWithPlayer?.playerId) redirect('/imports');
  const historyWhere = isAdmin ? {} : { selectedPlayerId: userWithPlayer?.playerId ?? '__none__' };
  const history = await prisma.importBatch.findMany({ where: historyWhere, include: { selectedPlayer: true, selectedRound: true }, orderBy: { createdAt: 'desc' }, take: 25 });

  return <main className="p-8 space-y-6"><Nav /><div className="flex items-center justify-between gap-3"><h1 className="text-3xl font-bold">Imports</h1><a className="border px-3 py-2" href="/api/imports/sample">Download sample pull import CSV</a></div>
    <section className="border border-zinc-800 rounded p-4 space-y-3"><h2 className="text-xl font-semibold">Pull CSV Import</h2>
      <p className="text-sm text-zinc-400">Accepts the Box League sample columns or Moxfield collection exports with Count, Name, Edition, Condition, Language, Foil, and Collector Number columns.</p>
      {!isAdmin && defaultPlayer ? <p className="text-sm text-zinc-300">Importing pulls for: <strong>{defaultPlayer.displayName}</strong></p> : null}
      <form action={previewImport} className="grid md:grid-cols-2 gap-3" encType="multipart/form-data">
        {isAdmin ? <><label className="text-sm">Current owner<select name="selectedPlayerId" defaultValue={defaultPlayer?.id} className="w-full border p-2 bg-zinc-900">{players.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}</select></label><label className="text-sm">Original opener<select name="selectedOriginalOpenerId" defaultValue={defaultPlayer?.id} className="w-full border p-2 bg-zinc-900">{players.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}</select></label></> : <><input type="hidden" name="selectedPlayerId" value={defaultPlayer?.id ?? ''} /><input type="hidden" name="selectedOriginalOpenerId" value={defaultPlayer?.id ?? ''} /></>}
        <label className="text-sm">Round opened<select name="selectedRoundId" className="w-full border p-2 bg-zinc-900">{rounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label className="text-sm">Duplicate behavior<select name="duplicateBehavior" className="w-full border p-2 bg-zinc-900"><option value="add">Add quantities to existing matching inventory item</option><option value="separate">Create separate inventory rows where possible</option><option value="preview">Preview only</option></select></label>
        <label className="text-sm md:col-span-2">CSV file<input name="csvFile" type="file" accept=".csv,text/csv" required className="w-full border p-2 bg-zinc-900" /></label>
        <button className="border px-3 py-2 md:col-span-2">Preview Import</button>
      </form>
    </section>

    {selectedBatch ? <section className="border border-zinc-800 rounded p-4 space-y-3"><h2 className="text-xl font-semibold">Preview: {selectedBatch.filename}</h2><p className="text-sm text-zinc-400">Player: {selectedBatch.selectedPlayer.displayName} • Round: {selectedBatch.selectedRound.name} • Status: {selectedBatch.status}</p>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-zinc-800"><th>Row</th><th>Qty</th><th>Imported Name</th><th>Matched Card</th><th>Set</th><th>#</th><th>Foil Raw</th><th>Foil Status</th><th>Condition Raw</th><th>Condition</th><th>Language</th><th>Status</th><th>Warning/Message</th></tr></thead><tbody>{selectedBatch.items.map(item => { const parsed = item.parsedRowJson as any; return <tr key={item.id} className="border-b border-zinc-900"><td>{item.rowNumber}</td><td>{parsed.quantity}</td><td>{parsed.name}</td><td>{item.cardPrinting?.name ?? '—'}</td><td>{item.cardPrinting?.setCode?.toUpperCase() ?? parsed.setCode ?? '—'}</td><td>{item.cardPrinting?.collectorNumber ?? parsed.collectorNumber ?? '—'}</td><td>{parsed.foilRaw ?? ''}</td><td>{item.parsedFoilStatus}</td><td>{parsed.condition ?? ''}</td><td>{item.parsedCondition}</td><td>{parsed.language}</td><td>{item.status}</td><td>{item.message ?? parsed.warning ?? ''}</td></tr>; })}</tbody></table></div>
      {selectedBatch.status === 'PREVIEW' && !selectedBatch.importType.endsWith(':preview') ? <form action={confirmImport} className="flex gap-3 items-center"><input type="hidden" name="batchId" value={selectedBatch.id} /><label><input name="skipUnresolved" type="checkbox" /> skip unresolved rows during commit</label><button className="border px-3 py-2">Confirm Import</button></form> : null}
      {selectedBatch.importType.endsWith(':preview') ? <p className="text-sm text-amber-300">This batch is preview only. Upload it again with an import behavior to commit records.</p> : null}
    </section> : null}

    <section className="space-y-2"><h2 className="text-xl font-semibold">Import History</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-zinc-800"><th>Filename</th><th>Date</th><th>Player</th><th>Round</th><th>Total</th><th>Matched</th><th>Skipped</th><th>Warnings</th><th>Status</th></tr></thead><tbody>{history.map(batch => <tr key={batch.id} className="border-b border-zinc-900"><td><a className="underline" href={`/imports?batchId=${batch.id}`}>{batch.filename}</a></td><td>{batch.createdAt.toLocaleString()}</td><td>{batch.selectedPlayer.displayName}</td><td>{batch.selectedRound.name}</td><td>{batch.totalRows}</td><td>{batch.matchedRows}</td><td>{batch.skippedRows}</td><td>{batch.warningRows}</td><td>{batch.status}</td></tr>)}</tbody></table></div></section>
  </main>;
}
