import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { searchCards } from '@/lib/scryfall';

export async function GET(request: NextRequest) {
  await requireAuth();
  const q = request.nextUrl.searchParams.get('q') || '';
  const cards = await searchCards(q);
  return Response.json({ data: cards.slice(0, 25) });
}
