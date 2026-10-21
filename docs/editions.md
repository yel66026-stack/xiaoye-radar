# Community and Pro editions

## Shiye Workbench source addition (2026-10-21)

Shiye Workbench Daylight 2.2.2 is now separately open-sourced in `apps/shiye-workbench` under Apache-2.0. Its UI retains the historical “Pro” name; it does not require a paid license or license server. Its Python engine and React UI are separate from both Xiaoye Radar Community and the private Xiaoye Radar Pro 0.3.1 application described below.

The following boundary rules continue to describe the Community application. Shiye's optional platform-specific browser workflow is contained in its own application. Only source code and synthetic fixtures are published; no user sessions, browser profiles, customer content, or runtime databases are included. See [the update notes](shiye-workbench-update.md).

Xiaoye Radar Community is a complete local workflow for authorized content exports. Pro remains the private commercial desktop product with platform-specific and professional workflows.

| Capability                                            | Community `0.4.2`       | Pro `0.3.1` audited build                                   |
| ----------------------------------------------------- | ----------------------- | ----------------------------------------------------------- |
| General rule engine                                   | Yes                     | Existing private keyword and scoring implementation         |
| Include and exclude terms                             | Yes                     | Yes                                                         |
| Time-window filtering                                 | Yes                     | Yes, including commercial 72-hour flow                      |
| Basic scoring and deduplication                       | Yes                     | Yes, private commercial implementation                      |
| CSV source                                            | Yes                     | Not a claimed Pro feature                                   |
| JSON source                                           | Yes                     | Not a claimed Pro feature                                   |
| Local RSS/Atom source                                 | Yes                     | Not a claimed Pro feature                                   |
| Markdown/text source                                  | Yes                     | Not a claimed Pro feature                                   |
| Local workspace                                       | Atomic JSON             | Migrated SQLite                                             |
| Human review                                          | Yes                     | Candidates and lead-pool workflows                          |
| CSV/JSON export                                       | Yes                     | Candidate export exists; formats are product-dependent      |
| Public Source Adapter contract                        | Yes                     | Owner-approved integration remains future work              |
| Platform-specific integrations                        | No                      | Yes                                                         |
| Account, login, session, and browser-profile handling | No                      | Yes                                                         |
| Professional rule packs                               | Synthetic examples only | Private commercial packs                                    |
| Scheduled or commercial automation                    | No                      | Private product capability                                  |
| License server                                        | No                      | Not part of Community; no Pro claim made here               |
| Telemetry                                             | No                      | Not part of the audited Community scope                     |
| Automatic updater                                     | No                      | Community and audited Pro builder publish no update channel |

## Boundary rules

Community must not receive:

- platform selectors, login flows, cookies, sessions, or browser profiles
- private APIs, services, licensing systems, or update channels
- real customer content, production databases, or authentication state
- complete professional rule packs or customer-specific scoring

Pro can implement the public `NormalizedContent` and `SourceAdapter` contracts later, but the current private application has not been changed to import the public workspaces. That integration requires an owner decision because it changes the commercial build and release dependency.

The two editions use distinct application IDs and storage roots. Community does not read, migrate, or write the Pro database.
