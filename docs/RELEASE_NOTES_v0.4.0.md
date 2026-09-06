# Xiaoye Radar Community v0.4.0

`v0.4.0` is the first public Community Edition release.

## Highlights

- Local Windows desktop workflow with no account, license, telemetry, updater, or private-service dependency
- JSON/YAML rules for source, time, include, exclude, contains, score, priority, and enable state
- CSV, JSON, local RSS/Atom, Markdown, and text adapters
- SHA-256 deduplication, atomic local storage, human review, and safe CSV/JSON export
- One-click 80-record synthetic Demo with fixed integration-test outcomes
- Public Source Adapter contract and four additional synthetic use-case examples
- Architecture, rule, adapter, compliance, security, and contribution documentation
- Packaged data-directory isolation, failed-run history, semantic rule revisions, deterministic deduplication, and single-instance workspace protection

## Verified release candidate

- formatting, ESLint, TypeScript, 9 test files / 39 tests, current-tree secret scan, and full-history secret scan passed
- production Electron build passed
- Windows x64 portable package launched and completed the Demo workflow
- no Pro adapter, account/session implementation, browser profile, real customer data, or private rule pack is included

## Windows portable artifact

```text
File: Xiaoye-Radar-Community-0.4.0-portable-x64.exe
Size: 93,918,381 bytes
SHA-256: 2477b7b1ca4d431f8c5c497bb92f6942bcc2a8333a9f900de62fae6a8bd6b98f
Authenticode: NotSigned
```

This hash identifies the locally smoke-tested release candidate. If the owner signs or rebuilds the executable, publish the new hash instead.

## Known limitations

- Windows x64 portable is the only tested release target.
- The executable is unsigned until the owner provides a code-signing workflow.
- The default Electron icon remains in this candidate.
- User-supplied regular expressions are disabled in `v0.4.0`; restoring the feature requires worker or process isolation with a hard timeout.
- Public npm packages, network adapters, notifications, telemetry, and automatic updates are not included.
- GitHub Private Vulnerability Reporting is the documented private security-reporting channel.

## Upgrade note

This is the first Community release, so there is no Community database migration from an earlier version. Community uses a separate data directory and does not import or alter Pro data.
