import { requireAuth } from '@/lib/auth';
import { Nav } from '@/components/Nav';

export default async function Page() {
  await requireAuth();
  return <main className="p-8"><Nav /><h1 className="text-3xl font-bold mb-4">Decks</h1><p className="text-zinc-300">Deck CRUD is planned next milestone. This page is now wired and ready for deck model integration.</p></main>;
}
