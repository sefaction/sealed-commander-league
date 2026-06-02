# Box League (Milestone 1)

Dockerized Next.js app for tracking a long-form MTG sealed commander league.

## Stack
- Next.js (App Router) + TypeScript
- PostgreSQL + Prisma
- Tailwind CSS
- Docker Compose
- Local username/password auth with guest read-only browsing and admin-managed user accounts

## Unraid-first Quick Start
1. Copy `.env.example` to `.env` and set values.
2. Recommended defaults avoid your currently-used ports:
   - `WEB_HOST_PORT=13001`
   - `POSTGRES_HOST_PORT=15435`
3. If deploying through Unraid **Stack/Compose Manager** with a git repository, set:
   - `GIT_CONTEXT` to the repo URL containing this `Dockerfile` (default already set in `.env.example`)
   - `DOCKERFILE_PATH=./Dockerfile`
4. Start services:
   ```bash
   docker compose up -d --build
   ```
5. In Unraid/Portainer, if build fails with `open Dockerfile: no such file or directory`, verify `GIT_CONTEXT` points to the repository root and `DOCKERFILE_PATH=./Dockerfile` (or the real subpath).
6. Open from another device using your Unraid LAN IP, **not localhost**:
   - `http://192.168.1.2:13001` (or `http://<your-unraid-ip>:<WEB_HOST_PORT>`)
7. Login with:
   - username: `admin`
   - password: value of `SEED_ADMIN_PASSWORD` (defaults to `admin123` in seed/bootstrap scripts if not overridden)

The seeded admin password is temporary. Change it immediately after first login; seeded/admin-created accounts may be forced through the Change Password page before accessing protected tools.

## Environment variables
See `.env.example` for all settings. Important ones:
- `DATABASE_URL` should keep host as `postgres` (service name), not localhost.
- `POSTGRES_DATA_PATH` should be on persistent storage (example: `/mnt/user/appdata/box-league/postgres`).
- `NEXT_PUBLIC_APP_NAME` controls branding so the app can be renamed later.
- `COOKIE_SECURE` should be `false` for HTTP/LAN access on Unraid; set `true` only behind HTTPS.
- `GIT_CONTEXT` + `DOCKERFILE_PATH` support remote git build contexts on Unraid.

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

### Recovering from Prisma P3009 (failed migration marker)
If `web` is restart-looping with `P3009` for migration `20260522120000_admin_setup`:
- Default behavior now auto-resolves that failed marker and retries `migrate deploy`.
- If you explicitly want a clean wipe, set `WIPE_DB_ON_START=true` in `.env` for one startup, then set it back to `false`.


- `RUN_SEED_ON_START=false` by default so startup does not depend on seed data; set to `true` only when you explicitly want seed inserts.
