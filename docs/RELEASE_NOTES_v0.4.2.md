# Xiaoye Radar Community v0.4.2

Import Reliability Maintenance Release

`v0.4.2` makes local file imports easier to diagnose and safer to report. It keeps the existing Community workflow, workspace schema version, Community/Pro separation, rule behavior, review states, and release target unchanged.

## Import reliability

- CSV, JSON, RSS/Atom, Markdown, and text adapters reject empty or invalid UTF-8 files consistently.
- Malformed CSV, JSON, and RSS/Atom inputs return format-specific recovery guidance.
- Missing, unreadable, folder, unsupported-extension, and over-limit selections return short actionable errors.
- Unexpected parser or normalization details are replaced at the UI boundary, so local paths and raw source content are not exposed in the displayed error.
- Successful source cards show the adapter kind, normalized item count, and latest check result.
- The 10 MiB limit is covered at the exact accepted boundary and at one byte above it.

These changes add backward-compatible source diagnostic defaults while retaining workspace schema version 1. Existing Community workspaces continue to load without migration.

## Maintenance

- Updated `eslint` from 10.9.1 to 10.10.0.
- Updated `lucide-react` from 1.40.0 to 1.43.0.
- Kept the current Electron, Vite, TypeScript, and Vitest major versions. Major dependency updates remain deferred for separate compatibility audits.

## Verification

The release source is checked with:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run verify:secrets
npm run verify:secret-history
npm run build
npm audit
npm run dist:win
npm run smoke:portable
```

The automated suite contains 52 tests across 10 test files. Portable smoke covers the general Demo, Legal Inquiry Triage, human-review persistence, scan history, restart persistence, isolated storage, and single-instance behavior.

The Windows x64 artifact is `Xiaoye-Radar-Community-0.4.2-portable-x64.exe`, accompanied by `Xiaoye-Radar-Community-0.4.2-portable-x64.exe.sha256`.

## Download safety

The portable executable supports Windows 10 and 11 x64. It is not Authenticode-signed, so Windows SmartScreen may display an unknown-publisher or reputation warning. Download both assets from the official GitHub Release and compare SHA-256 before running; do not disable Windows security controls.

## Security and compliance

No Pro source, platform-specific connector, account or session handling, private API, customer data, real legal inquiry, or commercial rule pack is added. Imports remain local, all example data remains synthetic, and final decisions remain subject to human review.

## Current limitations

- Windows x64 is the only packaged desktop target.
- The portable executable is not Authenticode-signed.
- User Regex remains disabled until it can execute outside the Electron main process with a tested hard timeout.
- Workspace packages are source workspaces and are not claimed as published npm packages.
