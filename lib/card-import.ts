import { prisma } from './prisma';
import { getCardByScryfallId, searchCards, ScryfallCard } from './scryfall';

export function cardImageNormal(card: ScryfallCard) {
  return card.image_uris?.normal ?? null;
}

export async function upsertScryfallCard(cardData: ScryfallCard) {
  return prisma.card.upsert({
    where: { scryfallId: cardData.id },
    update: {
      oracleId: cardData.oracle_id ?? null,
      name: cardData.name,
      manaCost: cardData.mana_cost ?? null,
      manaValue: cardData.cmc,
      colors: cardData.colors ?? [],
      colorIdentity: cardData.color_identity ?? [],
      typeLine: cardData.type_line,
      oracleText: cardData.oracle_text ?? null,
      power: cardData.power ?? null,
      toughness: cardData.toughness ?? null,
      loyalty: cardData.loyalty ?? null,
      defense: cardData.defense ?? null,
      keywords: cardData.keywords ?? [],
      legalities: cardData.legalities ?? {},
      setCode: cardData.set,
      setName: cardData.set_name,
      collectorNumber: cardData.collector_number,
      rarity: cardData.rarity,
      artist: cardData.artist ?? null,
      imageUri: cardImageNormal(cardData),
      imageUris: cardData.image_uris ?? {},
      prices: cardData.prices ?? {},
      purchaseUris: cardData.purchase_uris ?? {},
      scryfallUri: cardData.scryfall_uri ?? null,
      lastSyncedAt: new Date(),
    },
    create: {
      scryfallId: cardData.id,
      oracleId: cardData.oracle_id ?? null,
      name: cardData.name,
      manaCost: cardData.mana_cost ?? null,
      manaValue: cardData.cmc,
      colors: cardData.colors ?? [],
      colorIdentity: cardData.color_identity ?? [],
      typeLine: cardData.type_line,
      oracleText: cardData.oracle_text ?? null,
      power: cardData.power ?? null,
      toughness: cardData.toughness ?? null,
      loyalty: cardData.loyalty ?? null,
      defense: cardData.defense ?? null,
      keywords: cardData.keywords ?? [],
      legalities: cardData.legalities ?? {},
      setCode: cardData.set,
      setName: cardData.set_name,
      collectorNumber: cardData.collector_number,
      rarity: cardData.rarity,
      artist: cardData.artist ?? null,
      imageUri: cardImageNormal(cardData),
      imageUris: cardData.image_uris ?? {},
      prices: cardData.prices ?? {},
      purchaseUris: cardData.purchase_uris ?? {},
      scryfallUri: cardData.scryfall_uri ?? null,
      lastSyncedAt: new Date(),
    },
  });
}

export async function findOrImportCard(input: { scryfallId?: string; name: string; setCode?: string; collectorNumber?: string }) {
  const scryfallId = input.scryfallId?.trim();
  if (scryfallId) {
    const local = await prisma.card.findUnique({ where: { scryfallId } });
    if (local) return { status: 'matched' as const, card: local, message: 'Matched by Scryfall ID' };
    const cardData = await getCardByScryfallId(scryfallId);
    if (!cardData) return { status: 'unmatched' as const, card: null, message: 'Scryfall ID was not found' };
    const card = await upsertScryfallCard(cardData);
    return { status: 'new' as const, card, message: 'Imported by Scryfall ID' };
  }

  const setCode = input.setCode?.trim().toLowerCase();
  const collectorNumber = input.collectorNumber?.trim();
  if (setCode && collectorNumber) {
    const local = await prisma.card.findFirst({ where: { setCode, collectorNumber } });
    if (local) return { status: 'matched' as const, card: local, message: 'Matched by set and collector number' };
    const found = await searchCards(`set:${setCode} cn:${collectorNumber}`);
    if (found.length === 1) return { status: 'new' as const, card: await upsertScryfallCard(found[0]), message: 'Imported by set and collector number' };
    if (found.length > 1) return { status: 'ambiguous' as const, card: null, message: 'Multiple cards matched set and collector number' };
  }

  if (setCode && input.name) {
    const found = await searchCards(`!"${input.name.trim()}" set:${setCode}`);
    if (found.length === 1) return { status: 'new' as const, card: await upsertScryfallCard(found[0]), message: 'Imported by exact name and set' };
    if (found.length > 1) return { status: 'ambiguous' as const, card: null, message: 'Multiple printings matched exact name and set' };
  }

  if (input.name) {
    const found = await searchCards(`!"${input.name.trim()}"`);
    if (found.length === 1) return { status: 'new' as const, card: await upsertScryfallCard(found[0]), message: 'Imported by exact name' };
    if (found.length > 1) return { status: 'ambiguous' as const, card: null, message: 'Multiple printings matched exact name' };
  }

  return { status: 'unmatched' as const, card: null, message: 'No card match found' };
}
