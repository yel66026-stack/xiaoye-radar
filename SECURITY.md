# Security Policy

## Supported versions

| Version                   | Supported   |
| ------------------------- | ----------- |
| Latest `0.4.x` release    | Yes         |
| Unreleased default branch | Best effort |
| Older versions            | No          |

Support began with the first public `0.4.0` release. The latest `0.4.x` maintenance release receives support.

## Reporting a vulnerability

Do not open a public issue for a vulnerability that could expose credentials, private content, local files, authentication state, or a practical exploit.

This repository uses GitHub Private Vulnerability Reporting as its private reporting channel. Open the repository's **Security** tab and choose **Report a vulnerability** to contact the maintainers without disclosing the report publicly. If that option is not visible, do not publish exploit details or sensitive evidence in an issue; wait until the private channel is available.

Include the affected version, operating system, impact, reproduction steps, and the smallest safe proof of concept. Remove tokens, cookies, personal data, customer data, and unrelated local paths before sending a report.

The maintainer should acknowledge a private report within seven calendar days, provide an initial assessment when enough information is available, and coordinate disclosure after a fix or mitigation is ready. These are response targets, not a guarantee.

## Scope

Useful reports include:

- unsafe Electron IPC or preload exposure
- navigation or external-URL policy bypass
- arbitrary file access or path traversal
- import parsing that causes code execution or resource exhaustion
- storage corruption or cross-edition data access
- spreadsheet-formula injection in exports
- accidental secret or personal-data disclosure
- dependency vulnerabilities that affect the packaged application

The project does not provide a safe harbor for accessing systems or data without permission. Test only against data, accounts, and devices you own or are authorized to use. Do not degrade a service, evade access controls, retain personal data, or publish exploit details before coordination.

## Security-related configuration

Community Edition has no login, telemetry, private service, license server, or updater. It uses a sandboxed renderer, a narrow preload bridge, sender-validated IPC, bounded local imports, schema validation, separate local storage, and a single-instance workspace writer. Packaged releases ignore the development-only data-directory override. User-supplied regular expressions are disabled in the current release; they must not be re-enabled until evaluation is isolated from the Electron main process with a hard timeout. See [the architecture](docs/architecture.md) and [compliance policy](docs/compliance.md) for the current boundaries.
