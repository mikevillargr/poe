# Production cutover: Poe at https://poe.vill.ar

One-time runbook that moves production (`hostinger-vps`, `/var/www/poe`) from the old dev-server stack
to the production stack in this repo: standalone Next.js image, Postgres with no public port,
Caddy terminating TLS for `poe.vill.ar`. After this, releases deploy by tag push (`deploy.yml`).

**Who runs it:** Mike, or an agent with Mike's explicit go-ahead for each destructive step. Run every
command once. If SSH fails, stop; don't retry in a loop.

**Expected downtime:** about 2–5 minutes (steps 6–9).

---

## How the production stack works

| Service | Image | Exposure | Notes |
|---|---|---|---|
| `app` | `poe-app:latest` (Dockerfile target `runner`) | `127.0.0.1:3001` only | `node server.js`, non-root, `HEALTHCHECK` on `/api/health` |
| `db` | `pgvector/pgvector:pg16` | none | Same volume `poe_pgdata` as today (project name pinned to `poe`) |
| `caddy` | `caddy:2-alpine` | `443/tcp`, `443/udp` | Let's Encrypt via TLS-ALPN-01; SSE unbuffered; 600 s upstream timeouts |
| `migrate` | `poe-tools:latest` (target `tools`) | none | Profile `tools`; only runs via `docker compose run --rm migrate` |

**Why Caddy only listens on 443.** Port 80 on this host belongs to `alwayssunny-frontend` (checked
2026-10-05, read-only). Nothing else listens on 443 and there is no host-level proxy. So Poe brings
its own Caddy on 443 and gets certificates with the TLS-ALPN-01 challenge, which needs only 443.
As a result, `http://poe.vill.ar` reaches AlwaysSunny's nginx, not Poe, and there is no HTTP to HTTPS
redirect. Always link to `https://`. The optional fix is at the end of this file.

---

## 0. Prerequisites (before the window)

