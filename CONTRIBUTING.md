# Contributing to Bifrost

Thanks for your interest in contributing to Bifrost! This project welcomes
contributions of all kinds — bug reports, fixes, features, docs, and ideas.

> First time here? Start with [good first issues][gfi] (if available) and the
> [Code of Conduct](./CODE_OF_CONDUCT.md).

[gfi]: https://github.com/devzeebo/bifrost/contribute

---

## Code of Conduct

Participation in this project is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md).
By participating, you are expected to uphold it. Please report unacceptable behavior
to the maintainers (see the CoC for contact details).

---

## Prerequisites

| Tool                           | Version    |
| ------------------------------ | ---------- |
| [Go](https://go.dev/dl/)       | 1.26       |
| [Node.js](https://nodejs.org/) | 24         |
| [git](https://git-scm.com/)    | any recent |

Optional: [Docker](https://www.docker.com/) for building/packaging (`make docker`),
[golangci-lint](https://golangci-lint.run/) and [prettier](https://prettier.io/)
are invoked via `make`/`npm` and installed as needed.

---

## Get the code

```bash
# 1. Fork the repo on GitHub, then:
git clone https://github.com/<your-username>/bifrost.git
cd bifrost

# 2. Add the upstream remote
git remote add upstream https://github.com/devzeebo/bifrost.git

# 3. Install all dependencies (run this before starting any work)
make deps
```

---

## Project layout

Bifrost is a hybrid monorepo:

| Path            | Stack                    | Purpose                              |
| --------------- | ------------------------ | ------------------------------------ |
| `bifrost/`      | Go workspace (7 modules) | Server, CLI, domain, providers       |
| `orchestrator/` | TypeScript               | Agent orchestration system           |
| `bifrost/ui/`   | React 19 + Vike          | Admin UI (embedded in server binary) |
| `skills/`       | Markdown                 | AI agent skills                      |

Go modules: `core`, `domain`, `domain/integration`, `providers/sqlite`,
`providers/postgres`, `server`, `cli`.

For the full architecture, see:

- [Developing Bifrost](./bifrost/docs/DEVELOPMENT.md)
- [Orchestrator Architecture](./orchestrator/docs/ARCHITECTURE.md)
- [RBAC](./bifrost/docs/RBAC.md)

---

## Development workflow

```bash
# Go server + Vike UI dev servers (hot reload)
make dev

# Orchestrator dev (Vitest watch)
cd orchestrator && npm run dev
```

> **Use `make`, not raw `go`.** This is a multi-module Go workspace; running
> `go test ./...` from the root does **not** work correctly. See
> [Coding conventions](#coding-conventions).

---

## Coding conventions

**Banned commands — never run raw `go` or `npx`.** Always go through `make`
(Go) or `npm run <script>` (Node). This keeps the multi-module workspace
consistent.

```bash
make lint                     # golangci-lint (Go) + oxlint (TS)
make vet                      # go vet across all modules
npm run format                # Prettier (TS/JSON/Markdown)
```

Style references:

- [Orchestrator Coding Standards](./orchestrator/docs/CODING_STANDARDS.md)
- Go: standard `gofmt` + `golangci-lint` rules (`bifrost/.golangci.yml`)
- TS: Oxlint (`oxlint.config.ts`) + Prettier (`prettier.config.mjs`) — 2 spaces,
  double quotes, trailing commas, 100-char width

Match the style of the surrounding code.

---

## Testing

```bash
make test                                # all Go modules
make test MODULES=core                   # single module
make test MODULES="core domain"          # multiple modules
make test MODULES=core ARGS="-v -count=1"  # extra flags

cd orchestrator && npm run test          # Vitest
cd bifrost/ui && npm run test            # UI tests
```

All tests must pass before opening a pull request.

---

## Commit messages

- Short, lowercase, imperative subject: `add …`, `fix …`, `update docs …`
- One logical change per commit.
- Reference a rune or issue ID in the body when relevant.

---

## Branches

- Base branch is `main`.
- Name branches by intent: `feat/*`, `fix/*`, `docs/*`, `chore/*`, `refactor/*`.
- Keep branches short-lived and focused on one change.

---

## Pull requests

1. Sync with upstream: `git fetch upstream && git rebase upstream/main`.
2. Make sure quality gates pass locally:

   ```bash
   make lint
   make test
   make build
   ```

3. Push your branch and open a PR against `main`.
4. Fill in the [PR template](./.github/PULL_REQUEST_TEMPLATE.md).
5. Keep PRs small and focused; split unrelated changes into separate PRs.
6. **Never force-push** to `main`. If a conflict arises, pull and rebase. Do not
   use `--force` or `--force-with-lease`.
7. Mark the PR as **Draft** while it's a work in progress.
8. Respond to review feedback and re-request review after changes.

---

## Reporting bugs & suggesting features

- **Bugs / features:** use the [issue forms](https://github.com/devzeebo/bifrost/issues/new/choose)
  (`.github/ISSUE_TEMPLATE/`).
- **Security vulnerabilities:** see [SECURITY.md](./SECURITY.md) — do **not**
  open a public issue for security reports.

---

## Licensing

Bifrost is licensed under the [MIT License](./LICENSE.md). By contributing, you
agree that your contributions will be licensed under the same terms.

---

## Questions

No Discussions are configured yet — open an [issue](https://github.com/devzeebo/bifrost/issues)
for questions, or contact the maintainer [@devzeebo](https://github.com/devzeebo).
