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

## Environment

- `PORT`: app port, defaults to `5000`
- `DATA_FILE_PATH`: runtime JSON storage path, defaults to `/data/data.json` in containers

## Notes

- On first container start, if `DATA_FILE_PATH` does not exist yet, the image seeds it from the repository `data.json`.
- After that, the mounted volume becomes the source of truth for production data.
