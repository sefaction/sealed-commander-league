import { requireAuth } from '@/lib/auth';
import { Nav } from '@/components/Nav';

export default async function Page() {
  const user = await requireAuth();
  return <main className="p-8"><Nav /><h1 className="text-3xl font-bold mb-4">Admin</h1><p className="text-zinc-300">Logged in as <strong>{user.username}</strong>.</p></main>;
}
