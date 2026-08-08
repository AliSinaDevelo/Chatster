# Maintenance cadence

Chatster is intentionally parked after the presentation pass. Revisit it once every
two weeks for a short evidence review rather than carrying an always-open development
loop.

## Start here

Run from the repository root as `AlisinaDevelo`:

```bash
git fetch origin --prune
git status --short --branch
gh run list --repo AlisinaDevelo/Chatster --workflow ci.yml --branch main --limit 5
gh issue list --repo AlisinaDevelo/Chatster --state open --limit 50
gh pr list --repo AlisinaDevelo/Chatster --state open --limit 50
```

The expected open product task is [issue #20](https://github.com/AlisinaDevelo/Chatster/issues/20), unless the Render proof has been completed.

## Verification loop

Run the checks that match the available local tooling:

```bash
make test
make lint
cd frontend && npm run build
cd frontend && npm run test:e2e
npm audit --omit=dev --audit-level=high
```

`make lint` needs `golangci-lint` locally. If it is not installed, record that fact and
use the hosted `backend` job in GitHub Actions as the linter proof; do not claim local
lint passed. The full browser matrix is useful for a maintenance review, while
`npm run test:e2e:ci` is the faster Chromium-only check used on every push.

For the production image, run the same path CI exercises:

```bash
docker build -t chatster:maintenance .
docker run -d --rm --name chatster-maintenance-smoke \
  -p 18081:8080 \
  -e CHATSTER_ALLOWED_ORIGINS=http://127.0.0.1:18081 \
  chatster:maintenance
./scripts/smoke-deployment.sh http://127.0.0.1:18081
docker stop chatster-maintenance-smoke
```

If a public demo exists, replace the local origin with the exact deployment URL and run
both the HTTP smoke and the deployed Chromium check from [DEPLOYMENT.md](DEPLOYMENT.md).

## Review rules

- Inspect the latest workflow run before changing code. A green `main` run is the release baseline.
- Review Dependabot pull requests individually. Keep upgrades that change React, Go, or action major versions separate from routine patch updates.
- Check `npm audit --omit=dev --audit-level=high` and the repository's GitHub security pages when permissions allow it. A disabled alert API is not evidence that no alerts exist.
- Keep secrets, access tokens, deployment URLs with credentials, database files, build output, test reports, and logs out of commits.
- Update [PROJECT_STATUS.md](PROJECT_STATUS.md) only with evidence from the current review, including the commit and workflow URL.
- Keep the default deployment at one instance while SQLite and the in-memory hub are selected.
- Prefer a small issue with a measurable acceptance test over an open-ended "polish" task.

## Stop condition

If `main` is green, no security or dependency issue requires immediate action, and the
Render proof is still waiting on external access, stop. Leave the worktree clean and
return at the next two-week review instead of expanding the scope.