1. `feat/foundation` (PR #1) and `feat/infra` are merged to `main`. Don't push a release tag yet.
   `deploy.yml` refuses to run until step 3 is done, but there's no reason to trigger it.
2. Google OAuth client: the redirect URI `https://poe.vill.ar/api/auth/callback/google` is
   registered (done). You need its client ID and secret.
3. DNS: `poe.vill.ar` A record points to `76.13.191.149` (done; `dig +short poe.vill.ar`).
4. **Port 443 reachability: verified, nothing to do.** On 2026-10-05, a throwaway `nginx:alpine` on
   `-p 443:80` answered HTTP 200 from outside, and it was removed straight after. Closed ports time out
   upstream, but published ports are reachable, so no hPanel firewall change is needed.
5. Generate secrets on your laptop (keep them out of chat and logs):
   ```bash
   openssl rand -base64 32   # AUTH_SECRET
   openssl rand -base64 32   # APP_ENCRYPTION_KEY (never change it once keys are stored)
   openssl rand -hex 24      # new DB password (optional rotation, step 7)
   ```

## 1. Pre-flight (read-only)

```bash
ssh hostinger-vps
cd /var/www/poe
git status --short                 # expect no output (clean)
git rev-parse HEAD                 # write this down: PRE_SHA (currently 7c555f6...)
docker compose ps                  # poe-app-1 and poe-db-1 running
ss -ltnp | grep -E ':(443)\b'      # expect no output (443 free)
```

## 2. Backup (database, .env, image)

```bash
mkdir -p /var/backups/poe && chmod 700 /var/backups/poe
STAMP=$(date +%Y%m%d-%H%M)
# DB user and database name of the running container (no secret is printed):
DBU=$(docker exec poe-db-1 printenv POSTGRES_USER); DBN=$(docker exec poe-db-1 printenv POSTGRES_DB)
docker exec poe-db-1 pg_dump -U "$DBU" -d "$DBN" -Fc > /var/backups/poe/poe-precutover-$STAMP.dump
ls -lh /var/backups/poe/poe-precutover-$STAMP.dump
docker exec -i poe-db-1 pg_restore -l < /var/backups/poe/poe-precutover-$STAMP.dump | grep -c TABLE   # > 0
cp -p .env /var/backups/poe/env-precutover-$STAMP && chmod 600 /var/backups/poe/env-precutover-$STAMP
docker tag poe-app:latest poe-app:pre-cutover   # the image running today
echo "$PRE_SHA" > /var/backups/poe/precutover-$STAMP.sha   # set PRE_SHA from step 1
```

**Rollback for this step:** none needed; nothing has changed yet.

## 3. Write the production `.env`

Edit `/var/www/poe/.env` (`chmod 600 .env`). The full list with comments is in `.env.example`,
"PRODUCTION" section. Required:

| Variable | Value |
|---|---|
| `POSTGRES_DB` | `poe` |
| `POSTGRES_USER` | the **existing** role: `docker exec poe-db-1 printenv POSTGRES_USER` |
| `POSTGRES_PASSWORD` | the **existing** password: `docker exec poe-db-1 printenv POSTGRES_PASSWORD` (step 7 rotates it) |
| `DATABASE_URL` | `postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@db:5432/poe` (URL-encode special characters) |
| `AUTH_SECRET` | generated in step 0 |
| `AUTH_URL` | `https://poe.vill.ar` |
| `AUTH_TRUST_HOST` | `true` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | from the Google OAuth client |
| `ALLOWED_EMAIL_DOMAIN` | `growth-rocket.com` |
| `SUPER_ADMIN_EMAIL` | `mike@growth-rocket.com` |
| `APP_ENCRYPTION_KEY` | generated in step 0 |

Optional: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MOONSHOT_API_KEY` (env fallbacks until keys are saved
in Settings), `AI_MOCK=0`, `POE_DOMAIN` (defaults to `poe.vill.ar`), `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
and `NEXT_PUBLIC_GOOGLE_API_KEY` (Drive export; baked in at build time).

Remove the obsolete keys: `DB_USER`, `DB_PASSWORD`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`,
`NEXT_PUBLIC_APP_URL`, `NODE_ENV`, `PORT`. Compose sets `NODE_ENV` and `PORT` itself, and a stray
`NODE_ENV=development` in `.env` would otherwise reach the app.

**Rollback:** `cp /var/backups/poe/env-precutover-$STAMP .env`.

## 4. Check out the release

```bash
git fetch --tags origin
git checkout main
git merge --ff-only origin/main
git rev-parse HEAD                 # NEW_SHA
POSTGRES_USER=x POSTGRES_PASSWORD=x docker compose config -q && echo compose-ok
```

The old containers keep running. The old app's source was copied into its image at build time, so
the checkout alone doesn't change what's served.

**Rollback:** `git checkout "$PRE_SHA"` (detached HEAD). See "Rollback A" below.

## 5. Build (old app still serving)

```bash
export GIT_SHA=$(git rev-parse HEAD)
docker compose build app migrate
docker image inspect poe-app:latest --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'   # = NEW_SHA
```

Building takes a few minutes. The running container keeps its old image; `poe-app:pre-cutover` still
points at it.

## 6. Stop the old app (downtime starts)

```bash
docker compose stop app
```

The DB keeps running, so nothing writes to it during migration.

## 7. Rotate the DB password (recommended)

The current password was committed to git in the old `docker-compose.yml`, and 5432 was public. Rotate
it now that nothing is connected:

```bash
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d poe'
poe=# \password
#  enter the new password twice (prompted, so it never lands in shell history), then \q
```

Then set `POSTGRES_PASSWORD` and the password inside `DATABASE_URL` in `.env` to the new value.
`POSTGRES_PASSWORD` only matters on a fresh volume, but keep it in sync.

**Rollback:** run `\password` again with the old value.

## 8. Mark the baseline (ONCE), then migrate

Production's schema was created with `drizzle-kit push`, so it has no migration history. Record
`0000_baseline` as applied, exactly once, then apply 0001–0003. This was rehearsed on a copy of the
prod dump on 2026-10-05 (foundation log, Addendum 3).

```bash
docker compose run --rm migrate npx tsx scripts/db/mark-baseline.ts
#  -> "Marked 0000_baseline as applied on postgresql://...:***@db:5432/poe."
#     It refuses (and changes nothing) if the migrations table already has rows.
docker compose run --rm migrate
#  -> "Done. 4 migrations recorded."
```

`0003_drop_credentials` drops the old login columns. From here on, the old app image can't run
against this database. Rolling back means restoring the step 2 dump.

## 9. Start the production stack

```bash
docker compose up -d --remove-orphans
docker compose ps                         # app (healthy), db (healthy), caddy (running)
docker compose logs caddy | grep -iE 'certificate obtained|error'
curl -fsS http://127.0.0.1:3001/api/health  # {"ok":true,"db":true}
```

`db` gets recreated with the new config (no published port), either here or already in step 8 when
`run` started its dependency. The data stays on `poe_pgdata`.

If Caddy logs ACME errors or timeouts, check that the `caddy` container is publishing 443
(`docker compose ps`) and that DNS for poe.vill.ar still points to 76.13.191.149. 443 was verified
reachable on 2026-10-05 (step 0.4). Caddy retries on its own once the port opens.

## 10. Verify

From your laptop:
```bash
curl -s https://poe.vill.ar/api/health                                  # {"ok":true,"db":true}
curl -s -o /dev/null -w '%{http_code}\n' https://poe.vill.ar/login      # 200
curl -s -w ' %{http_code}\n' https://poe.vill.ar/api/clients            # {"error":...,"code":"UNAUTHENTICATED"} 401
nc -z -w 5 76.13.191.149 5432 || echo "5432 closed (good)"
nc -z -w 5 76.13.191.149 3001 || echo "3001 closed (good)"
```

In a browser:
1. Open https://poe.vill.ar, choose "Continue with Google", and sign in as `mike@growth-rocket.com`.
   You should land as super admin.
2. The client switcher shows **NCH Inc.**. Its guidelines show **26** items, and its home shows **3**
   articles (status Done), matching the rehearsal.
3. Optional: a second `@growth-rocket.com` account should land on `/pending`.

## 11. After cutover

1. **GitHub secrets** (repo → Settings → Secrets and variables → Actions). Mike sets these; agents don't:
   - `VPS_HOST` = `76.13.191.149`
   - `VPS_USER` = `root`. The current value is unknown, so set it explicitly.
   - `VPS_SSH_KEY` = a private key whose public half is in `/root/.ssh/authorized_keys`. A dedicated
     deploy key is recommended:
     ```bash
     ssh-keygen -t ed25519 -C poe-deploy -f ~/.ssh/poe-deploy -N ''
     ssh hostinger-vps 'cat >> /root/.ssh/authorized_keys' < ~/.ssh/poe-deploy.pub
     gh secret set VPS_HOST --body 76.13.191.149
     gh secret set VPS_USER --body root
     gh secret set VPS_SSH_KEY < ~/.ssh/poe-deploy
     ```
2. **Prove the tag deploy.** From a clean, up-to-date `main`, run `npm run release:minor` (creates
   `v1.1.0`). The workflow then:
   - checks `.env`;
   - fast-forwards `main` to the tag;
   - tags the running image `poe-app:previous`;
   - builds with `GIT_SHA`;
   - writes `/var/backups/poe/predeploy-<tag>-*.dump`;
   - runs `migrate`, then `up -d`;
   - health-checks `127.0.0.1:3001` and `https://poe.vill.ar` (resolved locally), printing logs if
     either fails.
3. Update `app.yaml` if the domain or services change later. `/opt/poe` (a stale v0.1.1 copy) stays
   until Mike decides to remove it.
4. Remove `poe-app:pre-cutover` and the precutover dump only after a few days of stable running.

---

## Rollback

### A. Before step 8 (DB untouched)

```bash
cp /var/backups/poe/env-precutover-$STAMP .env
git checkout "$PRE_SHA"
docker tag poe-app:pre-cutover poe-app:latest
docker compose up -d --no-build --remove-orphans     # old compose: app :3001 + db
```

If you rotated the password in step 7, set it back with `ALTER USER` first, or put the new password into
the old setup. The old compose hardcodes the old password, so setting it back is simpler.

### B. After step 8 (migrations applied): restore the dump

```bash
docker compose down --remove-orphans                 # new stack down; volume poe_pgdata is kept
cp /var/backups/poe/env-precutover-$STAMP .env
git checkout "$PRE_SHA"
docker compose up -d db                              # old compose, same volume
DBU=$(docker exec poe-db-1 printenv POSTGRES_USER)
docker exec poe-db-1 dropdb -U "$DBU" poe
docker exec poe-db-1 createdb -U "$DBU" poe
docker exec -i poe-db-1 pg_restore -U "$DBU" -d poe --no-owner < /var/backups/poe/poe-precutover-$STAMP.dump
# If you rotated the password in step 7, put the old one back:
#   docker exec poe-db-1 psql -U "$DBU" -d poe -c "ALTER USER \"$DBU\" PASSWORD '<old password>'"
docker tag poe-app:pre-cutover poe-app:latest
docker compose up -d --no-build --remove-orphans
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/login   # 200
```

### C. Later releases (after cutover)

- **App-only regression, no new migration:**
  `docker tag poe-app:previous poe-app:latest && docker compose up -d --no-build app`. Optionally
  `git checkout <previous tag>` so the checkout matches. The next tag deploy re-checks out `main` by
  itself.
- **The release included a migration:** restore that release's
  `/var/backups/poe/predeploy-<tag>-*.dump` as in B, staying on the new compose file. The db container
  is `poe-db-1`, and `POSTGRES_USER` comes from `.env`.

---

## Optional: HTTP to HTTPS redirect for poe.vill.ar

Port 80 belongs to AlwaysSunny (`/opt/alwayssunny`). To redirect `http://poe.vill.ar`, add a server block
to **AlwaysSunny's** nginx. That's a change to another app, so it's Mike's call:

```nginx
server {
    listen 80;
    server_name poe.vill.ar;
    return 301 https://poe.vill.ar$request_uri;
}
```

The longer-term alternative is one shared edge proxy on 80/443 for every app on the box. It would
need its own plan because it touches every app.

---

## Retired: pre-Docker and bootstrap deploy scripts (2026-10-05, WS-infra, D-001)

- **What they were:**
  - `deploy.sh` and `deploy-fresh.sh`: the pm2-era deploys (build on the server, run under pm2).
  - `deploy-docker.sh`: a one-shot Docker bootstrap for `/var/www/poe`. It **overwrote the server
    `.env` with placeholders** (including a fake `ANTHROPIC_API_KEY`) and re-ran the seed.
  - `docker/nginx.conf`: a catch-all nginx config that no compose file ever mounted.
- **Removed in this change.** They remain in git history only.
- **Orphaned references:**
  - `DEPLOYMENT.md`, `DEPLOYMENT_SUMMARY.md`, `DOCKER_MIGRATION.md`, `INITIAL_PROMPT.md`: historical
    notes, harmless but wrong. WS retire-docs owns rewriting them.
  - The `CLAUDE.md` Docker, VPS and nginx sections describe the old intended design. This runbook and
    the repo's `Dockerfile` / `docker-compose.yml` are the source of truth.
- **Treat them as removed, not as targets to restore**, unless Mike explicitly asks for that.
