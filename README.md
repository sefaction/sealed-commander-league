# Box League (Milestone 1)

Dockerized Next.js app for tracking a long-form MTG sealed commander league.

## Stack
- Next.js (App Router) + TypeScript
- PostgreSQL + Prisma
- Tailwind CSS
- Docker Compose
- Local username/password auth

## Unraid-first Quick Start
1. Copy `.env.example` to `.env` and set values.
2. Recommended defaults avoid your currently-used ports:
   - `WEB_HOST_PORT=13001`
   - `POSTGRES_HOST_PORT=15435`
3. Start services:
   ```bash
   docker compose up -d --build
   ```
4. Open `http://<unraid-ip>:13001` (or your `WEB_HOST_PORT`).
5. Login with:
   - username: `admin`
   - password: value of `SEED_ADMIN_PASSWORD`

## Environment variables
See `.env.example` for all settings. Important ones:
- `DATABASE_URL` should keep host as `postgres` (service name), not localhost.
- `POSTGRES_DATA_PATH` should be on persistent storage (example: `/mnt/user/appdata/box-league/postgres`).
- `NEXT_PUBLIC_APP_NAME` controls branding so the app can be renamed later.

## Commands
```bash
docker compose up -d --build
docker compose logs -f web
docker compose down
```

## Milestone 1 Included
- Base schema and initial migration.
- Seeded league/season with players Brian, John-Mark, Jessi, Heather.
- Local auth and dashboard.
- Navigation + placeholder pages for Pulls, Inventory, Decks, Trades, Wishlist, Stats.

## Planned for later milestones
- Full CRUD workflows for pulls/inventory/decks/trades/wishlist/points.
- Trade completion workflow that mutates inventory only on completion.
- Scryfall-backed card search and metadata persistence in forms.
