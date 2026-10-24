# Tool-neutral ship skills: design

Date: 2026-10-24. Status: approved 2026-10-24.

## Why

`ship-issue`, `ship-plan` and `verify-and-fix` carry work from an issue or a
plan to a merged PR on a green base branch, unsupervised. Today they only work
in a GitHub repo that tracks work in Jira. A second, older set, `ship` and
`verify`, does the same for GitHub with Linear or no tracker. The user's repos
mix GitHub, GitHub Enterprise and Azure DevOps (Azure Repos and Azure
Pipelines), with Jira or Linear as the tracker. FIS, the busiest `ship` repo,
is on Azure DevOps with Linear and only works because its config tells the
agent, in prose, to translate every `gh` step into `az`.

The goal is one set of skills, with the workflow written once and the tool
specifics kept out of it.

## Goals

- `ship-issue`, `ship-plan` and `verify-and-fix` run on any combination of:
  - **host and CI:** GitHub, GitHub Enterprise, Azure DevOps;
  - **tracker:** Jira, Linear, none.
- The three `SKILL.md` files describe the workflow in tool-neutral steps
  ("open the PR", "wait for the PR's checks", "move the issue to its start
  status"). The commands for each step live in one file per tool, next to the
  skills.
- A run reads only the files for its repo's host and tracker.
- A repo's host and tracker are chosen on the first run, written to the repo's
  config, and read from there on every later run without asking.
- Every repo that uses `ship-issue`, `ship-plan` or `verify-and-fix` today
  keeps working with no edits to its files. Repos on `ship` are moved once
  (see "Removing `ship` and `verify`").
- `ship` and `verify` are deleted.

## Non-goals

- Trackers other than Jira and Linear, or hosts other than GitHub, GitHub
  Enterprise and Azure DevOps. The layout must make adding one a new file plus
  `allowed-tools` lines, but none is added now.
- Changing the workflow itself: the phases, the review loop, the question
  batching, the lessons logs stay as they are.
- A Linear version of anything `ship` did that `ship-plan` doesn't already do.
  `ship-plan` is the base; `ship` contributes only its Linear knowledge.

## Anti-goals

- Tool branches spread through the skills ("on Azure DevOps … on GitHub …" in
  every section). That is the bloat this design exists to remove.
- An existing Jira-on-GitHub repo that behaves differently after the change.
- A run that stalls on a permission prompt for a command the old skills
  pre-approved.
- A run that merges without CI because a repo has no `.github/` folder.

## Current state

- **Configs.** The Jira set reads three repo files, all keep their names and
  formats:
  - `.claude/ship-plan.md`, the committed config (`ship-plan/config-format.md`);
  - `.claude/ship-plan.local.md`, git-ignored, this machine only; today it
    holds only `## Slack` (`ship-plan/SKILL.md:210`);
  - `.claude/ship-plan/` with `interruptions.md` and `blockers.md`, plus
    `.claude/ship-issue/interruptions.md`.
- **`ship` repos** (FIS) use `.claude/ship.md` and `.claude/ship/`.
- **Tool coupling.** Every PR, review and CI step in `ship-plan` and
  `verify-and-fix` is a `gh` command, with GitHub-only notes (`gh run watch`
  exit codes, `reviewDecision`, workflow `on:` blocks, GraphQL thread ids).
  Every tracker step is an Atlassian MCP call. `ship-issue` states "There is no
  'no Jira' path" (`ship-issue/SKILL.md:66`).
- **GitHub Enterprise already works**: `ship-plan` and `verify-and-fix` take
  `<host>` from `gh repo view --json url` and append `--hostname <host>` to
  every `gh api` call (`ship-plan/SKILL.md:357`).
- **Azure DevOps commands are already worked out and checked** against FIS,
  read-only, in the uncommitted `skills/ship/hosts.md` on branch
  `feat/ship-azure-devops`, together with a list of gaps two test runs found.
- **This machine** loads `ship`, `verify`, `handoff` and `continue-handoff` as
  symlinks from `~/.claude/skills` into this repo. `ship-issue`, `ship-plan`
  and `verify-and-fix` are not linked here.

## The design

### Files

```
skills/
  ship-plan/
    SKILL.md            workflow only
    config-format.md    the config, including Host and Tracker
    config-drafting.md  drafting a missing config, and the examples
    templates.md        the PR body
    templates-issue.md  the issue question and issue comments (with a tracker)
    templates-pr.md     the closing PR comments (no tracker)
    docs-pr.md          the docs PR at close-out
    red-base.md         a red base branch: reruns, fix forward, revert
    log-formats.md
    hosts/
      github.md         GitHub and GitHub Enterprise
      azure-devops.md   Azure Repos and Azure Pipelines
    trackers/
      jira.md
      linear.md
    notifiers/
      slack.md          review request, re-review thread, merged reaction
  verify-and-fix/
    SKILL.md
    ui-testing.md       (exists today)
    review-comments.md  PR review comments: fetch, keys, grade, reply, resolve
  ship-issue/
    SKILL.md, stage-prompts.md, evidence.md, log-formats.md (exist today)
    worktree.md         choosing and preparing a worktree
```

`verify-and-fix` and `ship-issue` read `../ship-plan/hosts/`, `trackers/` and
`notifiers/` as needed.

`ship` and `verify` are removed.

There is no `trackers/none.md`. "No tracker" is a workflow rule (the PR is the
record), not a tool, and stays in `ship-plan/SKILL.md` where it is today.

### Loaded only when needed

Besides the tool files, six parts of today's skills apply only to some runs.
They move out of the main files, so a run that doesn't need them never reads
them (the user's decision). Each leaves one line behind in the main file,
"when <condition>, read <file>", and the condition is something the run can
check:

| Moves out of | Into | Read when | Words today |
|---|---|---|---|
| `verify-and-fix` §4b, PR review comments, plus `templates.md`'s "Review reply" | `verify-and-fix/review-comments.md` | the branch has an open PR (including `--comments` mode) | 762 |
| `config-format.md`, "Drafting a missing config" and "Examples" | `ship-plan/config-drafting.md` | `.claude/ship-plan.md` is missing, or a section must be drafted | 647 |
| `templates.md`, the issue question, "new issue", "plan appended" and every issue comment | `ship-plan/templates-issue.md` | `Tracker:` is not `none`, or the tracker question is asked | 1,356 with the PR comments |
| `templates.md`, the three closing PR comments | `ship-plan/templates-pr.md` | the run has no issue | (in the row above) |
| `ship-issue` §W, which checkout | `ship-issue/worktree.md` | the current checkout is busy (dirty, or on another branch) | 498 |
| `ship-plan` §7.3, the docs PR | `ship-plan/docs-pr.md` | the ledger has a `Docs PR:` line and the code PR merged | 306 |
| `ship-plan` §6.3–6.4, red base branch | `ship-plan/red-base.md` | the base-branch run is red | 287 |

- `templates.md` keeps only the PR body, which every run writes.
- The tracker mechanics in today's templates (Jira's HTML append, the
  32,767-character split, `createJiraIssueLink`) go to `trackers/jira.md`,
  not to `templates-issue.md`. `templates-issue.md` holds tracker-neutral
  text only.
- Two more parts shrink because their content is tracker-specific and goes to
  the tracker files: `ship-plan` §7.7 (the follow-up issue search, 209 words)
  and `ship-issue` I5 (268 words).
- **What stays in the main files,** because every run uses it: the step
  order and resume rules, the authorization lists, the question rules,
  §2b Simplify, the review loop, lessons, and the red flags.
- **A missed read is the risk.** The checker (see "Verification") confirms
  that every "read <file>" line names a file that exists, and the paper
  scenarios include one for each condition: no config, an open PR, a busy
  checkout, a `Docs PR:` line, a red base branch.

**Why files and not sub-skills:** a sub-skill appears in every session's skill
list, can be started on its own, and carries its own `allowed-tools`, which
may not apply when another skill invokes it. A file is read only when the
config names it, and the main skill's frontmatter pre-approves its commands.

### What a tool file contains

Each tool file is a reference: one section per operation, named the same in
every file of its kind, so a skill can say "the host's *Wait for the PR's
checks*" and every host file answers it.

**Host operations** (`hosts/*.md`), each with the exact command, how to read
its output, and its failure modes:

| Operation | Used by |
|---|---|
| Auth check; default branch; host and repo identity; your login | pre-flight, config draft |
| Has CI; where CI is defined (for drafting gates); allowed merge methods | config draft, CI None rule |
| Open the PR (title, body from a file); its web URL; its size | ship-plan 4, docs PR, lessons PR, Slack |
| Open PRs by search, and by changed files under a folder | ship-issue routing, verify-and-fix copy check, lessons PR merge |
| Wait for the PR's checks; does CI cover this diff; read a failed run; rerun a failed check | ship-plan 4, verify-and-fix CI gate |
| Read the review rule (approvals, code owners, stale dismissal, thread resolution) | ship-plan 4R |
| Request an AI review; re-request a reviewer | ship-plan 4R, verify-and-fix 4b |
| Fetch review items (threads, review bodies, conversation comments) with stable keys; reply; resolve a bot's thread | verify-and-fix 4b |
| Review state: approvals per reviewer, changes requested, pending AI review | ship-plan 4R, 5 |
| Mergeable and conflict state; merge; merge SHA; what the merge does to the local checkout | ship-plan 5 |
| Find the base-branch run for a SHA; watch it; green and red; read it; rerun it | ship-plan 6 |
| PR comment; run web URL | close-out |
| Never: flags and actions this host must never use | authorization |

`github.md` is the commands `ship-plan` and `verify-and-fix` use today, moved
verbatim, including the GitHub Enterprise `--hostname` rule.
`azure-devops.md` starts from `skills/ship/hosts.md` and closes the gaps its
tests found (listed under "Azure DevOps", below).

**Tracker operations** (`trackers/*.md`):

| Operation | Used by |
|---|---|
| Auth and your account id | pre-flight |
| Issue key format, and how a key in a branch name or PR title is recognised | issue lookup, branch naming |
| Find an issue (by key, by text); read it with comments and linked issues | ship-issue I1, ship-plan 0.5 |
| The issue question: existing, new, or none; where a new one goes (Jira project and epic, Linear team, project and parent) | ship-plan 0.5, ship-issue I1 |
| Create an issue; append the plan to its description (and the size limit); assign it | ship-plan 1, ship-issue I5 |
| Move to the start, review and done status | ship-plan 1, 4R, 7 |
| Link the PR (integration by key, or an explicit link) | ship-plan 4 |
| Comment; link two issues (blocks, relates) | throughout |
| Search for an existing follow-up before creating one | ship-plan 7 |

`jira.md` is today's Atlassian calls and Jira rules, moved verbatim
(`cloudId`, transitions by name, HTML description append, the 32,767-character
limit, `createJiraIssueLink`). `linear.md` comes from `ship`'s Linear sections
(team and project, statuses by name, `save_issue` with `links`, "never use
Linear's `gitBranchName`").

**How the PR is linked depends on host and tracker together.** GitHub for Jira
and Linear's GitHub integration link a PR by the key in its branch and title;
on Azure DevOps nothing does. Each tracker file says what its integration
does per host, and the config's tracker `Notes:` can override it. Without an
integration, the PR's URL goes in the tracker's "Merged" comment, and on
Linear also in `save_issue` `links`, as `ship` does today. Jira gets no remote
link: that would need a new `executeWrite` operation, which widens what the
skills may do. (My call.)

### The config

`.claude/ship-plan.md` gains two optional fields under `## Repo`, and one
optional section. Every existing config stays valid, and the defaults
reproduce today's behaviour.

| Field | Values | Default when missing |
|---|---|---|
| `Host:` | `github`, `azure-devops` | From `git remote get-url origin`: `dev.azure.com` or `*.visualstudio.com` is `azure-devops`; anything else, GitHub Enterprise included, is `github`. |
| `Tracker:` | `jira`, `linear`, `none` | `## Jira` present: `jira`. `## Linear` present: `linear`. Neither: not decided yet (below). |

- **`## Linear`** (new): `Team:`, `Project:`, `Start status:`, `Review status:`,
  `Done status:`, `Done means:`, `Notes:`. These are `ship`'s fields plus
  `Review status:`, the counterpart of Jira's `Review transition:`.
- **GitHub Enterprise needs no setting.** The hostname comes from the remote,
  as it does today.
- **Fields that mean something different per host:**
  - `Approvals:`. GitHub: rulesets, then branch protection, as today. Azure
    DevOps: the base branch's "Minimum number of reviewers" policy; no such
    policy means 0, because the policies were readable.
  - `Copilot review:`. GitHub only. On Azure DevOps it defaults to `no`, and a
    `yes` is named in the report as having no effect.
  - `## CI` `Workflow:`. A workflow file on GitHub, a pipeline definition id
    on Azure DevOps.
- **CI None** is decided by the host's *Has CI*, never by a missing
  `.github/` folder.

**First run, or a field missing.**
- `Host:` is never asked when the repo has an `origin` remote: the remote
  decides it. It is written only into a drafted config, never added to an
  existing one, so a Jira-on-GitHub repo's next PR carries no config edit.
  With no `origin` remote there is no PR to open: the run says so and stops
  before section 4, as it would today. (My call.)
- `Tracker:` is asked once, as the first question of the issue question
  (ship-plan pre-flight step 5, ship-issue I1), which already waits for its
  answer: "Which tracker does this repo use?" with Jira, Linear and "No
  tracker (the PR is the record)". The answer is written to `## Repo`
  together with the tracker's section (drafted the way `## Jira` is drafted
  today), committed on the feature branch like `## Slack` is today, so it is
  never asked again.
- `.claude/ship-plan.local.md` is only read, for an older `## Slack` (see "Slack"); nothing new is written to it.

### The skills

**`ship-plan/SKILL.md`**
- Before anything else: read the config, resolve `Host:` and `Tracker:`, then
  read `hosts/<host>.md` and, unless the tracker is `none`, `trackers/<tracker>.md`.
- Every `gh` command and every Atlassian call in the body becomes a reference
  to an operation ("the host's *Open the PR*"). GitHub-only explanations move
  into `github.md` with their commands.
- "Jira issue" becomes "the issue" throughout; "No Jira issue" becomes "no
  issue". The existing no-issue path is unchanged.
- The four closing outcomes, the review loop and the lessons logic stay
  exactly as they are.

**`verify-and-fix/SKILL.md`**
- Base branch, the CI gate and section 4b (review comments) use the host's
  operations. The grading, reply, resolve and re-request rules stay; only
  their commands move.
- 4b's "Jira comment: review round" becomes "the tracker's review-round
  comment", skipped with no tracker.
- On a host without bot reviewers, "resolve a Copilot thread" never applies;
  a person's thread stays theirs to resolve on every host.

**`ship-issue/SKILL.md`**
- "All work is tracked in a Jira issue" becomes: tracked in the repo's
  tracker; with `Tracker: none`, the PR is the record, as the user decided.
- With no tracker, the ledger directory and the branch use `<slug>` instead
  of `<KEY-n>`.
- I5 ("Jira") becomes "Tracker": the description append, the size rule and
  the comments come from the tracker file. With no tracker, I5 is skipped and
  the plan goes into the PR body through ship-plan.

**`ship-plan/templates*.md`**: split as "Loaded only when needed" says.
"Jira comment: …" becomes "Issue comment: …", one text for every tracker.
Tracker-only mechanics (Jira's HTML append, Linear's `patch`) move to the
tracker files.

**`ship-plan/config-format.md`**: documents `Host:`, `Tracker:` and
`## Linear`, the per-host meaning of the shared fields, and the draft steps
per host (on Azure DevOps, gates come from YAML pipelines, or from manifests
when the pipeline is classic).

### Slack

Slack gets its own file, `notifiers/slack.md`, like hosts and trackers (the
user's decision): a repo with `Channel: none` never reads it, so its rules
cost nothing there.

- **`SKILL.md` keeps only the hook points,** one line each: "post the review
  request" (4R, step 2), "ask for re-review" (4R, step 3, after a round),
  "mark the PR merged" (section 5), and "choose the channel" (pre-flight,
  when `## Slack` is missing). Each says "per the notifier file" and is
  skipped when the channel is `none`.
- **`notifiers/slack.md` holds the rest:** choosing the channel (the search
  and the options), the texts (the review request moves there from
  `templates.md`, plus the new re-review text), the `People:` table, the
  ledger lines, the once-per-PR rules, and the failure rules.
- **Read it** in pre-flight when `## Slack` is missing (to ask), and before
  the first hook point when a channel is set. Never with `Channel: none`.
- The folder name leaves room for another chat tool later, the same way
  `hosts/` and `trackers/` do; none is added now.

**No Slack** is already supported: `Channel: none` means nothing is posted,
and pre-flight offers "Don't post to Slack".

**The channel is a repo setting (the user's decision).** It belongs to the
team or initiative behind the repo, not to one person.
- The committed `## Slack` in `.claude/ship-plan.md` is the only place a run
  writes it. Pre-flight asks once when it is missing, and the answer goes into
  the config on the feature branch's first commit, as today.
- A run no longer writes `.claude/ship-plan.local.md`. It still reads that
  file's `## Slack` when the config has none, so a machine that answered
  before keeps working.
- The cost: until the commit reaches the base branch, a run on another branch
  asks again. (My call: accepted, since the answer is the same for everyone
  and the question is one click.)

**Re-review requests in the review thread (the user's request).** When a
review round has addressed comments from people, and a review request was
posted for this PR (the ledger's `Slack: posted <ts>`):
- **When:** after `verify-and-fix --comments` has pushed its fixes and
  replied (ship-plan 4R, step 3), once per round.
- **What:** one reply in the review request's thread (`slack_send_message`
  with `thread_ts: <ts>`), naming each person whose comments were addressed
  this round and asking them to look again. The text is a new template,
  "Re-review request" in `notifiers/slack.md`: what changed in one line, and
  the PR link.
- **Who:** only people. Bots (Copilot, CI) and the PR's author are left out.
  A person whose only items were answered "not valid" or "follow-up" is still
  named: their comment got a reply they should read.
- **Mentions:** a person is @-mentioned when their Slack user is known.
  `## Slack` gets a `People:` table, host login to Slack user id, filled the
  first time a login is seen (`slack_search_users` by the login's display
  name or email). Not found: their plain name, and a `Lesson:`. (My call: the
  table is repo-wide because reviewers belong to the team, like the channel.)
- **On Azure DevOps,** which has no "re-request a reviewer" action, this
  thread reply is the re-request.
- Recorded in the ledger as `Slack: re-review <ts> <names>`, so a resume
  never posts it twice.

**`:pr-merged:` on merge (the user's request).** Right after the merge
(ship-plan section 5), add the `pr-merged` reaction to the review request
post (`slack_add_reaction` on the channel and `<ts>`). Recorded as
`Slack: merged reaction`. Fix-forward, revert, docs and lessons PRs get it
too when they had a post. The emoji is a workspace custom emoji: if the
reaction is refused (unknown emoji), the run goes on, records a `Lesson:`
for `blockers.md`, and never tries another emoji on its own.

Slack failures stay what they are today: a `Lesson:`, never retried another
way, and never a reason to stop.

### Permissions

`allowed-tools` cannot be split into files, so each skill's frontmatter lists
the pre-approved commands for every host and tracker it may use: today's
`gh` and Atlassian lines, plus the `az` lines from `skills/ship/hosts.md`, plus
the Linear tools `ship` uses today, plus `slack_add_reaction` and
`slack_search_users` next to the Slack tools already listed.

- MCP tool names depend on how a connector is installed. The Atlassian tools
  are listed as `mcp__plugin_atlassian_atlassian__*` today, and Linear as
  `mcp__plugin_engineering_linear__*`. A repo whose connector has another name
  gets permission prompts. The tracker file says so, and the run records the
  name in `blockers.md` and proposes the allow line, as it does for any
  refused command.
- **Never pre-approved,** on any host: a base-branch pipeline run on Azure
  DevOps (a pattern would also match a deploy pipeline), `--bypass-policy`,
  `--admin`.

### Removing `ship` and `verify`

In the same release as the changes above, once the tests pass:
1. Delete `skills/ship/` and `skills/verify/`. `azure-devops.md` replaces
   `skills/ship/hosts.md`, and the uncommitted edits to `ship` and `verify` on
   `feat/ship-azure-devops` are dropped.
2. README: remove both rows, describe the three skills as host- and
   tracker-neutral, and bump `version` in `.claude-plugin/plugin.json` (minor
   bump: skills are removed).
3. This machine: remove the `ship` and `verify` symlinks from
   `~/.claude/skills`, and link the three skills with
   `./scripts/link-skills.sh ship-issue ship-plan verify-and-fix`. Update the
   memory note that lists the linked skills.

**Open `ship` runs are dropped (the user's decision).** `ship` is deleted in
this release. Runs still open in FIS and its worktrees (PRs 774, 775 and 776
in `FIS-wt-async`, 788 in `FIS-wt-svc8`, 731, 755 and 757 in `FIS`) are
finished by hand or restarted with `ship-plan`. The new skills don't read
`.superpowers/ship/` ledgers.

**Repos moved in this rollout (the user's decision):** FIS,
`fis-geoserver-container-app`, `ship-skill-sandbox`, `azure-subscription`,
and forest-planner. One PR per repo, each with the user's approval; the FIS
worktrees share FIS's repo, so FIS's PR covers them.

| Repo | Host | Tracker | Notes |
|---|---|---|---|
| FIS | `azure-devops` | `linear` | Details below. |
| `fis-geoserver-container-app` | `azure-devops` | `none` | Its `Workflow:` is prose naming the `fis-geoserver-infra` pipeline; set it to that pipeline's id. Its pipeline deploys on push to main, so it must never be rerun by the skill. |
| `ship-skill-sandbox` | `github` | `none` | `Workflow: ci.yml` already fits. |
| `azure-subscription` | none: no `origin` remote | `none` | Only the files move. Without a remote, a run stops before opening a PR, as it would today. |
| forest-planner | `github` | `linear` | Details below. |

**forest-planner** keeps its own copies of `ship-issue`, `ship-plan` and
`verify-and-fix` in `.claude/skills/`: a Linear version with no config file.
Its repo settings are written into those skills, and its logs
(`interruptions.md`, `blockers.md`, `evidence.md`) sit in the skill folders.
Once the shared skills are linked into `~/.claude/skills`, the personal ones
take over from the project ones with the same name, so forest-planner moves
onto the shared skills (the user's decision):
- Compare each of its three skills with the shared one. Repo-specific rules
  become sections of a new `.claude/ship-plan.md` (`## Linear`, `## Gates`,
  `## Fix rules`, `## Never do`, and so on). Workflow differences that aren't
  repo-specific go in the report as proposed changes to the shared skills,
  not into the config.
- Move its logs to `.claude/ship-plan/` and `.claude/ship-issue/`.
- Delete its three skill folders.
- This PR merges before the shared skills are linked on this machine.

**Moving FIS (and any other `ship` repo).**
- The skills don't migrate files on their own. When `.claude/ship.md` exists
  and `.claude/ship-plan.md` doesn't, `ship-plan`, `ship-issue` and
  `verify-and-fix` stop in pre-flight with one line: "This repo is set up for
  the removed `ship` skill: move `.claude/ship.md` to `.claude/ship-plan.md`
  and `.claude/ship/` to `.claude/ship-plan/`."
- FIS is moved by hand, in one PR in its own repo, with the user's approval:
  `git mv` both paths, then add `Host: azure-devops` and `Tracker: linear`
  (FIS's `## Linear` and its `Notes:` already fit), set `## CI`
  `Workflow: 17` (today it is prose, and the Azure DevOps commands need the
  pipeline id), and delete the config's prose that maps `gh` to `az`. Which commands FIS still needs in its
  `## Never do` (pipeline 7, `--bypass-policy`) stays as it is.

### Azure DevOps

`azure-devops.md` starts from `skills/ship/hosts.md`, whose commands were run
read-only against FIS (PR 788, run 2342, failed run 2309). It must also close
these gaps found by two test runs:

1. **Long PR descriptions.** The 4000-character limit must be handled
   explicitly: write two files, the head (up to `## What changed`, or a
   shorter head when that is still too long) and the rest, which is posted as
   the PR's first comment. The "Decisions" pointer in the done comment must
   point to wherever the rulings ended up.
2. **No run on the merge SHA.** Contradicts ship-plan 6.1 today: say it plainly.
   No run within 5 minutes is "no base-branch run" (as on GitHub), and no
   manual run is ever queued.
3. **Batched CI.** Give the command that finds the newer run containing the
   SHA: list recent runs on the base branch without the SHA filter, fetch each
   candidate's `sourceVersion`, and test it with
   `git merge-base --is-ancestor`.
4. **Rerunning a base-branch run.** The exact allow line must appear in
   pre-flight's batch, which ship-plan's pre-flight does not yet ask for. A
   pipeline that deploys is never rerun; say how to tell (the config names it,
   or its definition has a deploy stage).
5. **Path filters.** State the matching rules for build-policy
   `filenamePatterns` (later patterns override earlier ones, `/` means the
   repo root) and settle the order question.
6. **Policies that are not reviews.** "Linked work items" and "comment
   resolution" need their own park text, not "needs approval".
7. **5.1 must not skip the policy check** when there is no PR CI: the
   reviewer and work-item policies are still read.
8. **`"$(cat <file>)"` in a pre-approved command.** Try once whether Claude
   Code still prompts for it. If it does, use a path that doesn't need it.

Azure DevOps review threads map to verify-and-fix 4b like this, as my call:
- **Fetch:** the PR's `pullRequestThreads`.
- **Reply:** post a comment to the thread.
- **Resolve:** set the thread status. Only for a bot's thread, and Azure
  DevOps has no Copilot reviewer, so in practice never.
- **Re-request a reviewer:** Azure DevOps has no such action. The reply
  notifies them, and a push resets votes when the policy says so.
- **Approvals:** reviewer votes, with 10 or 5 counting as approved and -10 as
  changes requested.

## Verification

- **Paper scenarios with subagents,** as for the Azure work: each one reads
  the changed skills and answers step by step with exact commands, and says
  which ones the skill gave and which it worked out. One scenario per
  combination:
  - GitHub with Jira, as a regression: its answers must match today's
    skill, command for command;
  - GitHub Enterprise with no tracker;
  - Azure DevOps with Linear (FIS);
  - Azure DevOps with Jira.
- **First run:** a repo with no config, and a config with `## Jira` but no
  `Tracker:`. The run must ask nothing new for the second.
- **Read-only `az` checks** against FIS for every new command.
- **`claude plugin validate .`** and frontmatter parsing.
- **`~/.claude/skills/_specs/check-skills.mjs`** checks only `ship` and
  `verify` today and fails once they are gone. It is rewritten for the three
  skills: their files, the operation names each skill references against the
  headings in the tool files, and each skill's full `allowed-tools` list. It
  lives outside this repo, in the user's personal folder. (My call.)
- **A live run is the user's call:** one real `ship-plan` run on FIS after its
  migration PR.

## Calls I made

- Tool files live under `ship-plan/` and the other two skills read them from
  there, because they already read `ship-plan`'s config-format and templates.
- `Tracker:` is an explicit field, so `none` can be saved; its default comes
  from the sections present.
- `Host:` is detected, never asked.
- The skills detect a `ship` repo and stop with a message; they don't move
  its files themselves.
- `ship` and `verify` are removed in the same release.
- On Azure DevOps, `Copilot review:` has no effect, "re-request a reviewer"
  has no equivalent, and votes stand in for GitHub's review states.

## Left to the builder

- Section wording and order inside each tool file.
- How to phrase each operation reference in the skills, as long as each name
  matches a section heading in the tool files.
- Whether `linear.md` needs a "Linear: issue question" variant or the shared
  issue question covers it.
