# Tool-neutral ship skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ship-issue`, `ship-plan` and `verify-and-fix` run on GitHub, GitHub Enterprise or Azure DevOps with Jira, Linear or no tracker. Their workflow is written once, and the tool specifics live in files loaded only when needed. `ship` and `verify` are deleted.

**Architecture:** The three `SKILL.md` files name tool-neutral operations ("the host's *Open the PR*"). Each operation is a `##` heading in every file of its kind: `ship-plan/hosts/*.md`, `ship-plan/trackers/*.md` and `ship-plan/notifiers/slack.md`. Six conditional parts move into files read only when a checkable condition holds. The repo config `.claude/ship-plan.md` gains `Host:`, `Tracker:` and `## Linear`.

**Tech Stack:** Markdown skills with YAML frontmatter. The structural checker is Node (`~/.claude/skills/_specs/check-skills.mjs`, which uses Ruby's YAML to parse frontmatter). Behaviour is tested with paper scenarios run by fresh subagents. Azure DevOps commands are checked read-only with the `az` CLI against FIS.

**Spec:** `docs/superpowers/specs/2026-10-24-tool-neutral-ship-skills-design.md`

**Out of scope here:** migrating the five repos and linking the skills on this machine. That is the second plan, `docs/superpowers/plans/2026-10-24-ship-repo-migrations.md`, which starts once this one is merged.

## Global Constraints

- Every existing `.claude/ship-plan.md` stays valid. With no `Host:` and no `Tracker:`, a GitHub repo with `## Jira` behaves exactly as today: no new question, no config edit, the same commands.
- No `gh` command, `az` command or `mcp__` tool name appears in the body of the three `SKILL.md` files. They stay only in frontmatter `allowed-tools` and in the tool files.
- Content moved out of a file is moved verbatim, apart from the renames this plan names ("Jira issue" → "the issue", "Jira comment: X" → "Issue comment: X"). Never paraphrase a rule while moving it.
- Every "read <file>" line in a skill has the form "**When <condition>, read [<file>](<path>).**", and its condition is something the run can check.
- YAML frontmatter has no leading indentation on top-level keys, and it must parse.
- Never pre-approved, anywhere: `--admin`, `--bypass-policy`, `az pipelines run`.
- `Host:` is never asked when an `origin` remote exists, and is written only into a drafted config.
- `Tracker:` values are `jira`, `linear`, `none`. `Host:` values are `github`, `azure-devops`.
- The Slack channel is written only to the committed config. `.claude/ship-plan.local.md` is read, never written.
- Commit trailers on every commit:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

1. **An existing GitHub repo with `## Jira` and no `Host:` or `Tracker:`** must ask nothing new and edit no config. Pinned by scenario S1 (regression) and S6, Task 10.
2. **An Azure DevOps repo with no `.github/` folder** must never be treated as CI None. Pinned by S3, Task 10, and a checker phrase in Task 1.
3. **`Channel: none`** must mean the Slack file is never read and nothing is posted. A machine with an older `.claude/ship-plan.local.md` channel and none in the config must still post there. Pinned by S7c and S7d, Task 10.
4. **A run resumed after compaction in 4R** must not post the Slack re-review twice, nor add the merged reaction twice. Pinned by S8, Task 10.
5. **A repo with only `.claude/ship.md`** must stop with the move message and never draft a new config over it. Pinned by S9, Task 10.

---

## Operation names (shared by every task)

These exact `##` headings are the interface between the skills and the tool
files. Every file of a kind has every heading of its kind. An operation the
tool lacks still gets its heading, with one line saying so (for example
Azure DevOps "Request an AI review": "None on this host. Skip.").

**Host files** (`ship-plan/hosts/github.md`, `ship-plan/hosts/azure-devops.md`):
`## Auth check`, `## Repo identity`, `## Default branch`, `## Has CI`,
`## Where CI is defined`, `## Allowed merge methods`, `## Open the PR`,
`## PR web URL`, `## PR size`, `## Find open PRs`, `## Wait for the PR's checks`,
`## Does CI cover this diff`, `## Read a failed run`, `## Rerun a failed PR check`,
`## Read the review rule`, `## Request an AI review`, `## Re-request a reviewer`,
`## Fetch review items`, `## Reply to a review item`, `## Resolve a bot's thread`,
`## Review state`, `## Merge state`, `## Merge the PR`, `## Find the base-branch run`,
`## Watch a run`, `## Rerun a base-branch run`, `## PR comment`, `## Run web URL`,
`## Never`.

**Tracker files** (`ship-plan/trackers/jira.md`, `ship-plan/trackers/linear.md`):
`## Auth`, `## Issue keys`, `## Integration`, `## Find an issue`, `## Read an issue`,
`## Where a new issue goes`, `## Create an issue`, `## Append the plan`, `## Assign`,
`## Set status`, `## Link the PR`, `## Comment`, `## Link two issues`,
`## Find an existing follow-up`.

**Notifier file** (`ship-plan/notifiers/slack.md`):
`## Choose the channel`, `## People`, `## Review request`, `## Re-review request`,
`## Mark merged`, `## Failures`.

A skill refers to an operation as: the host's *Open the PR*, the tracker's
*Set status*, the notifier's *Mark merged*. The checker (Task 1) matches every
such reference against these lists.

---

### Task 0: Branch and starting material

**Files:**
- Create: `skills/ship-plan/hosts/azure-devops.md` (copied from the uncommitted `skills/ship/hosts.md`)
- Restore: `skills/ship/SKILL.md`, `skills/ship/config-format.md`, `skills/verify/SKILL.md`, `README.md`, `.claude-plugin/plugin.json`

- [ ] **Step 1:** In `/Users/tarmoprotsin/Development/ai-skills`, on branch `feat/ship-azure-devops`, copy `skills/ship/hosts.md` to `skills/ship-plan/hosts/azure-devops.md`. Leave it unedited for now.
- [ ] **Step 2:** Discard the superseded edits: `git restore skills/ship/SKILL.md skills/ship/config-format.md skills/verify/SKILL.md README.md .claude-plugin/plugin.json`, then delete `skills/ship/hosts.md`.
- [ ] **Step 3:** Rename the branch with `git branch -m feat/tool-neutral-ship-skills`, then `git fetch origin main` and `git merge origin/main`.
  - Expected: `git status --short` lists only `docs/` and `skills/ship-plan/hosts/`.
- [ ] **Step 4: Commit** the design, both plans and the starting file:
  ```bash
  git add docs/superpowers skills/ship-plan/hosts/azure-devops.md
  git commit -m "docs: tool-neutral ship skills design and plans"
  ```

### Task 1: Checker and scenarios (the failing tests)

**Files:**
- Rewrite: `~/.claude/skills/_specs/check-skills.mjs` (personal folder, not in git)
- Create: `docs/superpowers/scenarios/README.md` and one file per scenario, `S1-github-jira.md` … `S10-verify-standalone.md`
- Create: `docs/superpowers/scenarios/baseline/S1-github-jira.md` (today's answers)

**Interfaces:**
- Produces: `node ~/.claude/skills/_specs/check-skills.mjs`. It exits 0 with `ok: <n> file(s)`, or exits 1 and prints one `<file>: <check>: <detail>` line per failure. It reads `SKILLS_ROOT`, defaulting to `/Users/tarmoprotsin/Development/ai-skills/skills`.
- Produces: scenario files whose prompt says "Replace SKILLDIR with <path>". A runner agent answers in the format given in `scenarios/README.md`.

- [ ] **Step 1: Rewrite the checker.** Keep its structure, its C1–C8 check ids and its output format, and retarget it:
  - **`FILES`:** the target layout from the spec's "Files" section, with each file's required headings. The three SKILL.md files keep today's section headings. The tool files use the operation lists above. `templates.md` has only `## PR body`. `templates-pr.md` has `## PR comment: done`, `## PR comment: not merged` and `## PR comment: base branch red`. `templates-issue.md` has `## Issue question`, `## New issue`, `## Plan appended`, and `## Issue comment: merged`, `: done`, `: base branch red`, `: not merged`, `: review round` and `: awaiting review`.
  - **C6 allowed-tools:** the exact lists given in Tasks 7, 8 and 9, one constant per skill.
  - **C9 (new), no tool calls in a SKILL body:** after the frontmatter, no line in the three SKILL.md files matches `/\b(gh|az) [a-z]/` or `/mcp__/`.
  - **C10 (new), operation references:** every `the host's *X*`, `the tracker's *X*` and `the notifier's *X*` in any skill file names a heading in the matching list above.
  - **C11 (new), read lines:** every `**When …, read [..](..).**` line links to a file that exists. C7 already checks links; C11 also requires the bold form.
  - **C12 (new), one heading set per kind:** each host file has the same `##` headings as the other, and each tracker file has the same as the other.
  - **Remove** the `ship/*` and `verify/*` entries and the "verify must not pre-approve" rule.
  - **Keep** C3 (tech commands outside config examples; add `config-drafting.md` to `TECH_EXEMPT`), C4 (forest-planner specifics) and C5 (literal `origin/main`).
  - **C8 phrases,** at least:
    - `ship-plan/SKILL.md`: `no PR CI for this diff`, `not pre-approved`, `move \`.claude/ship.md\` to \`.claude/ship-plan.md\``.
    - `config-format.md`: `A missing \`.github/\` folder`, `Tracker:`, `Host:`.
    - `notifiers/slack.md`: `pr-merged`, `thread_ts`.
- [ ] **Step 2: Run it against today's tree.**
  - Run: `node ~/.claude/skills/_specs/check-skills.mjs`
  - Expected: exit 1, with `C0 exists: file missing` for every new file and C9 failures in today's SKILL.md files.
- [ ] **Step 3: Write the scenarios.**
  - **`README.md`** fixes the answer format: per step, the exact command or tool call, the file and heading it came from, "told" or "worked out", and every file read, in order.
  - Each scenario is a paper exercise in the style of the Azure scenario this session ran: a fictional repo, its config, the point in the run, numbered questions, and **Pass if** lines.

  | Id | Setup | Pass if |
  |---|---|---|
  | S1 | GitHub, `## Jira`, no `Host:`/`Tracker:`, full ship-plan run from pre-flight to close-out | Every command and tool call equals the S1 baseline. No new question, no config edit. Reads `hosts/github.md` and `trackers/jira.md`, nothing for Azure DevOps or Linear. |
  | S2 | GitHub Enterprise remote `github.acme.com`, `Tracker: none` | `--hostname github.acme.com` on every `gh api` call. No tracker file read. PR comments from `templates-pr.md`. |
  | S3 | Azure DevOps, `Tracker: linear`, no `.github/`, config `## CI` `Workflow: 12` | Not CI None. Azure DevOps commands from `azure-devops.md`. PR linked through `save_issue` `links`. The 4000-character body split is applied to a 5200-character body. |
  | S4 | Azure DevOps, `Tracker: jira` | The PR URL goes in the Merged comment. No remote link and no `executeWrite` other than `createJiraIssueLink`. |
  | S5 | No `.claude/ship-plan.md`, GitHub remote | Reads `config-drafting.md`. The draft has `Host: github`. Asks the tracker question once, with Jira, Linear and "No tracker". |
  | S6 | `## Jira` present, no `Tracker:` | Tracker resolves to `jira`. The tracker question is never asked. |
  | S7a–e | One run each: (a) open PR under verify-and-fix; (b) busy checkout under ship-issue; (c) `Channel: none`; (d) no `## Slack` in config, `.claude/ship-plan.local.md` has a channel; (e) red base-branch run with a `Docs PR:` line | (a) reads `review-comments.md`. (b) reads `worktree.md`. (c) never reads `notifiers/slack.md`. (d) posts to the local file's channel and writes nothing to the local file. (e) reads `red-base.md`; `docs-pr.md` waits. |
  | S8 | A review round addressed comments from `alice` (in `People:`) and `bob` (not in it), then compaction, resume, then merge | One thread reply mentioning `<@U…>` for alice and plain "bob", recorded once. A `Lesson:` for bob. After the resume, no second reply. On merge, one `slack_add_reaction` `pr-merged`. |
  | S9 | Repo has `.claude/ship.md` and no `.claude/ship-plan.md` | Each of the three skills stops in pre-flight with the move line. Nothing is drafted. |
  | S10 | verify-and-fix on a branch with no PR | Never reads `review-comments.md` or any tracker file. |

- [ ] **Step 4: Capture the S1 baseline.**
  - Dispatch one fresh `general-purpose` subagent with S1 and `SKILLDIR` set to a copy of today's `skills/` in the scratchpad.
  - Save its answers verbatim to `scenarios/baseline/S1-github-jira.md`.
  - Expected: answers with `gh` and Atlassian calls throughout.
- [ ] **Step 5: Commit** the scenarios and the baseline: `git add docs/superpowers/scenarios`, then `git commit -m "test: scenarios and S1 baseline for tool-neutral ship skills"`. The checker is outside git.

### Task 2: Host files

**Files:**
- Create: `skills/ship-plan/hosts/github.md`
- Rewrite: `skills/ship-plan/hosts/azure-devops.md`

**Interfaces:**
- Produces: the host operation headings above, in both files.

- [ ] **Step 1: Write `github.md`.** Each heading holds the commands `ship-plan` and `verify-and-fix` use today, moved verbatim with their GitHub-only notes:
  - the `--hostname <host>` rule (ship-plan §4R intro);
  - `gh run watch` exiting 1 on an API error (§6.1);
  - the `reviewDecision` and `mergeStateStatus` reading (§5.1, §4R.3);
  - workflow `on:` blocks (§4.6);
  - the ruleset and branch-protection calls (§4R.1);
  - the GraphQL thread query, reply and resolve (verify-and-fix §4b);
  - `gh pr list` for copies in flight (verify-and-fix §4);
  - `--add-reviewer @copilot` and the Copilot logins (§4R.2, §4b);
  - the merge and `--delete-branch` checkout effect (§5.3).
  - `## Never`: `--admin`, approving, dismissing a review, resolving a person's thread.
- [ ] **Step 2: Rewrite `azure-devops.md`** into the same headings, keeping every command verified in this session. Close the spec's eight gaps:
  1. **`## Open the PR`:** write `pr-body.md` (the head) and `pr-body-rest.md`. The head runs up to `## What changed`. If that is still over 3,900 characters, the head is the summary paragraph and a link line, "Full description in the first comment". The rest is posted with *PR comment* right after creation, and the head's last line says where the rulings are.
  2. **`## Find the base-branch run`:** no run within 5 minutes is "no base-branch run for `<sha>`". Never queue one.
  3. **Batched CI:** list recent runs on the base branch with `--query "[].{id:id,sourceVersion:sourceVersion,reason:reason}"` (no SHA filter), `git fetch origin <base>`, then for each candidate `git merge-base --is-ancestor <sha> <sourceVersion>`.
  4. **`## Rerun a base-branch run`:** never when the config's `## Never do` names the pipeline, or its definition has a deploy stage (`az pipelines show --id <pipeline> --query "process.stages"`, or a `deployment` job in its YAML). The exact allow line goes to ship-plan's pre-flight batch (Task 8 consumes this).
  5. **`## Does CI cover this diff`:** `filenamePatterns` are evaluated in order, the last match wins, `/` is the repo root, `!` excludes, and a pattern without `/` matches at any depth.
  6. **`## Review state`:** a blocking non-review policy gets its own park text, "needs: <policy display name>", not "needs approval".
  7. **`## Merge state`:** always read the blocking policies, CI or not.
  8. **`"$(cat <file>)"`:** run one throwaway check in this session. In FIS, write the line `[0].title` to a file in the scratchpad and run `az repos pr list --top 1 --query "$(cat <file>)" -o tsv` in a session whose settings allow `Bash(az repos pr list *)`. If Claude Code prompts although `Bash(az repos pr list *)` is allowed, `## Open the PR` uses `az devops invoke --area git --resource pullRequests --http-method POST --in-file <json>` instead, with the JSON written by the Write tool. Record which one in the file.
  - `## Read the review rule`: approvals from the base branch's "Minimum number of reviewers" policy (`az repos policy list`), 0 when there is none; "Comment requirements" means threads must be resolved; `## Request an AI review`: none on this host, and a config `Copilot review: yes` is named in the report as having no effect.
  - Also the review-thread mapping from the spec's "Azure DevOps" section: fetch, reply (`pullRequestThreadComments`), resolve (thread status), no re-request, votes 10/5 approved and -10 changes requested.
- [ ] **Step 3: Read-only `az` checks.** Run every new read command in `azure-devops.md` against FIS (`/Users/tarmoprotsin/Development/FIS`; PR 788, runs 2342 and 2309). Expected: each returns the fields the file says it reads. Never run a write command.
- [ ] **Step 4: Run the checker:** `node ~/.claude/skills/_specs/check-skills.mjs ship-plan/hosts/github.md ship-plan/hosts/azure-devops.md`. Expected: `ok: 2 file(s)`.
- [ ] **Step 5: Commit:** `feat(ship-plan): host files for GitHub and Azure DevOps`

### Task 3: Tracker files

**Files:**
- Create: `skills/ship-plan/trackers/jira.md`, `skills/ship-plan/trackers/linear.md`

**Interfaces:**
- Produces: the tracker operation headings above, in both files.

- [ ] **Step 1: Write `jira.md`.** Move verbatim:
  - everything Jira-specific in `ship-plan/templates.md` "Jira: issue question" (Site, candidates, projects, epics) under `## Where a new issue goes`;
  - "Jira: new issue" and "Jira: plan appended" mechanics, including the HTML read and write and the 32,767-character split from `ship-issue` I5, under `## Create an issue` and `## Append the plan`;
  - transitions by name, the `account_id` from `atlassianUserInfo`, `cloudId`;
  - `createJiraIssueLink` with `linkType`, and the "`type` is refused" note;
  - ship-plan §7.7's duplicate search, the JQL and the ORIG examples, under `## Find an existing follow-up`;
  - under `## Integration`: GitHub for Jira links by key in branch and title on `github`; nothing links on `azure-devops`, so the PR URL goes in the Merged comment and no remote link is made;
  - the connector-name note from the spec's "Permissions".
- [ ] **Step 2: Write `linear.md`** from `git show main:skills/ship/SKILL.md` §1, `main:skills/ship/templates.md` "Linear: …", and `main:skills/ship/config-format.md` `## Linear`:
  - team and project, statuses by name, `save_issue` with `assignee: "me"`, `links` and `patch` append;
  - "never use Linear's `gitBranchName`";
  - `## Integration`: Linear's GitHub integration links by key on `github`; on `azure-devops`, the PR goes in `links` and the Merged comment;
  - `## Set status` covers the start, review and done statuses.
- [ ] **Step 3: Run the checker** on both files. Expected: `ok: 2 file(s)`, C12 included.
- [ ] **Step 4: Commit:** `feat(ship-plan): tracker files for Jira and Linear`

### Task 4: Config format and drafting

**Files:**
- Modify: `skills/ship-plan/config-format.md`
- Create: `skills/ship-plan/config-drafting.md`

- [ ] **Step 1: Move** "Drafting a missing config" and "Examples" verbatim from `config-format.md` into `config-drafting.md`.
- [ ] **Step 2: In `config-format.md`:**
  - add `Host:` and `Tracker:` rows to `## Repo`, with the values and defaults from the spec's config table;
  - add `### \`## Linear\``, with `Team:`, `Project:`, `Start status:`, `Review status:`, `Done status:`, `Done means:` and `Notes:`;
  - add the per-host meaning of `Approvals:`, `Copilot review:` and `Workflow:`;
  - replace the CI None sentence: absent `## CI` plus the host's *Has CI* false means `None`, and "A missing `.github/` folder alone never means `None`";
  - `## Slack`: the channel is written only here, `.claude/ship-plan.local.md` is read when this section is missing and never written, and add the `People:` table (login | Slack user id);
  - one line: "**When the config is missing or a section must be drafted, read [config-drafting.md](config-drafting.md).**"
- [ ] **Step 3: In `config-drafting.md`,** add step 0 "Host and tracker":
  - `Host:` from the remote, written into the draft;
  - no `origin`: no `Host:`, with a note that PRs can't be opened;
  - `Tracker:` from the tracker question.
  - Then per-host CI drafting: GitHub workflows as today; Azure DevOps YAML pipelines read like workflows, and classic pipelines give gates from manifests, with the pipeline id in `## CI`.
  - Add `Host:` and `Tracker:` to the example config.
- [ ] **Step 4: Run the checker** on both files. Expected: ok.
- [ ] **Step 5: Commit:** `feat(ship-plan): Host, Tracker and Linear in the config`

### Task 5: Templates split

**Files:**
- Modify: `skills/ship-plan/templates.md`
- Create: `skills/ship-plan/templates-issue.md`, `skills/ship-plan/templates-pr.md`

- [ ] **Step 1:** `templates.md` keeps its intro and `## PR body`.
  - **To `templates-pr.md`:** the three `## PR comment: …` sections, verbatim.
  - **To `templates-issue.md`:** "Jira: issue question" becomes `## Issue question` (the question table and the "no issue" option rule, tracker-neutral). "Jira: new issue" becomes `## New issue` and "Jira: plan appended" becomes `## Plan appended`, keeping only the text and leaving the calls to Task 3. Every "Jira comment: X" becomes `## Issue comment: X`.
  - The tracker question goes in front of `## Issue question`: "Which tracker does this repo use?", with Jira, Linear and "No tracker (the PR is the record)", asked only when `Tracker:` is unresolved.
  - "Review reply" and "Slack: review request" are left for Tasks 6 and 7.
- [ ] **Step 2: Run the checker** on the three files. Expected: ok.
- [ ] **Step 3: Commit:** `refactor(ship-plan): split templates by when they are used`

### Task 6: Slack notifier

**Files:**
- Create: `skills/ship-plan/notifiers/slack.md`
- Modify: `skills/ship-plan/templates.md` (remove "Slack: review request")

- [ ] **Step 1: Move into `slack.md`, verbatim:**
  - ship-plan §0.6 (search, options, "Other") under `## Choose the channel`, except the "Record it twice" rule, which becomes: write `## Slack` to the config only, as the feature branch's first commit;
  - §4R.2's Slack paragraph and the "Slack: review request" template under `## Review request`.
- [ ] **Step 2: Add the new sections:**
  - **`## People`:** the `People:` table lookup. A login missing from the table is looked up with `slack_search_users` by display name or email. If found, add it to the table, committed with the run's lessons. If not found, use the plain name and record a `Lesson:`.
  - **`## Re-review request`:** when, what, who and the ledger line `Slack: re-review <ts> <names>`, from the spec. Uses `slack_send_message` with `thread_ts`, and includes the template text.
  - **`## Mark merged`:** `slack_add_reaction` with name `pr-merged`, the ledger line `Slack: merged reaction`, and once per PR.
  - **`## Failures`:** a `Lesson:`, never retried another way, never a reason to stop. An unknown emoji goes to `blockers.md`.
- [ ] **Step 3: Run the checker.** Expected: ok, including the `pr-merged` and `thread_ts` phrases.
- [ ] **Step 4: Commit:** `feat(ship-plan): Slack notifier file with re-review and merged reaction`

### Task 7: verify-and-fix

**Files:**
- Modify: `skills/verify-and-fix/SKILL.md`
- Create: `skills/verify-and-fix/review-comments.md`

**Interfaces:**
- Consumes: host operations *Default branch*, *Wait for the PR's checks*, *Read a failed run*, *Find open PRs*, *Repo identity*, *Fetch review items*, *Reply to a review item*, *Resolve a bot's thread*, *Re-request a reviewer*; the tracker's *Comment*.

- [ ] **Step 1: Move §4b verbatim** into `review-comments.md`, with ship-plan's "Review reply" template. Then replace its commands with operation references.
- [ ] **Step 2: In SKILL.md:**
  - add "**When the branch has an open PR, read [review-comments.md](review-comments.md).**" where §4b was;
  - setup reads the config, resolves `Host:`/`Tracker:`, and reads `../ship-plan/hosts/<host>.md`;
  - base branch, CI gate and copy check use operations;
  - the ship-repo guard line (`.claude/ship.md` without `.claude/ship-plan.md`: stop with the move line);
  - "Jira comment: review round" becomes the tracker's *Comment* with `Issue comment: review round`, skipped with no tracker;
  - the description becomes tool-neutral and names GitHub, GitHub Enterprise and Azure DevOps.
- [ ] **Step 3: allowed-tools** = today's list, plus:
  `Bash(az repos pr show *)`, `Bash(az repos pr list *)`, `Bash(az repos pr policy list *)`,
  `Bash(az repos show *)`, `Bash(az pipelines runs show *)`,
  `Bash(az devops invoke --area build --resource timeline *)`, `Bash(az devops invoke --area build --resource logs *)`,
  `Bash(az devops invoke --area git --resource pullRequestThreads *)`,
  `Bash(az devops invoke --area git --resource pullRequestThreadComments *)`,
  `Bash(az account show)`, `mcp__plugin_engineering_linear__get_issue`, `mcp__plugin_engineering_linear__save_comment`.
  Put the same list in the checker's constant.
- [ ] **Step 4: Run the checker:** `node ~/.claude/skills/_specs/check-skills.mjs verify-and-fix/SKILL.md verify-and-fix/review-comments.md`. Expected: ok, C9 clean.
- [ ] **Step 5: Commit:** `refactor(verify-and-fix): tool-neutral steps, review comments on demand`

### Task 8: ship-plan

**Files:**
- Modify: `skills/ship-plan/SKILL.md`
- Create: `skills/ship-plan/docs-pr.md`, `skills/ship-plan/red-base.md`

**Interfaces:**
- Consumes: every host, tracker and notifier operation; `templates-issue.md` and `templates-pr.md` section names (Task 5); the `## Rerun a base-branch run` allow line (Task 2).

- [ ] **Step 1: Move verbatim:** §7.3 into `docs-pr.md`, §6.3's red handling (transient reruns, new transient, fix forward, revert, the 3-cycle limit) into `red-base.md`. Then replace the commands in both with operation references.
- [ ] **Step 2: In SKILL.md:**
  - **"Before anything else":** resolve `Host:`/`Tracker:` (spec defaults), read `hosts/<host>.md`, and read `trackers/<tracker>.md` unless the tracker is `none`.
  - **Guard:** `.claude/ship.md` without `.claude/ship-plan.md` stops with the line "This repo is set up for the removed `ship` skill: move `.claude/ship.md` to `.claude/ship-plan.md` and `.claude/ship/` to `.claude/ship-plan/`."
  - **No `origin`:** stop before §4, saying so.
  - **Every `gh` and Atlassian step** becomes an operation reference. "Jira issue" becomes "the issue", and "No Jira issue" becomes "no issue".
  - **§0.5:** the tracker question when `Tracker:` is unresolved, written to `## Repo` with the drafted tracker section on the feature branch's first commit.
  - **§0.6:** "When `## Slack` is missing from the config and from `.claude/ship-plan.local.md`, read [notifiers/slack.md](notifiers/slack.md) and choose the channel."
  - **Pre-flight's allow-line batch:** add the host's *Rerun a base-branch run* line when the host has one.
  - **§4R step 2:** the notifier's *Review request*.
  - **§4R step 3:** the notifier's *Re-review request* after each `--comments` round.
  - **§5:** the notifier's *Mark merged* after the merge. Each Slack hook is skipped when the channel is `none`.
  - **§6:** "**When the base-branch run is red, read [red-base.md](red-base.md).**"
  - **§7:** "**When the ledger has a `Docs PR:` line and the code PR merged, read [docs-pr.md](docs-pr.md).**"
  - **Templates:** "**When the run has an issue, read [templates-issue.md](templates-issue.md); otherwise [templates-pr.md](templates-pr.md).**"
  - **§7.7:** the tracker's *Find an existing follow-up*.
  - **Description:** tool-neutral.
  - **Red flags:** reword the Jira-only rows ("Move it to In Review" becomes "Use only the statuses the config names"). Replace "No workflows means CI None" with the host's *Has CI*.
- [ ] **Step 3: allowed-tools** = today's list, plus:
  - Azure DevOps:
    `Bash(az account show)`, `Bash(az devops configure --list)`, `Bash(az repos show *)`, `Bash(az repos policy list *)`, `Bash(az pipelines list *)`,
    `Bash(az repos pr create *)`, `Bash(az repos pr show *)`, `Bash(az repos pr list *)`, `Bash(az repos pr policy list *)`, `Bash(az repos pr policy queue *)`,
    `Bash(az repos pr update --id * --status completed --squash true --delete-source-branch true)`,
    `Bash(az repos pr update --id * --status completed --squash false --delete-source-branch true)`,
    `Bash(az pipelines runs list *)`, `Bash(az pipelines runs show *)`,
    `Bash(az devops invoke --area build --resource timeline *)`, `Bash(az devops invoke --area build --resource logs *)`,
    `Bash(az devops invoke --area git --resource pullRequestThreads *)`, `Bash(az devops invoke --area git --resource pullRequestThreadComments *)`;
  - git: `Bash(git merge-base *)`;
  - Linear, each `mcp__plugin_engineering_linear__` + `get_user`, `get_issue`, `list_issues`, `list_comments`, `list_issue_statuses`, `save_issue`, `save_comment`;
  - Slack: `mcp__plugin_engineering_slack__slack_add_reaction`, `mcp__plugin_engineering_slack__slack_search_users`.
  - If Task 2 Step 2 item 8 chose `az devops invoke` for PR creation, also add `Bash(az devops invoke --area git --resource pullRequests --http-method POST *)`.
- [ ] **Step 4: Run the checker** on all `ship-plan/` files. Expected: ok, with C9, C10 and C11 clean.
- [ ] **Step 5: Commit:** `refactor(ship-plan): tool-neutral workflow, files loaded on demand`

### Task 9: ship-issue

**Files:**
- Modify: `skills/ship-issue/SKILL.md`, `skills/ship-issue/stage-prompts.md`
- Create: `skills/ship-issue/worktree.md`

- [ ] **Step 1: Move §W verbatim** into `worktree.md`. Leave "**When the current checkout is dirty or on another branch, read [worktree.md](worktree.md).**" where §W was.
- [ ] **Step 2: In SKILL.md:**
  - "All work is tracked in a Jira issue" becomes: tracked in the repo's tracker, and with `Tracker: none` the PR is the record. The tracker question and the issue question (with "No issue" when the tracker is `none`) come from `../ship-plan/templates-issue.md`.
  - With no issue, the ledger is `.superpowers/ship-issue/<slug>/` and the branch is `<type>/<slug>`.
  - I5 is renamed `## I5. Tracker`: append via the tracker's *Append the plan*, comments via *Comment*, links via *Link two issues*. With no tracker it is skipped.
  - I0 and I1 use the host's *Find open PRs* and the tracker's *Find an issue* and *Read an issue*.
  - Add the ship-repo guard line.
  - The description and argument hint become tool-neutral (`[issue key | a description of the problem]`).
- [ ] **Step 3: In `stage-prompts.md`,** replace "write to Jira" with "write to the tracker", and the `gh pr view` line with the host's *Merge state*.
- [ ] **Step 4: allowed-tools** = today's list, plus:
  - Azure DevOps: `Bash(az account show)`, `Bash(az repos pr list *)`, `Bash(az pipelines runs list *)`;
  - Linear, each `mcp__plugin_engineering_linear__` + `get_user`, `get_issue`, `list_issues`, `list_comments`, `list_teams`, `list_projects`, `save_issue`, `save_comment`.
- [ ] **Step 5: Run the checker** on the `ship-issue/` files. Expected: ok.
- [ ] **Step 6: Commit:** `refactor(ship-issue): tracker-neutral, no-tracker path, worktree on demand`

### Task 10: Scenarios (green)

- [ ] **Step 1: Run S1–S10.** Dispatch one fresh `general-purpose` subagent per scenario, in parallel, with `SKILLDIR=/Users/tarmoprotsin/Development/ai-skills/skills`. Save each answer to `docs/superpowers/scenarios/results/<id>.md`.
- [ ] **Step 2: Compare S1 with the baseline,** command by command. Expected: identical commands and tool calls. Differences are allowed only in wording, and in the extra files read (`hosts/github.md`, `trackers/jira.md`).
- [ ] **Step 3: Check every scenario's "Pass if" lines.** For each failure:
  - fix the skill file it points at, quoting the line;
  - rerun only that scenario;
  - at most 3 rounds per scenario, then stop and report.
- [ ] **Step 4: Run** `node ~/.claude/skills/_specs/check-skills.mjs` and `claude plugin validate .`. Expected: `ok: <n> file(s)` and `✔ Validation passed`.
- [ ] **Step 5: Commit:** `test: tool-neutral ship skills pass S1–S10`, with the results and any fixes.

### Task 11: Remove ship and verify, publish

**Files:**
- Delete: `skills/ship/`, `skills/verify/`
- Modify: `README.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (description only)

- [ ] **Step 1:** `git rm -r skills/ship skills/verify`.
- [ ] **Step 2: README:**
  - remove the `ship` and `verify` rows;
  - describe `ship-issue`, `ship-plan` and `verify-and-fix` as working on GitHub, GitHub Enterprise or Azure DevOps with Jira, Linear or no tracker;
  - drop "The Linear set … and the Jira set … are independent";
  - the install line stays.
- [ ] **Step 3: Version and description:** bump `version` in `.claude-plugin/plugin.json` from its value on `main` to the next minor (`0.3.6` → `0.4.0`). Match the plugin and marketplace descriptions to the new README line.
- [ ] **Step 4: Run** the checker, `claude plugin validate .`, and `grep -rn "skills/ship/\|skills/verify/\|/ship \|/verify " README.md skills docs/superpowers/specs`. Expected: ok, passed, and no grep hits outside history notes.
- [ ] **Step 5: Commit:** `feat!: tool-neutral ship-issue, ship-plan and verify-and-fix; remove ship and verify`
- [ ] **Step 6: Ask the user** before pushing and opening the PR into `main`. The symlinks on this machine change only in the migrations plan, after forest-planner's PR merges.
