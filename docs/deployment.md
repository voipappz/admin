# Deployment

Everything runs through **Docker** — there is no other tooling to install.
One artifact: the image built from `Dockerfile.production`, a single-stage
Phoenix release — pure BEAM, no frontend build. CI builds and boot-probes this
exact image on every push (the `prod-image` job).

## Run production on this box

```bash
docker build -f Dockerfile.production -t voipappz-app:local .
docker run -d --name app -p 8000:8000 -e PORT=8000 \
  -e SECRET_KEY_BASE=... voipappz-app:local
```

Runtime env comes from `.env` beside the compose file (`ENGINE_URL`, `NATS_URL`,
the optional cable connection, and the portal database — see `.env.example`).

## Deploy to Nimbus with Kamal

```bash
cd ../mothership
make portal-print DEST=nimbus   # print exact commands; changes nothing
make portal-deploy DEST=nimbus  # build image → push → swap the container
make portal-status              # git + production health + deployed version
```

The portal source and `Dockerfile.production` stay in this repository. Kamal's
destination catalog, deploy YAML, hooks and secrets live under
`../mothership/config/portal/`; deployment logic must not be copied back here.

`make portal-deploy DEST=nimbus` needs two one-time things on the machine you
deploy from:

1. The destination's Kamal secret file under
   `../mothership/config/portal/.kamal/`, filled from `secrets.example`
   (gitignored — never committed).
2. An SSH key authorized on the production server.

That's it — the deploy tool itself runs inside a Docker image automatically;
nothing to install. Nimbus is configured by
`config/portal/deploy.nimbus.yml`; the post-deploy hook verifies the live
Elixir health surfaces before the deploy is considered complete.
