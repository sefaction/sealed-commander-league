'use client';

import { useMemo, useState } from 'react';
import { ColumnDef, flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, SortingState, useReactTable, VisibilityState } from '@tanstack/react-table';

export type InventoryRow = {
  id: string;
  cardName: string;
  quantity: number;
  currentOwner: string;
  originalOpener: string;
  setCode: string;
  setName?: string;
  rarity: string;
  manaCost?: string;
  manaValue?: number;
  typeLine: string;
  colorIdentity: string;
  priceUsd?: string;
  priceUsdFoil?: string;
  foil: boolean;
  roundOpened: string;
  oracleText?: string;
  powerToughness?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  defense?: string;
  colors?: string;
  legalities?: Record<string, string>;
  artist?: string;
  collectorNumber?: string;
  keywords?: string;
  notes?: string;
  imageUri?: string;
  imageSmall?: string;
  scryfallUri?: string;
  condition?: string;
  priceUsdEtched?: string;
  priceEur?: string;
  priceEurFoil?: string;
  priceTix?: string;
};

type ViewMode = 'table' | 'binder';
type CardSize = 'small' | 'medium' | 'large';

const defaults: VisibilityState = { cardName:true, quantity:true, currentOwner:true, originalOpener:true, setCode:true, rarity:true, manaCost:true, typeLine:true, colorIdentity:true, priceUsd:true, foil:true, roundOpened:true };

function getCardImage(row: InventoryRow) {
  return row.imageUri || row.imageSmall || '';
}

