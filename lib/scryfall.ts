export type ScryfallCard = {
  id: string;
  oracle_id?: string;
  name: string;
  mana_cost?: string;
  cmc: number;
  colors?: string[];
  color_identity: string[];
  type_line: string;
  oracle_text?: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  image_uris?: { normal?: string };
};

export async function searchCards(q: string): Promise<ScryfallCard[]> {
  if (!q || q.trim().length < 2) return [];
  const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&order=name&unique=prints`, { cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data ?? [];
}
