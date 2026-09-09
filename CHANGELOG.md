# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project intends to use [Semantic Versioning](https://semver.org/spec/v2.0.0.html) after the first public release.

## [Unreleased]

## [0.4.1] - 2026-09-09

### Added

- Legal Inquiry Triage example with a dashboard entry and complete local workflow
- Basic legal inquiry rule pack covering seven introductory categories
- 100-record synthetic legal inquiry dataset with explicit fictional metadata
- Regression tests for classification, time filtering, deduplication, semantic rule revisions, and absence of personal contact data

### Changed

- Updated `lucide-react` from 1.39.0 to 1.40.0 and `@types/react-dom` from 19.2.5 to 19.2.7 after compatibility checks.
- Expanded the English and Chinese use-case documentation while keeping the product source-neutral.
- Extended portable smoke verification across the general Demo, Legal Inquiry Triage, human review, history, restart persistence, and single-instance behavior.
- Future regular-expression support must use execution isolation with a hard timeout.

### Fixed

- Regular-expression rejection messages no longer hard-code an earlier Community version.

### Security

- Added automated checks that the legal example uses only fictional identities and `example.invalid` URLs and contains no phone number, email address, social handle, or live platform domain.

## [0.4.0] - 2026-09-07

### Added

- Independently runnable Windows Community desktop application
- JSON/YAML rule engine with include, exclude, source, time, text, scoring, priority, and enable controls
- SHA-256 content, source-ID, and URL deduplication
- CSV, JSON, local RSS/Atom, Markdown, and text source adapters
- Adapter lifecycle, registry, validation, health, normalization, and disposal APIs
- Atomic local JSON workspace separated from Pro data
- Human-review queue with pending, approved, rejected, and archived states
- Safe CSV and JSON export
- Synthetic 80-record end-to-end Demo and four scenario examples
- Unit and integration tests, secret scanning, and Windows build scripts
- Architecture, adapter, rule, compliance, contribution, security, and governance documentation

### Fixed

- Packaged releases now ignore the development-only Community data-directory override.
- Packaged releases also ignore a forged development renderer URL and restrict the screenshot test hook to disposable smoke storage.
- Failed monitoring runs are persisted with safe error text and complete run metadata.
- Persisted deduplication is scoped by source, rule, and semantic rule revision while same-run duplicates remain suppressed.
- Input ordering no longer changes which duplicate record represents a candidate.
- User-supplied regular expressions are disabled until they can run outside the main process with a hard timeout.
- Secret scans fail closed on Git enumeration or history failures; CI checks out and scans complete history.
- A single-instance lock prevents concurrent desktop processes from writing the same workspace.
- The development command installs Electron's on-demand runtime before electron-vite starts.

No earlier Community version is claimed. The private Pro product has a separate version history that is not copied into this public repository.

[unreleased]: https://github.com/yel66026-stack/xiaoye-radar/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/yel66026-stack/xiaoye-radar/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/yel66026-stack/xiaoye-radar/releases/tag/v0.4.0
