# Box League (Milestone 1)

Dockerized Next.js app for tracking a long-form MTG sealed commander league.

## Stack
- Next.js (App Router) + TypeScript
- PostgreSQL + Prisma
- Tailwind CSS
- Docker Compose
- Local username/password auth

## Quick Start
1. Copy `.env.example` to `.env` if desired (optional with compose defaults).
2. Start services:
   ```bash
   docker compose up --build
   ```
3. Open `http://localhost:3000`.
4. Login with:
   - username: `admin`
   - password: value of `SEED_ADMIN_PASSWORD` (default `boxleague123`)

## Unraid Notes
- Add this repo as a custom app or deploy via Compose Manager.
- Map port `3000` to your preferred host port.
- Persist postgres volume (`pgdata`) on your array/cache storage.
- Set `NEXT_PUBLIC_APP_NAME` to customize branding.

## Milestone 1 Included
- Base schema and initial migration.
- Seeded league/season with players Brian, John-Mark, Jessi, Heather.
- Local auth and dashboard.
- Navigation + placeholder pages for Pulls, Inventory, Decks, Trades, Wishlist, Stats.

## Planned for later milestones
- Full CRUD workflows for pulls/inventory/decks/trades/wishlist/points.
- Trade completion workflow that mutates inventory only on completion.
- Scryfall-backed card search and metadata persistence in forms.
