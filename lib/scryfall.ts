export type ScryfallCard = {
  id: string;
  name: string;
  mana_cost?: string;
  color_identity: string[];
  type_line: string;
  oracle_text?: string;
  set: string;
  collector_number: string;
  rarity: string;
  image_uris?: { normal?: string };
};

export async function searchCards(q: string): Promise<ScryfallCard[]> {
  if (!q) return [];
  const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.data ?? [];
}
