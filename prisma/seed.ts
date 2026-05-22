import { PrismaClient, RoundStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const playersData = [
    { name: 'brian', displayName: 'Brian', isAdmin: true },
    { name: 'john-mark', displayName: 'John-Mark', isAdmin: false },
    { name: 'jessi', displayName: 'Jessi', isAdmin: false },
    { name: 'heather', displayName: 'Heather', isAdmin: false },
  ];

  const players = await Promise.all(playersData.map((p) => prisma.player.upsert({
    where: { name: p.name },
    update: { displayName: p.displayName, isAdmin: p.isAdmin, active: true },
    create: { ...p, active: true },
  })));

  const league = await prisma.league.upsert({
    where: { slug: 'box-league' },
    update: { name: 'Box League', description: 'Sealed Commander League', appDisplayName: process.env.NEXT_PUBLIC_APP_NAME || 'Box League' },
    create: { name: 'Box League', slug: 'box-league', description: 'Sealed Commander League', appDisplayName: process.env.NEXT_PUBLIC_APP_NAME || 'Box League' },
  });

  const season = await prisma.season.upsert({
    where: { leagueId_name: { leagueId: league.id, name: '2026 Season' } },
    update: { year: 2026, active: true },
    create: { leagueId: league.id, name: '2026 Season', year: 2026, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), active: true },
  });

  await Promise.all(players.map((p) => prisma.leaguePlayer.upsert({
    where: { seasonId_playerId: { seasonId: season.id, playerId: p.id } },
    update: {},
    create: { seasonId: season.id, playerId: p.id },
  })));

  await prisma.round.upsert({
    where: { seasonId_monthNumber: { seasonId: season.id, monthNumber: 1 } },
    update: { name: 'January 2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31'), status: RoundStatus.ACTIVE },
    create: { seasonId: season.id, name: 'January 2026', monthNumber: 1, startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31'), status: RoundStatus.ACTIVE },
  });

  await prisma.pointCategory.upsert({
    where: { name: 'Match Win' },
    update: { defaultValue: 3, active: true },
    create: { name: 'Match Win', description: 'Win a match', defaultValue: 3, active: true },
  });

  const adminHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'boxleague123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: adminHash, playerId: players[0].id },
    create: { username: 'admin', passwordHash: adminHash, playerId: players[0].id },
  });
}

main().finally(async () => prisma.$disconnect());
