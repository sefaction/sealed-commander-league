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
  colors?: string;
  legalities?: Record<string,string>;
  artist?: string;
  collectorNumber?: string;
  keywords?: string;
  notes?: string;
  imageUri?: string;
};

const defaults: VisibilityState = { cardName:true, quantity:true, currentOwner:true, originalOpener:true, setCode:true, rarity:true, manaCost:true, typeLine:true, colorIdentity:true, priceUsd:true, foil:true, roundOpened:true };

export function InventoryBrowser({ rows }: { rows: InventoryRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window === 'undefined') return defaults;
    try { return JSON.parse(localStorage.getItem('inventoryColumns') || 'null') || defaults; } catch { return defaults; }
  });

  const cols = useMemo<ColumnDef<InventoryRow>[]>(() => [
    { accessorKey: 'cardName', header: 'Card Name' },
    { accessorKey: 'quantity', header: 'Quantity' },
    { accessorKey: 'currentOwner', header: 'Current Owner' },
    { accessorKey: 'originalOpener', header: 'Original Opener' },
    { accessorKey: 'setCode', header: 'Set' },
    { accessorKey: 'setName', header: 'Set Name' },
    { accessorKey: 'rarity', header: 'Rarity' },
    { accessorKey: 'manaCost', header: 'Mana Cost' },
    { accessorKey: 'manaValue', header: 'Mana Value' },
    { accessorKey: 'typeLine', header: 'Type Line' },
    { accessorKey: 'colorIdentity', header: 'Color Identity' },
    { accessorKey: 'colors', header: 'Colors' },
    { accessorKey: 'foil', header: 'Foil' },
    { accessorKey: 'roundOpened', header: 'Round Opened' },
    { accessorKey: 'priceUsd', header: 'Scryfall USD Price' },
    { accessorKey: 'priceUsdFoil', header: 'Scryfall Foil Price' },
    { accessorKey: 'powerToughness', header: 'Power/Toughness' },
    { accessorKey: 'oracleText', header: 'Oracle Text' },
    { accessorKey: 'artist', header: 'Artist' },
    { accessorKey: 'collectorNumber', header: 'Collector Number' },
    { accessorKey: 'keywords', header: 'Keywords' },
    { accessorKey: 'notes', header: 'Notes' },
  ], []);

  const table = useReactTable({ data: rows, columns: cols, state: { sorting, columnVisibility }, onSortingChange: setSorting, onColumnVisibilityChange: (v) => { const next = typeof v === 'function' ? v(columnVisibility) : v; setColumnVisibility(next); localStorage.setItem('inventoryColumns', JSON.stringify(next)); }, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel() });

  return <div className="space-y-3">
    <details><summary className="cursor-pointer">Columns</summary><div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">{table.getAllLeafColumns().map(c => <label key={c.id} className="text-sm"><input type="checkbox" checked={c.getIsVisible()} onChange={c.getToggleVisibilityHandler()} /> {c.columnDef.header as string}</label>)}</div></details>
    <div className="overflow-x-auto border border-zinc-800"><table className="w-full text-sm"><thead>{table.getHeaderGroups().map(hg => <tr key={hg.id}>{hg.headers.map(h => <th key={h.id} className="p-2 text-left border-b border-zinc-800 cursor-pointer" onClick={h.column.getToggleSortingHandler()}>{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map(r => <tr key={r.id} className="border-b border-zinc-800">{r.getVisibleCells().map(c => <td key={c.id} className="p-2">{c.column.columnDef.cell ? flexRender(c.column.columnDef.cell, c.getContext()) : String(c.getValue() ?? '')}</td>)}</tr>)}</tbody></table></div>
    <div className="flex gap-2 items-center"><button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="border px-2">Prev</button><span>Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}</span><button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="border px-2">Next</button></div>
  </div>;
}
