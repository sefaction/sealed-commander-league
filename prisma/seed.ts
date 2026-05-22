import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const names = ['Brian', 'John-Mark', 'Jessi', 'Heather'];
  const players = await Promise.all(names.map((displayName) => prisma.player.upsert({
    where: { id: displayName.toLowerCase().replace(/[^a-z]/g, '') },
    update: { displayName },
    create: { id: displayName.toLowerCase().replace(/[^a-z]/g, ''), displayName },
  })));

  const league = await prisma.league.upsert({
    where: { slug: 'box-league' },
    update: { name: 'Box League' },
    create: { name: 'Box League', slug: 'box-league' },
  });

  const season = await prisma.season.create({
    data: {
      leagueId: league.id,
      name: 'Season 2026',
      startDate: new Date('2026-01-01'),
      memberships: { create: players.map((p) => ({ playerId: p.id })) },
      rounds: { create: [{ month: 1, year: 2026, label: 'January 2026' }, { month: 2, year: 2026, label: 'February 2026' }] },
    },
  }).catch(async () => prisma.season.findFirstOrThrow({ where: { leagueId: league.id, name: 'Season 2026' } }));

  const adminHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'boxleague123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: adminHash, playerId: players[0].id },
    create: { username: 'admin', passwordHash: adminHash, playerId: players[0].id },
  });

  console.log(`Seeded ${league.name} / ${season.name}`);
}

main().finally(() => prisma.$disconnect());
