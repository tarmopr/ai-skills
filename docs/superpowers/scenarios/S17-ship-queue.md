# S17: ship-queue

Four separate runs: how `ship-queue` orders a parent's sub-issues, how its
loop records each outcome, how `ship-issue` and `ship-plan` behave when a queue
started them, and how a queue resumes. Each `## Prompt S17<x>` is its own
runner, graded by its own **Pass if** lines at the end.

Every prompt uses this repo. Paste the block below into each prompt where it
says **[The repo]**.

**The repo:** `acme/billing-api` on github.com, main checkout at
`/work/billing-api`, on `main`, clean. `git remote get-url origin` prints
`git@github.com:acme/billing-api.git`. You are signed in to GitHub as `dana`
and to Linear as Dana. Its `.claude/ship-plan.md`:

```markdown
# Ship config

## Repo
- Base branch: main
- Tracker: linear

## Gates
| Gate | Command | Only when changed | Timeout |
|---|---|---|---|
| Tests | make test | | |

## CI
- Workflow: ci.yml

## Linear
- Team: BILL
- Project: Billing
- Start status: In Progress
- Review status: In Review
- Done status: Done

## Slack
- Channel: none
```

The base branch's rule requires 1 approval. The permission mode does not
prompt.

**The parent:** Linear `BILL-500`, "Billing fixes after the user test". Its
description lists the findings and says: "Most important: the missing usage
alerts (BILL-501)." It states no order. No comments. Its sub-issues, all in
Backlog unless noted:

| Key | Title | Priority | Assignee | Created | Relations / text |
|---|---|---|---|---|---|
| BILL-501 | Usage alert mails for prepaid plans | High | none | 10:00 | none |
| BILL-502 | Credit meter refreshes at once | Medium | none | 10:01 | none |
| BILL-503 | VAT texts on the plan page | Medium | none | 10:02 | description: "Do this after BILL-504: the texts show the billing details it adds." |
| BILL-504 | Billing details from one source | Medium | Dana | 10:03 | Linear `blockedBy: BILL-501` |
| BILL-505 | Admin dialog overflows | Low | Kai | 10:04 | none |
| BILL-506 | Free plan limit | Low | none | 10:05 | status Done |

BILL-502 and BILL-503 both change `src/pages/Plans.tsx`. No PR is open for any
of them, unless a prompt says otherwise; every PR a prompt names is Dana's.

## Prompt S17a

You are running the `ship-queue` skill. Its files are in SKILLDIR/ship-queue/,
and it uses SKILLDIR/ship-issue/, SKILLDIR/ship-plan/ and
SKILLDIR/verify-and-fix/. Read SKILLDIR/ship-queue/SKILL.md and every file it
links that matters for this run.

[The repo]

**The invocation:** `/ship-queue BILL-500`. No ship-queue ledger exists.

Answer, in order:

1. Which tool calls read the parent and its sub-issues? Every parameter.
2. What order does the queue run, and which `Order source:`, `Depends:` and
   `Ruling:` lines does it write? What happens to BILL-505 and BILL-506?
3. Does it ask the user anything before the first sub-issue? And if the
   invocation were `/ship-queue BILL-500 show order`?
4. A different parent, `BILL-600`, has three sub-issues, all Done. What does
   `/ship-queue BILL-600` do?

## Prompt S17b

You are running the `ship-queue` skill. Its files are in SKILLDIR/ship-queue/,
and it uses SKILLDIR/ship-issue/, SKILLDIR/ship-plan/ and
SKILLDIR/verify-and-fix/. Read SKILLDIR/ship-queue/SKILL.md and every file it
links that matters for this run.

[The repo]

**Where the run stands:** `/ship-queue BILL-500 BILL-501 BILL-504 BILL-503 BILL-502`
passed pre-flight; the ledger's first line is
`Phase: running | Parent: BILL-500 | Order: BILL-501, BILL-504, BILL-503, BILL-502 | Current: none | Checkout: /work/billing-api`.

- `ship-issue BILL-501` ran and returned. Its ledger
  `.superpowers/ship-issue/BILL-501/ledger.md` has the first line
  `Phase: I6 | Issue: BILL-501 | Branch: feature/BILL-501-usage-alerts | … | ship-plan ledger: .superpowers/ship-plan/feature-BILL-501-usage-alerts/ledger.md`.
  That ship-plan ledger's first line is `Phase: done | … | PR: #<n> | merge: 4f2a9c1 | …`
  and it has the line `Lessons PR: #<m>`. The checkout is now on
  `docs/ship-plan-lessons-2026-11-02-BILL-501`, clean.
