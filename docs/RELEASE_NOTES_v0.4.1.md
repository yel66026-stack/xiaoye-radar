# Xiaoye Radar Community v0.4.1

Maintenance Release

`v0.4.1` adds a reusable Legal Inquiry Triage example with synthetic data while improving maintenance, documentation and test coverage. Xiaoye Radar remains a source-neutral public-content monitoring, filtering and human-review toolkit.

## Legal Inquiry Triage

The new [`examples/legal-inquiry-triage`](../examples/legal-inquiry-triage/README.md) workflow includes:

- a deliberately basic deterministic rule pack for labor, family, debt, traffic, contract, consumer and rental inquiries
- 100 fully fictional records covering actionable requests, legal education, lawyer marketing, irrelevant content, expired content, duplicates and boundary cases
- a dashboard action that imports the example, creates its monitoring job, runs the rule and records history locally
- integration tests for Candidate, Excluded, time-filtered, same-revision duplicate and changed-revision reevaluation behavior
- a personal-information regression check for the complete synthetic dataset

A clean first run has fixed expectations:

| Result              | Count |
| ------------------- | ----: |
| Input records       |   100 |
| Candidates          |    51 |
| Duplicate records   |     5 |
| Excluded records    |    18 |
| Outside time window |    10 |
| Other rule-filtered |    16 |

The example runs fully offline and does not call an AI model or network service. It does not provide legal advice. A Candidate remains subject to human review.

## Maintenance

- Updated `lucide-react` from 1.39.0 to 1.40.0.
- Updated `@types/react-dom` from 19.2.5 to 19.2.7.
- Kept the current Electron, Vite, TypeScript and Vitest major versions. Major Dependabot updates were intentionally excluded from this maintenance release.
- Made Regex-disabled messages release-neutral while retaining the hard-timeout safety requirement.
- Expanded both main READMEs with balanced legal, customer-feedback, brand, RSS and custom-adapter use cases.
- Extended the packaged Windows smoke test to cover both bundled workflows, a persisted human-review decision, history, restart and single-instance behavior. The same test accepts an explicitly selected downloaded executable for release verification.

## Security and compliance

No Pro source, platform login, Cookie, Session, platform selector, CAPTCHA bypass, risk-control evasion, private API, commercial scoring, customer data, real scan result, automatic direct message or bulk-contact implementation is included.

The legal fixture contains no real name, phone number, email address, social handle, user ID, post URL or case record. Every row is explicitly marked `synthetic` and `fictional`, and every URL uses the reserved `example.invalid` domain.

Use the example only with synthetic data or content you are lawfully authorized to access and process. It must not be used for unauthorized private-data collection, credential or access-control bypass, automated harassment, spam or unsolicited messaging.

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

The Windows x64 artifact is `Xiaoye-Radar-Community-0.4.1-portable-x64.exe`. It remains unsigned, so Windows may display a reputation warning. Verify the separately published SHA-256 file before running it.

## Current limitations

- Windows x64 is the only packaged desktop target in this release.
- The portable executable is not Authenticode-signed.
- User Regex remains disabled until it can execute outside the Electron main process with a tested hard timeout.
- Workspace packages are source workspaces and are not claimed as published npm packages.
