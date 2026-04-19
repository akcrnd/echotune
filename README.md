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

## Environment

- `PORT`: app port inside the container, defaults to `5000`
- `DATABASE_URL`: required runtime Postgres connection string

## Health and operations

- Readiness endpoint: `/api/health`
- The app boot fails fast if Postgres is unavailable or schema bootstrap cannot complete.
- Postgres data persists in the Docker volume `echotune_postgres`.
- GitHub App based Dokploy auto deploy is configured for the `main` branch.
- Deployment verification note: GitHub App trigger is expected for new commits on `main`.
- Verification marker: post-GitHub-App save test commit.

## Backup and recovery

- Pre-cutover snapshot: `npm run data:backup`
- Ongoing backup target: the Postgres volume, not `data.json`
- Recovery model: restore Postgres volume backup, redeploy app, verify `/api/health`, then smoke-test key APIs
