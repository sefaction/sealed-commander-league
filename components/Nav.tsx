import Link from 'next/link';

const links = ['dashboard','players','rounds','pulls','inventory','decks','trades','wishlist','stats','admin'];

export function Nav() {
  return <nav className="mb-6 flex flex-wrap gap-4">{links.map((s)=><Link key={s} href={`/${s}`}>{s[0].toUpperCase()+s.slice(1)}</Link>)}</nav>;
}
