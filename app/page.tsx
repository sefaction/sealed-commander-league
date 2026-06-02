export const dynamic = 'force-dynamic';
import { Nav } from '@/components/Nav';
import Link from 'next/link';

export default function HomePage() {
  return <main className="p-8 space-y-6"><Nav /><section className="rounded border border-zinc-800 p-6 space-y-3"><h1 className="text-3xl font-bold">{process.env.NEXT_PUBLIC_APP_NAME || 'Box League'}</h1><p className="text-zinc-300">Browse the league in read-only guest mode, or log in to enter pulls, import CSV files, and manage your own inventory workflows.</p><div className="flex gap-3"><Link href="/dashboard" className="border px-3 py-2">Open Dashboard</Link><Link href="/login" className="border px-3 py-2">Login</Link></div></section></main>;
}