- Then `ship-issue BILL-504` ran and returned. Its ledger ends with
  `Waiting: batch of 2, sent 2026-11-02; heads: none`, and the batch comment is
  already on BILL-504.

Answer, in order:

1. The exact queue ledger lines written from the start of BILL-501's run to
   the end of BILL-504's.
2. What happens to BILL-503, and to BILL-502? Any tracker call?
3. Which command runs between BILL-501 and BILL-504, and which lines make it
   allowed?
4. Instead, BILL-501's ship-plan run closed out "Base branch red". What does
   the queue do next, and what does it record for the others?

## Prompt S17c

You are running the `ship-issue` skill (and, where a question says so, the
`ship-plan` skill it hands off to). Their files are in SKILLDIR/ship-issue/
and SKILLDIR/ship-plan/; they use SKILLDIR/verify-and-fix/. Read
SKILLDIR/ship-issue/SKILL.md and every file it links that matters for this run.

[The repo]

**Where the run stands:** the invocation is `ship-issue BILL-504`, and
`printenv SHIP_QUEUE_PARENT` prints `BILL-500`. The checkout holds
`.superpowers/ship-queue/BILL-500/ledger.md`, whose first line
is `Phase: running | Parent: BILL-500 | Order: BILL-501, BILL-504, BILL-503, BILL-502 | Current: BILL-504 | Checkout: /work/billing-api`
and whose last line is `Current: BILL-504 started 2026-11-02 11:40`.

Answer, in order:

1. At I1, Linear `get_issue` fails with "401 Unauthorized". What does
   ship-issue do, and does it ask the user anything?
2. Instead, I1 succeeds and the Spec stage returns three `Q<n>` lines. What is
   posted, where, with which answer line? Is `AskUserQuestion` called? What
   happens to the spec, and how does the run end?
3. Later, for BILL-502, ship-plan's PR is green and is waiting only for one
   approval. How long does ship-plan wait, and what does its ledger's first
   line become?
4. The BILL-502 run reaches section 8 on 2026-11-02. Which branch does it
   create?
5. Same as Q2, but the checkout holds no ship-queue ledger. Is
   `AskUserQuestion` called, and with which answer line?

## Prompt S17d

You are running the `ship-queue` skill. Its files are in SKILLDIR/ship-queue/,
and it uses SKILLDIR/ship-issue/, SKILLDIR/ship-plan/ and
SKILLDIR/verify-and-fix/. Read SKILLDIR/ship-queue/SKILL.md and every file it
links that matters for this run.

[The repo]

**Where the run stands:** `.superpowers/ship-queue/BILL-500/ledger.md`, last
changed 3 hours ago, first line
`Phase: running | Parent: BILL-500 | Order: BILL-501, BILL-504, BILL-503, BILL-502 | Current: none | Checkout: /work/billing-api`,
`Order source: analysis`, with these `Result:` lines:

```
Result: BILL-501 done — Phase: done, merge 4f2a9c1 — next: none
Result: BILL-504 waiting for answers — Waiting: batch of 2 — next: answer with /ship-queue BILL-500 BILL-504: <answers>
Result: BILL-503 waits for BILL-504 — Depends: BILL-503 on BILL-504 — next: finish BILL-504 first
Result: BILL-502 awaiting review — Phase: 4R awaiting review — next: one approval on PR #<k>
```

BILL-504's branch `feature/BILL-504-billing-details` exists locally and is
not merged. The checkout is on `main`, clean.

Answer, in order:

1. The invocation is `/ship-queue BILL-500 BILL-504: 1A, 2B ; BILL-506: yes`.
   Which `ship-issue` calls does the queue make, in which order, with which
   arguments? Which git command comes before the first one? Assume BILL-504
   ends `done`, and BILL-503 ends `done`.
2. What happens to `BILL-506: yes`?
3. In the review sweep, BILL-502's PR now has its approval. What happens, and
   when does the sweep stop? What is the ledger's first line at the end?
4. A different moment: the ledger's last line is
   `Current: BILL-502 started 2026-11-02 14:05` with no `Result:` after it,
   ship-issue's ledger for BILL-502 changed 5 minutes ago, and the session
   was just compacted in the middle of BILL-502's run. The invocation is
   `/ship-queue BILL-500`. What runs, and does ship-issue's I0 stop it as
   another session's live run?

## Prompt S17e

You are running the `ship-queue` skill. Its files are in SKILLDIR/ship-queue/,
and it uses SKILLDIR/ship-issue/, SKILLDIR/ship-plan/ and
SKILLDIR/verify-and-fix/. Read SKILLDIR/ship-queue/SKILL.md and every file it
links that matters for this run.

[The repo]

Three separate moments. In each, this is a **new session**: it has never run
this queue before.

