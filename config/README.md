# config/ — deploy configuration lives in mothership

The portal's Kamal configuration is **not here**. Until 2026-08-31 this
directory held `deploy.yml` and one override per tenant; they now live in the
mothership repo at `config/portal/`:

    config/portal/deploy.yml
    config/portal/deploy.{mtn,pbx20,nimbus}.yml
    config/portal/portal-destinations.tsv     # per-destination policy, incident-annotated
    config/portal/.kamal/hooks/{pre-build,post-deploy}

Deciding **where** the portal lands needs the view of every destination at once,
and mothership is the only place that has it. Deploy from there:

    cd ../mothership
    make portal-deploy DEST=nimbus
    make portal-config DEST=nimbus     # render and verify, read-only

mothership links this repo in at `apps/portal` and mounts it as the Docker build
context, so the image is still built from **this** checkout at **this** sha.

What stays in this repo: the source, `Dockerfile.production`, CI, and the dev
verbs (`make dev`, `lint`, `unit`, `verify`, `test`, `status`).
