# Contributing to Xiaoye Radar

Thank you for helping improve Xiaoye Radar Community. Contributions should keep the application independently useful, local-first, and safe to publish.

## Before you start

- Search existing issues and discussions before proposing overlapping work.
- Open an issue for a substantial change, new rule type, storage migration, or adapter.
- Read [the compliance policy](docs/compliance.md) before proposing a source adapter.
- Never include real credentials, authentication state, customer data, browser profiles, private endpoints, or proprietary platform selectors.

Small documentation, test, and bug fixes can go directly to a pull request.

## Development setup

Requirements:

- Node.js 22.12 or newer
- npm
- Windows 10 or 11 to run and package the supported desktop target

```bash
npm install
npm run dev
```

The application writes Community data to its own Electron user-data directory. If you set `XIAOYE_RADAR_COMMUNITY_DATA_DIR` during development, use a disposable directory that is not the Pro data directory.

## Branches and commits

Use a short branch name that describes the change:

- `fix/csv-empty-record`
- `feat/adapter-health-view`
- `docs/rule-examples`
- `test/storage-recovery`

Prefer focused commits. Conventional Commit prefixes such as `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, and `chore:` are recommended, but a clear imperative subject is more important than a forced prefix. Do not create filler commits to make the history look active.

## Quality checks

Run the complete local check before opening a pull request:

```bash
npm run verify
```

That command checks formatting, ESLint, TypeScript, unit and integration tests, the current-tree secret scan, and a production Electron build.

For a Windows release change, also run:

```bash
npm run dist:win
npm run smoke:portable
```

Do not weaken a rule or skip a failing test merely to make CI green. Explain platform-specific checks that you could not run.

## Source adapter contributions

An adapter proposal must document:

- where its data comes from and what authorization is required
- configuration and retained metadata
- request, pagination, rate, and deletion behavior when networking is involved
- failure and cleanup behavior
- tests for validation, normalization, limits, and sensitive metadata

Adapters that bypass CAPTCHA, authentication, access controls, rate limits, or platform safeguards are out of scope. See [the Source Adapter SDK guide](docs/source-adapter.md).

## Pull requests

A pull request should:

- explain the problem and the chosen scope
- link its issue when one exists
- include tests for changed behavior
- update user or developer documentation when behavior changes
- include screenshots for visible UI changes, using synthetic data only
- identify storage, API, compatibility, or security implications
- keep Pro-only code and data out of the public repository

Maintainers may ask for a smaller change if a proposal crosses several package or trust boundaries.

## Reporting security issues

Do not disclose a vulnerability, credential, or private record in an issue or pull request. Follow [SECURITY.md](SECURITY.md).