Answer, in order:

1. `.superpowers/ship-queue/BILL-500/ledger.md` in `/work/billing-api` was
   last changed 50 minutes ago. Its last line is
   `Current: BILL-504 started 2026-11-02 11:40`, with no `Result:` after it.
   BILL-504's ship-plan ledger,
   `.superpowers/ship-plan/feature-BILL-504-billing-details/ledger.md`, was
   changed 4 minutes ago. The user types `/ship-queue BILL-500 BILL-503: 1A`.
   What happens? Is `ship-issue` invoked?
2. Instead: the queue's previous session ran every sub-issue, posted its
   summary to BILL-500, wrote its handoff and ended 10 minutes ago. BILL-504's
   last `Result:` is `waiting for answers`. The user types
   `/ship-queue BILL-500 BILL-504: 1A, 2B`. What happens? Is `ship-issue`
   invoked, and with which arguments?
3. Instead: the queue ran in its own worktree,
   `/work/billing-api/.claude/worktrees/BILL-500` (`git worktree list` shows
   it), and its ledger is there, changed 3 hours ago. This session is in the
   main checkout `/work/billing-api`, which is on `main` and clean, and has no
   ship-queue ledger. The user types `/ship-queue BILL-500`. What happens? Is a
   new ledger or a new worktree made?

## Prompt S17f

You are running the `ship-queue` skill. Its files are in SKILLDIR/ship-queue/,
and it uses SKILLDIR/ship-issue/, SKILLDIR/ship-plan/ and
SKILLDIR/verify-and-fix/. Read SKILLDIR/ship-queue/SKILL.md and every file it
links that matters for this run.

[The repo]

**Where the run stands:** the queue is running in `/work/billing-api` with
order `BILL-501, BILL-504, BILL-503, BILL-502`.

Answer, in order:

1. `ship-issue BILL-501` returned. Its ship-plan ledger's first line is
   `Phase: done | … | merge: 4f2a9c1 | …`, and it has the line
   `Asked: Sign in to the staging URL so scenarios 4 and 5 can run? — pending`.
   What outcome does the queue record, and what next action? Later the user
   types `/ship-queue BILL-500 BILL-501: signed in`: which skill is invoked,
   with which arguments?
2. Same BILL-501 run, but its ship-plan ledger has no `Lessons PR:` line:
   ship-plan pushed its lessons branch with answers pending and opened no PR.
   The ledger has the line
   `Lessons branch: docs/ship-plan-lessons-2026-11-02-BILL-501`. The checkout is
   on that branch, clean. What does the queue do before BILL-504?
3. `ship-issue BILL-502` returned. Its ship-plan ledger's first line is
   `Phase: 4R awaiting review | …`, and it also has
   `Asked: Keep the old meter for one release? — pending`. What outcome is
   recorded? Is BILL-502 polled in the review sweep? What does the summary say
   the user must do?
4. A different queue: BILL-503 says "Do this after BILL-506", and BILL-506 was
   already Done before the queue started. Does BILL-503 run?

## Prompt S17g

You are running the `ship-issue` skill and the `ship-plan` skill it hands off
to. Their files are in SKILLDIR/ship-issue/ and SKILLDIR/ship-plan/; they use
SKILLDIR/verify-and-fix/. Read SKILLDIR/ship-issue/SKILL.md and
SKILLDIR/ship-plan/SKILL.md and every file they link that matters for this run.

[The repo]

Answer, in order:

1. A new session. The user types `/ship-issue BILL-504` directly. The
   checkout holds `.superpowers/ship-queue/BILL-500/ledger.md`, last changed
   yesterday, whose last line is `Current: BILL-504 started 2026-11-01 16:10`
   with no `Result:` after it: that queue's session died. The Spec stage
   returns two `Q<n>` lines. Is `AskUserQuestion` called, and with which answer
   line?
2. A queued ship-plan run for BILL-501 (ship-queue invoked ship-issue, which
   invoked ship-plan, in this session; the queue ledger's last line is
   `Current: BILL-501 started …`) closes out "Base branch red": merged, and the
   base branch is still red after red-base.md. Which lines does it write to its
   own ledger at close-out?
3. The same queued run, on another day, ends Done, and its lessons batch is
   not empty, so section 8 pushes the lessons branch with answers pending and
   opens no PR yet. Which ledger line names that branch?

## Pass if

**S17a**
- Q1: `list_issues` with `parentId: "BILL-500"` (fields including status,
  priority, assignee), then `get_issue` with `includeRelations: true` for the
  sub-issues; the parent read with `get_issue` and `list_comments`.
