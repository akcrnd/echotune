# EchoTune

EchoTune now runs against Postgres for operational data. The legacy `data.json` file remains in the repo as a migration source and emergency snapshot reference, but the running app should use `DATABASE_URL` and Postgres-backed storage only.

## Local run

```bash
docker compose up -d --build
```

Open `http://localhost:22023`.

## Data cutover

1. Create a snapshot backup from the current `data.json`.
2. Provision Postgres and set `DATABASE_URL`.
3. Run a dry run to confirm source counts.
4. Run the data migration once during a short maintenance window.

```bash
npm run data:backup
npm run db:migrate-data:dry-run
npm run db:migrate-data
```

## Dokploy deployment

1. Create or reuse a Docker Compose application in Dokploy.
2. In the Dokploy service, use the `Git` provider instead of the GitHub App provider.
3. Set repository URL to `git@github.com:akcrnd/echotune.git`.
4. Select branch `main`.
5. Set compose path to `./docker-compose.yml`.
6. Select the Dokploy SSH key that has GitHub access.
7. Enable Auto Deploy.

Runtime services:

- `postgres`: internal Postgres for application data
- `echotune`: app service exposed on `22023`

The default deployment keeps app and database in the same Dokploy Compose app. The app connects to Postgres through Docker's internal service DNS:

```env
DATABASE_URL=postgresql://postgres:EchotunePg2026@postgres:5432/echotune
```

Do not use the external Postgres port for normal app traffic. If host-side admin/debug access is needed, temporarily uncomment the Postgres `ports` block in `docker-compose.yml`.

After deployment, verify `http://<host>:22023/api/health`. A healthy deployment returns `{"status":"ok","database":true}`.

## Environment

- `PORT`: app port inside the container, defaults to `5000`
- `POSTGRES_DB`: Postgres database name, defaults to `echotune`
- `POSTGRES_USER`: Postgres user, defaults to `postgres`
- `POSTGRES_PASSWORD`: Postgres password
- `DATABASE_URL`: required runtime Postgres connection string
- `DB_CONNECTION_TIMEOUT_MS`: Postgres connection timeout, defaults to `5000`
- `DB_QUERY_TIMEOUT_MS`: Postgres query/statement timeout, defaults to `15000`
- `DB_POOL_MAX`: Postgres pool size, defaults to `10`

## Health and operations

- Readiness endpoint: `/api/health`
- The app boot fails fast if Postgres is unavailable or schema bootstrap cannot complete.
- API requests fail instead of hanging indefinitely when Postgres cannot be reached.
- Postgres data persists in the Docker volume `echotune_postgres`.
- GitHub App based Dokploy auto deploy is configured for the `main` branch.
- Deployment verification note: GitHub App trigger is expected for new commits on `main`.
- Verification marker: post-GitHub-App save test commit.
- Verification marker: post-provider-save push test.
- Verification marker: app-gh clean service trigger test.
- Verification marker: final app-gh push trigger test.

## Backup and recovery

- Pre-cutover snapshot: `npm run data:backup`
- Ongoing backup target: the Postgres volume, not `data.json`
- Recovery model: restore Postgres volume backup, redeploy app, verify `/api/health`, then smoke-test key APIs

## Moving From Split Database

If data already exists in a separate Dokploy Postgres service, back it up before switching to this compose-managed Postgres volume:

```bash
pg_dump "postgresql://postgres:EchotunePg2026@192.168.3.17:22024/echotune" > echotune.sql
```

After the new compose stack starts, restore the dump into the internal `postgres` service before sending users to the app.
