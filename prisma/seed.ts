import { PrismaClient, RoundStatus, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hasColumn(table: string, column: string) {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${column}
    ) as "exists"
  `;
  return Boolean(rows[0]?.exists);
}

async function hasTable(table: string) {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${table}
    ) as "exists"
  `;
  return Boolean(rows[0]?.exists);
}

async function main() {
  const playersData = [
    { name: 'brian', displayName: 'Brian', isAdmin: true, color: '#3b82f6' },
    { name: 'john-mark', displayName: 'John-Mark', isAdmin: false, color: '#ef4444' },
    { name: 'jessi', displayName: 'Jessi', isAdmin: false, color: '#22c55e' },
    { name: 'heather', displayName: 'Heather', isAdmin: false, color: '#a855f7' },
  ];

  const supportsPlayerName = await hasColumn('Player', 'name');
  const supportsLeagueDesc = await hasColumn('League', 'description');
  const supportsSeasonYear = await hasColumn('Season', 'year');
  const supportsRoundName = await hasColumn('Round', 'name');
  const supportsPointCategory = await hasTable('PointCategory');

  const players = await Promise.all(playersData.map((p) => {
    if (supportsPlayerName) {
      return prisma.player.upsert({
        where: { name: p.name },
        update: { displayName: p.displayName, isAdmin: p.isAdmin, active: true, color: p.color },
        create: { ...p, active: true },
      });
    }

    return prisma.player.upsert({
      where: { displayName: p.displayName },
      update: {},
      create: { displayName: p.displayName } as any,
    } as any);
  }));

  const league = await prisma.league.upsert({
    where: { slug: 'box-league' },
    update: supportsLeagueDesc
      ? { name: 'Box League', description: 'Sealed Commander League', appDisplayName: process.env.NEXT_PUBLIC_APP_NAME || 'Box League' }
      : { name: 'Box League' },
    create: supportsLeagueDesc
      ? { name: 'Box League', slug: 'box-league', description: 'Sealed Commander League', appDisplayName: process.env.NEXT_PUBLIC_APP_NAME || 'Box League' }
      : { name: 'Box League', slug: 'box-league' },
  } as any);

  const season = await prisma.season.upsert({
    where: { leagueId_name: { leagueId: league.id, name: supportsSeasonYear ? '2026 Season' : 'Season 2026' } },
    update: supportsSeasonYear ? { year: 2026, active: true } : {},
    create: supportsSeasonYear
      ? { leagueId: league.id, name: '2026 Season', year: 2026, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), active: true }
      : { leagueId: league.id, name: 'Season 2026', startDate: new Date('2026-01-01') },
  } as any);

  await Promise.all(players.map((p) => prisma.leaguePlayer.upsert({
    where: { seasonId_playerId: { seasonId: season.id, playerId: p.id } },
    update: {},
    create: { seasonId: season.id, playerId: p.id },
  })));

  if (supportsRoundName) {
    await prisma.round.upsert({
      where: { seasonId_monthNumber: { seasonId: season.id, monthNumber: 1 } },
      update: { name: 'January 2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31'), status: RoundStatus.ACTIVE },
      create: { seasonId: season.id, name: 'January 2026', monthNumber: 1, startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31'), status: RoundStatus.ACTIVE },
    });
  } else {
    await prisma.round.upsert({
      where: { seasonId_month_year: { seasonId: season.id, month: 1, year: 2026 } },
      update: { label: 'January 2026' },
      create: { seasonId: season.id, month: 1, year: 2026, label: 'January 2026' },
    } as any);
  }

  if (supportsPointCategory) {
    await prisma.pointCategory.upsert({
      where: { name: 'Match Win' },
      update: { defaultValue: 3, active: true },
      create: { name: 'Match Win', description: 'Win a match', defaultValue: 3, active: true },
    });
  }

  const adminHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'admin123', 12);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: adminHash, playerId: players[0].id, displayName: 'Administrator', role: UserRole.ADMIN, forcePasswordChange: true, isActive: true },
    create: { username: 'admin', passwordHash: adminHash, playerId: players[0].id, displayName: 'Administrator', role: UserRole.ADMIN, forcePasswordChange: true, isActive: true },
  });


  const sampleUserPassword = await bcrypt.hash('player123', 12);
  for (const player of players) {
    if (player.name === 'brian') continue;
    await prisma.user.upsert({
      where: { username: player.name.replace(/-/g, '') },
      update: { displayName: player.displayName, playerId: player.id, role: UserRole.PLAYER, isActive: true },
      create: { username: player.name.replace(/-/g, ''), passwordHash: sampleUserPassword, displayName: player.displayName, playerId: player.id, role: UserRole.PLAYER, forcePasswordChange: true, isActive: true },
    });
  }
}

main().finally(async () => prisma.$disconnect());
