# Roadmap

This roadmap describes likely Community work. It is directional rather than a promise, and priorities should follow real issues, maintainer capacity, and security findings.

## v0.4.x: stabilize the Community release

- fix import and review issues found by early users
- improve accessibility, recovery messages, and large-workspace behavior
- add more schema and malformed-file fixtures
- document release verification and supported Windows versions
- establish a supported security-reporting channel
- `v0.4.1` target: evaluate restoring regular-expression rules only with worker or process isolation and a hard time budget

## v0.5.0: formalize the Source Adapter SDK

- define package versioning and compatibility policy
- decide whether to publish the public packages to npm
- improve adapter health and diagnostics contracts
- add an external-adapter example repository or template
- investigate OPML import and bounded RSS pagination

## v0.6.0: explore a plugin ecosystem

- define an explicit permission model
- design signed or verifiable plugin metadata
- isolate third-party execution from the desktop renderer
- evaluate an opt-in registry with compliance review

## Future candidates

- webhook input
- local notifications
- rule-testing playground
- reusable export templates
- additional bounded rule types
- macOS and Linux build investigations

Platform-specific integrations, account/session handling, commercial rule packs, and commercial automation are not promised by this Community roadmap.