- Q2: BILL-506 `already done`; BILL-505 `blocked` (assigned to Kai), not run.
  `Order source: analysis`. `Depends: BILL-504 on BILL-501` (the `blockedBy`
  relation) and `Depends: BILL-503 on BILL-504` (the quoted description
  text). BILL-501 runs before BILL-504, BILL-504 before BILL-503. The shared
  `src/pages/Plans.tsx` is not given as a dependency between BILL-502 and
  BILL-503.
- Q3: nothing asked without `show order`; with it, the order, the `Depends:`
  lines and the rulings are shown and the queue waits for an OK
  (`AskUserQuestion` with a "Start in this order" option).
- Q4: no `ship-issue` call; the summary at once; the ledger ends
  `Phase: done`.

**S17b**
- Q1: `Current: BILL-501 started <time>`, a `Ledger: BILL-501 …` line,
  `Result: BILL-501 done — …`, `Current: BILL-504 started <time>`,
  `Result: BILL-504 waiting for answers — …` with the answer line
  `/ship-queue BILL-500 BILL-504: <answers>`.
- Q1 or Q2: no second comment on BILL-504 (its batch comment is already there).
- Q2: BILL-503 `waits for BILL-504`, one Linear `save_comment` on BILL-503,
  no `ship-issue BILL-503` call; then `ship-issue BILL-502` runs.
- Q3: `git switch main`, allowed because the branch name
  `docs/ship-plan-lessons-<yyyy-mm-dd>-<KEY-n>` (or the ship-plan ledger's
  `Lessons branch:` line) for a key in `Order:` makes it the queue's own,
  and the tree is clean.
- Q4: the queue stops; BILL-504, BILL-503 and BILL-502 are
  `not started: base branch red`; the summary is written and posted to
  BILL-500; no further `ship-issue` call.

**S17c**
- Q1: the error is written to the ship-issue ledger and the run ends;
  nothing asked, no `AskUserQuestion`.
- Q2: one Linear `save_comment` on BILL-504 with the three questions
  numbered, options and recommendation, ending with the answer line
  `/ship-queue BILL-500 BILL-504: <your answers>`; no `AskUserQuestion`; the
  ledger's last line is `Waiting: batch of 3, …`; the spec is committed on
  the branch; then the run ends.
- Q3: no `Review wait:` window: ship-plan hands off at once, first line
  `Phase: 4R awaiting review`.
- Q4: `docs/ship-plan-lessons-2026-11-02-BILL-502`.
- Q5: `AskUserQuestion` (or one numbered message) as before the change, with
  the answer line `/ship-issue BILL-504 <your answers>`.

**S17d**
- Q1: `git switch feature/BILL-504-billing-details` first; then
  `ship-issue BILL-504 1A, 2B`; then `ship-issue BILL-503` (after a switch
  back to `main`); then the review sweep's `ship-issue BILL-502`. No call for
  BILL-501.
- Q2: reported as not used (BILL-506 is not waiting); never passed to
  `ship-issue`.
- Q3: BILL-502 merges in the sweep and becomes `done`; one more sweep
  changes nothing and the sweep stops; no sleep; first line `Phase: done`
  (every queued sub-issue done).
- Q4: `ship-issue BILL-502` with no argument; not stopped as another
  session's run (the queue's `Current:` names it, so it is this session).

**S17e**
- Q1: the queue is live (the open `Current:` sub-issue's ship-plan ledger
  changed 4 minutes ago): stop and report that another session holds it, and
  that the answers wait until it has ended; no `ship-issue` call.
- Q2: not live (the previous session ended after its summary): a resume;
  `ship-issue BILL-504 1A, 2B`.
- Q3: the ledger in the worktree is found; nothing new is made (no new ledger,
  no `git worktree add`); the queue says to resume from a session in
  `/work/billing-api/.claude/worktrees/BILL-500`.

**S17f**
- Q1: an outcome that is not plain `done`: done with questions pending, with
  the question and the answer line `/ship-queue BILL-500 BILL-501: <answers>`;
  the later answers are passed on to the run (not reported as unused and
  dropped).
- Q2: `git switch main`: the `Lessons branch:` line makes it the queue's own
  branch; the queue does not stop.
- Q3: polled in the review sweep; the summary names both the approval and
  the pending question.
- Q4: BILL-503 runs: BILL-506 being done meets the dependency.

**S17g**
- Q1: `AskUserQuestion` (or a numbered message) as unqueued, answer line
  `/ship-issue BILL-504 <your answers>`: the stale queue ledger does not make
  a direct run queued.
- Q2: a line naming the close-out outcome, `Outcome: Base branch red`.
- Q3: `Lessons branch: docs/ship-plan-lessons-<yyyy-mm-dd>-BILL-501`.
