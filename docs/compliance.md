# Compliance and responsible use

Xiaoye Radar Community is a processing toolkit. It does not give a user permission to access, collect, retain, combine, or redistribute content.

## Required use boundaries

Use only data that you are authorized to access and process. Before importing or building an adapter:

- review the source's terms of service and developer policies
- follow applicable law and contractual restrictions
- follow `robots.txt` when it applies to the access method
- collect only the fields needed for a documented purpose
- set suitable retention and deletion rules
- protect exported files and local workspace backups
- respect data-subject rights and consent requirements where applicable

Publicly visible content can still contain personal data and can still be subject to copyright, database rights, confidentiality, consumer-protection rules, or contextual privacy expectations.

## Prohibited implementations

The Community project does not accept features intended for:

- CAPTCHA bypass
- access-control bypass
- authentication bypass
- unauthorized account access
- credential, cookie, token, or session theft
- private-data scraping
- rate-limit evasion
- stealth or anti-detection behavior
- defeating platform safeguards

Do not submit real credentials, browser profiles, authentication state, private endpoints, customer datasets, or platform-specific selectors in an issue, example, test, or pull request.

## Source adapters

File adapters operate on local copies chosen by the user. A future network adapter must document its authorization model, request policy, pagination bounds, deletion behavior and retained metadata. Maintainers may reject an adapter even when its code is technically sound if its normal use would violate these boundaries.

## Examples

All bundled examples are synthetic. The legal-help scenario demonstrates a general rule engine and is not legal advice or a claim that Xiaoye Radar is a lawyer-acquisition tool. The brand name in the brand-monitoring example is fictional.

## Human review

Scores and matches are aids for triage. They should not be treated as verified facts, legal conclusions, eligibility decisions, or automated decisions about a person. Reviewers remain responsible for the decision and for documenting an appropriate reason.

## Reporting concerns

Do not put a credential, private record, or exploit detail in a public issue. Follow [SECURITY.md](../SECURITY.md). The repository owner must add a private security contact before public launch.

This document provides project rules, not legal advice. When the use case is regulated or high risk, obtain advice appropriate to the relevant jurisdiction and organization.
