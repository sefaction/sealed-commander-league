import Link from 'next/link';
import { logout, getCurrentUser, isAdminUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

const publicLinks = ['dashboard', 'players', 'rounds', 'inventory', 'decks', 'wishlist', 'stats'];
const playerLinks = ['pulls', 'imports', 'trades'];

function title(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}

export async function Nav() {
  const user = await getCurrentUser();
  const isAdmin = isAdminUser(user, user?.player);
  const links = [...publicLinks, ...(user ? playerLinks : []), ...(isAdmin ? ['admin'] : [])];

  async function doLogout() {
    'use server';
    await logout();
    redirect('/dashboard');
  }

  return <nav className="mb-6 flex flex-wrap items-center justify-between gap-4">
    <div className="flex flex-wrap gap-4">{links.map((s) => <Link key={s} href={`/${s}`}>{title(s)}</Link>)}</div>
    <div className="flex items-center gap-3 text-sm text-zinc-300">
      <span>{user ? `Logged in as ${user.player?.displayName || user.displayName || user.username}` : 'Guest mode'}</span>
      {user ? <form action={doLogout}><button className="rounded border border-zinc-700 px-3 py-1">Logout</button></form> : <Link className="rounded border border-sky-700 px-3 py-1" href="/login">Login</Link>}
    </div>
  </nav>;
}
