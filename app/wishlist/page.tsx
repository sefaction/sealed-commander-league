import { requireAuth } from '@/lib/auth';
import { Nav } from '@/components/Nav';

export default async function Page() {
  await requireAuth();
  return <main className="p-8"><Nav /><h1 className="text-3xl font-bold mb-4">Wishlist</h1><p>Wishlist page for Milestone 1.</p></main>;
}
