# EchoTune

EchoTune is deployed as a single Docker service. Runtime data is stored in `data.json`, and production containers should mount that file path from a persistent volume.

## Local run

```bash
docker compose up -d --build
```

Open `http://localhost:5000`.

## Dokploy deployment

1. Create or reuse a Docker Compose application in Dokploy.
2. Connect the GitHub repository `akcrnd/echotune`.
3. Select branch `main`.
4. Enable Auto Deploy.
5. Deploy using the repository `docker-compose.yml`.

The service stores runtime data at `/data/data.json` inside the container. The named Docker volume `echotune_data` keeps that file across redeployments, so pushes to `main` can trigger automatic deployment without wiping live data.

## Internal network auto deploy

GitHub cannot call a private Dokploy URL on `192.168.x.x` directly. For internal-only deployments, this repository uses a GitHub Actions workflow that runs on a self-hosted Linux runner inside the same network and posts to the Dokploy webhook URL.

Required setup:

1. Register a self-hosted GitHub Actions runner for `akcrnd/echotune` on a Linux machine that can reach `http://192.168.3.17:3000`.
2. Add the repository secret `DOKPLOY_WEBHOOK_URL` with the Dokploy deployment webhook URL.
3. Leave the workflow in `.github/workflows/deploy.yml` on branch `main`.

After that, every push to `main` triggers the runner, and the runner calls Dokploy from inside the private network.

## Environment

- `PORT`: app port, defaults to `5000`
- `DATA_FILE_PATH`: runtime JSON storage path, defaults to `/data/data.json` in containers

## Notes

- On first container start, if `DATA_FILE_PATH` does not exist yet, the image seeds it from the repository `data.json`.
- After that, the mounted volume becomes the source of truth for production data.
