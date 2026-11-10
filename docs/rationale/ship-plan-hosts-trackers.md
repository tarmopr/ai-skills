# ship-plan hosts, trackers and notifiers: rationale

Reasons moved out of `skills/ship-plan/hosts/`, `trackers/`, `notifiers/` and `templates-issue.md` to keep them short. Read when changing a rule, not when running a skill.

## Shared rules and where they live

- The issue body, title rule, priority rule, missing-field rule, what is appended and the too-big fallback live once in `templates-issue.md` ("New issue", "Plan appended"). Each tracker keeps only its command, its fields and its `<limit>`/`<chunk>` numbers (Jira 32,767/30,000; GitHub 65,536/60,000). The copies had started to drift.
- CI None, the 10-minute wait for checks to register, "no base-branch run within 5 minutes" and `Green:` live in `phase-verify.md` section 4 step 6 and `phase-merge.md` section 6. Hosts keep only the host command and host-specific signals.
- `Approvals:` can raise, never lower, the host's rule: the host enforces its own rules (GitHub rulesets or protection, Azure DevOps policies) whatever the config says. Canonical in `config-format.md`.
- The GitHub workflow-to-gate rules (`run:` steps, Prerequisites, never-a-gate) live in `config-drafting.md` steps 1 and 3.
- "Tracker unavailable" stays as one line per tracker, not in `templates-issue.md`: the tracker file is what a run reads at *Auth*, before `templates-issue.md` is read.
- Follow-up handling (create nothing when an issue covers it, link a new one) lives in `phase-close.md` section 7; trackers keep only the search.
- The closing-keyword rule reaches implementers and fixers through `phase-implement.md`, verify-and-fix's fix rules and ship-issue's Plan stage: a subagent sees only its own prompt.

## Jira

- The local plan file is authoritative because Jira's markdown conversion can reflow lists, code and links.
- `executeWrite` is pre-approved for `createJiraIssueLink` only, because the pre-approval covers every operation `executeWrite` can run. Attaching the plan (`uploadAttachmentToJiraIssue`) is therefore outside the authorization.

## GitHub Issues

- A branch number is a key only when this run started the branch, its PR links the issue, or a ledger exists: numbers are common in branch names, and a hand-made `fix/<n>-page-styling` must never comment on `#<n>`.

## GitHub host

- `--hostname <host>` on every `gh api` call: `gh api` does not read the host from the git remote, so on GitHub Enterprise it asks `github.com` and gets 404 or another account's login.
- Paid-plan 403 ("Upgrade to GitHub Pro or make this repository public to enable this feature"): the repository can have no rulesets and no branch protection, so GitHub enforces no review rule. With the default of 1 approval, every path after green checks is blocked (only another collaborator could approve), so the run asks right away instead of waiting out `Review wait:`.
- A rerun stays a separate command so it matches the pre-approval.

## Azure DevOps host

- Every command was run read-only against a real Azure DevOps repo on 2026-10-24, except the writes (`pr update`, `pr policy queue`, `pipelines run`, and `az devops invoke` with `POST` or `PATCH`), which were never run.
- `allowSquash` / `allowNoFastForward` were not seen in a real policy: the repo checked had no merge strategy policy. Hence "missing fields: put the output in the batch".
- The PR is opened with `--in-file` JSON, never `--description "$(cat <file>)"`: with no `$(...)` and no shell quoting, the pre-approval matches in every permission mode. The `$(cat …)` form was checked only in auto mode, which showed nothing about prompting modes.
- `az repos pr update --delete-source-branch` does not switch the local checkout, unlike `gh pr merge --delete-branch`.
- *Find the base-branch run*: without `--query-order QueueTimeDesc`, a run still in progress can fall outside `--top`; without `--branch`, the same pipeline's PR builds can fill `--top`.
- The deploy test reads the YAML or the step names because `process.stages` is empty for both kinds of pipeline and cannot tell.

## Slack

- `People:` is repo-wide because reviewers belong to the team (also in `config-format.md`).
