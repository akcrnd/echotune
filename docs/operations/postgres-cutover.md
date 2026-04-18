# EchoTune Postgres Cutover

## Goal

Move runtime persistence from `data.json` to Postgres with a short maintenance window.

## Pre-cutover

1. Confirm Dokploy Postgres service is healthy.
2. Confirm app container can resolve `DATABASE_URL`.
3. Run:

```bash
npm run data:backup
npm run db:migrate-data:dry-run
```

4. Record dry-run counts for:
   - employees
   - trainingHistory
   - certifications
   - languages
   - patents
   - publications
   - awards
   - projects
   - departments
   - teams
   - proposals

## Cutover

1. Stop user writes to the app.
2. Run:

```bash
npm run db:migrate-data
```

3. Redeploy the app with Postgres enabled.
4. Verify `GET /api/health` returns `200`.

## Post-cutover validation

1. Compare counts against dry-run output.
2. Check 3 representative employee profiles.
3. Exercise create/update/delete for training, certification, patent, publication, award, and project.
4. Confirm R&D criteria endpoints still return stored settings.

## Rollback

1. Stop the app.
2. Restore the previous Postgres volume backup or discard the DB.
3. Revert the deployment to the last file-backed release if needed.
4. Use the `data.json` backup created by `npm run data:backup` as the source of truth.
