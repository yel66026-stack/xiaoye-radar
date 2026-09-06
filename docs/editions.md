# Community and Pro editions

Xiaoye Radar Community is a complete local workflow for authorized content exports. Pro remains the private commercial desktop product with platform-specific and professional workflows.

| Capability                                            | Community `0.4.0`       | Pro `0.3.1` audited build                                   |
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