function CardDetail({ row, onClose }: { row: InventoryRow; onClose: () => void }) {
  const legalities = row.legalities || {};
  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-zinc-950 border-l border-zinc-800 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4"><h2 className="text-xl font-bold">{row.cardName}</h2><button onClick={onClose} className="border px-2">Close</button></div>
        <div className="grid md:grid-cols-[240px_1fr] gap-4">
          <div className="rounded border border-zinc-800 bg-zinc-900 p-2">
            {getCardImage(row) ? <img src={getCardImage(row)} alt={row.cardName} className="w-full rounded" /> : <div className="aspect-[63/88] flex items-center justify-center text-sm text-zinc-400">No image</div>}
          </div>
          <div className="space-y-2 text-sm">
            <p><b>Mana Cost:</b> {row.manaCost || '-'}</p>
            <p><b>Type Line:</b> {row.typeLine}</p>
            <p><b>Oracle Text:</b> {row.oracleText || '-'}</p>
            <p><b>Power/Toughness:</b> {row.powerToughness || '-'}</p>
            <p><b>Loyalty:</b> {row.loyalty || '-'}</p>
            <p><b>Defense:</b> {row.defense || '-'}</p>
            <p><b>Colors:</b> {row.colors || '-'}</p>
            <p><b>Color Identity:</b> {row.colorIdentity || '-'}</p>
            <p><b>Set:</b> {row.setName || '-'} ({row.setCode})</p>
            <p><b>Collector #:</b> {row.collectorNumber || '-'}</p>
            <p><b>Rarity:</b> {row.rarity}</p>
            <p><b>Artist:</b> {row.artist || '-'}</p>
            <p><b>Quantity:</b> {row.quantity}</p>
            <p><b>Current Owner:</b> {row.currentOwner}</p>
            <p><b>Original Opener:</b> {row.originalOpener}</p>
            <p><b>Round Opened:</b> {row.roundOpened}</p>
            <p><b>Foil:</b> {row.foil ? 'Foil' : 'Nonfoil'}</p>
            <p><b>Condition:</b> {row.condition || '-'}</p>
            <p><b>Notes:</b> {row.notes || '-'}</p>
            <p><b>Legalities:</b> CMD {legalities.commander || '-'} | STD {legalities.standard || '-'} | PIO {legalities.pioneer || '-'} | MOD {legalities.modern || '-'} | LEG {legalities.legacy || '-'} | VIN {legalities.vintage || '-'} | PAU {legalities.pauper || '-'}</p>
            <p><b>Prices:</b> USD {row.priceUsd || '-'} / USD Foil {row.priceUsdFoil || '-'} / USD Etched {row.priceUsdEtched || '-'} / EUR {row.priceEur || '-'} / EUR Foil {row.priceEurFoil || '-'} / TIX {row.priceTix || '-'}</p>
            {row.scryfallUri ? <p><a className="underline" href={row.scryfallUri} target="_blank" rel="noreferrer">View on Scryfall</a></p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InventoryBrowser({ rows }: { rows: InventoryRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => (typeof window !== 'undefined' ? (localStorage.getItem('inventoryViewMode') as ViewMode) || 'table' : 'table'));
  const [cardSize, setCardSize] = useState<CardSize>(() => (typeof window !== 'undefined' ? (localStorage.getItem('inventoryCardSize') as CardSize) || 'medium' : 'medium'));
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window === 'undefined') return defaults;
    try { return JSON.parse(localStorage.getItem('inventoryColumns') || 'null') || defaults; } catch { return defaults; }
  });

  const cols = useMemo<ColumnDef<InventoryRow>[]>(() => [
    { accessorKey: 'cardName', header: 'Card Name', cell: ({ row }) => <button className="underline text-left" onClick={() => setSelected(row.original)}>{row.original.cardName}</button> },
    { accessorKey: 'quantity', header: 'Quantity' }, { accessorKey: 'currentOwner', header: 'Current Owner' }, { accessorKey: 'originalOpener', header: 'Original Opener' },
    { accessorKey: 'setCode', header: 'Set' }, { accessorKey: 'setName', header: 'Set Name' }, { accessorKey: 'rarity', header: 'Rarity' }, { accessorKey: 'manaCost', header: 'Mana Cost' },
    { accessorKey: 'manaValue', header: 'Mana Value' }, { accessorKey: 'typeLine', header: 'Type Line' }, { accessorKey: 'colorIdentity', header: 'Color Identity' },
    { accessorKey: 'colors', header: 'Colors' }, { accessorKey: 'foil', header: 'Foil' }, { accessorKey: 'roundOpened', header: 'Round Opened' },
    { accessorKey: 'priceUsd', header: 'Scryfall USD Price' }, { accessorKey: 'priceUsdFoil', header: 'Scryfall Foil Price' }, { accessorKey: 'powerToughness', header: 'Power/Toughness' },
    { accessorKey: 'oracleText', header: 'Oracle Text' }, { accessorKey: 'artist', header: 'Artist' }, { accessorKey: 'collectorNumber', header: 'Collector Number' },
    { accessorKey: 'keywords', header: 'Keywords' }, { accessorKey: 'notes', header: 'Notes' },
  ], []);

  const table = useReactTable({ data: rows, columns: cols, state: { sorting, columnVisibility }, onSortingChange: setSorting, onColumnVisibilityChange: (v) => { const next = typeof v === 'function' ? v(columnVisibility) : v; setColumnVisibility(next); localStorage.setItem('inventoryColumns', JSON.stringify(next)); }, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel() });

  const sizeClass = cardSize === 'small' ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-8' : cardSize === 'large' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6';

  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-sm">View:</span>
      <button className={`border px-2 ${viewMode === 'table' ? 'bg-zinc-800' : ''}`} onClick={() => { setViewMode('table'); localStorage.setItem('inventoryViewMode', 'table'); }}>Table View</button>
      <button className={`border px-2 ${viewMode === 'binder' ? 'bg-zinc-800' : ''}`} onClick={() => { setViewMode('binder'); localStorage.setItem('inventoryViewMode', 'binder'); }}>Binder View</button>
      {viewMode === 'binder' ? <>
        <span className="text-sm ml-4">Card Size:</span>
        <button className={`border px-2 ${cardSize === 'small' ? 'bg-zinc-800' : ''}`} onClick={() => { setCardSize('small'); localStorage.setItem('inventoryCardSize', 'small'); }}>Small</button>
        <button className={`border px-2 ${cardSize === 'medium' ? 'bg-zinc-800' : ''}`} onClick={() => { setCardSize('medium'); localStorage.setItem('inventoryCardSize', 'medium'); }}>Medium</button>
        <button className={`border px-2 ${cardSize === 'large' ? 'bg-zinc-800' : ''}`} onClick={() => { setCardSize('large'); localStorage.setItem('inventoryCardSize', 'large'); }}>Large</button>
      </> : null}
    </div>

    {viewMode === 'table' ? <>
      <details><summary className="cursor-pointer">Columns</summary><div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">{table.getAllLeafColumns().map(c => <label key={c.id} className="text-sm"><input type="checkbox" checked={c.getIsVisible()} onChange={c.getToggleVisibilityHandler()} /> {c.columnDef.header as string}</label>)}</div></details>
      <div className="overflow-x-auto border border-zinc-800"><table className="w-full text-sm"><thead>{table.getHeaderGroups().map(hg => <tr key={hg.id}>{hg.headers.map(h => <th key={h.id} className="p-2 text-left border-b border-zinc-800 cursor-pointer" onClick={h.column.getToggleSortingHandler()}>{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map(r => <tr key={r.id} className="border-b border-zinc-800">{r.getVisibleCells().map(c => <td key={c.id} className="p-2">{c.column.columnDef.cell ? flexRender(c.column.columnDef.cell, c.getContext()) : String(c.getValue() ?? '')}</td>)}</tr>)}</tbody></table></div>
      <div className="flex gap-2 items-center"><button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="border px-2">Prev</button><span>Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}</span><button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="border px-2">Next</button></div>
    </> : <>
      <div className={`grid gap-3 ${sizeClass}`}>
        {table.getRowModel().rows.map(r => {
          const row = r.original;
          return <button key={row.id} onClick={() => setSelected(row)} className="text-left border border-zinc-800 rounded p-2 bg-zinc-900 hover:bg-zinc-800">
            <div className="relative">
              {getCardImage(row) ? <img src={getCardImage(row)} alt={row.cardName} className="w-full rounded aspect-[63/88] object-cover" /> : <div className="w-full rounded aspect-[63/88] border border-zinc-700 flex items-center justify-center text-xs text-zinc-400 p-2">{row.cardName}</div>}
              <span className="absolute top-1 right-1 bg-black/80 text-white text-xs px-2 py-0.5 rounded">x{row.quantity}</span>
              {row.foil ? <span className="absolute top-1 left-1 bg-amber-400 text-black text-[10px] px-1 rounded">Foil</span> : null}
            </div>
            <div className="mt-2 text-sm font-medium truncate">{row.cardName}</div>
            <div className="text-xs text-zinc-400">{row.setCode} · {row.rarity}</div>
          </button>;
        })}
      </div>
      <div className="flex gap-2 items-center"><button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="border px-2">Prev</button><span>Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}</span><button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="border px-2">Next</button></div>
    </>}

    {selected ? <CardDetail row={selected} onClose={() => setSelected(null)} /> : null}
  </div>;
}
