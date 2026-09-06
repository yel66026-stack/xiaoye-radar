# Initial issue backlog

These are candidate tasks for the maintainer to create after the repository is public. They are not existing issues and should not all be opened merely to make the project look active.

| Priority | Candidate issue                    | Suggested acceptance criteria                                                                                |
| -------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Medium   | Add OPML RSS import                | Validate OPML, import local feed definitions, reject unbounded or credential-bearing URLs, and add fixtures. |
| High     | Add a rule-testing playground      | Preview every decision reason and score against synthetic pasted input without modifying the workspace.      |
| Medium   | Improve CSV mapping preview        | Show detected headers, mapping validation, and a bounded synthetic preview before import.                    |
| Medium   | Surface adapter health status      | Display lifecycle state and actionable local-file errors without exposing paths unnecessarily.               |
| Low      | Add reusable export templates      | Define selected fields and ordering while preserving formula-injection protection.                           |
| Medium   | Investigate bounded RSS pagination | Document limits, cancellation, timeout, and authorization policy before any network implementation.          |
| Medium   | Restore regex with hard isolation  | Keep regex disabled until worker or process isolation enforces a tested execution timeout.                   |
| Low      | Improve contributor documentation  | Add a first external-adapter walkthrough after the SDK packaging decision.                                   |
| Research | Investigate a macOS build          | Record signing, sandbox, path, and packaging gaps; do not claim support until tested.                        |
| Research | Investigate a Linux build          | Record distro, sandbox, path, and packaging gaps; do not claim support until tested.                         |

Create an issue only when someone is prepared to triage it. Apply real labels and milestones after the repository's workflow is established.
