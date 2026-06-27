# Kubernetes

Reserved for manifests when HeyRiz moves off Docker Compose. No deployment
target has been chosen yet, so nothing is generated here speculatively.

When that happens, it should mirror `docker/docker-compose.prod.yml`: one
Deployment per service (`web`, `gateway`, `ai-core`, `worker`), backed by a
Redis and a Postgres dependency (managed or in-cluster), with `Service` +
`Ingress` in front of `web` and `gateway`, and config sourced from a
`Secret`/`ConfigMap` populated from `.env.production.example`.

Suggested layout once manifests exist:

```text
kubernetes/
  base/            # kustomize base: deployments, services, configmap
  overlays/
    staging/
    production/
```
