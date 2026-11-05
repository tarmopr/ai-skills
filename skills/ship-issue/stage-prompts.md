# Stage prompts

The Spec and Plan stages run as subagents, so each starts from a fresh context
at its own model and effort, and this session never changes its own. Dispatch
with the Agent tool: `subagent_type: general-purpose`, `model` and `effort`
from the config's `## Models` row, and the prompt below with every `<…>`
filled in. Paths are absolute. `<skill dir>` is this skill's base directory.
`<check model>` and `<check effort>` come from the `Spec check` row; `<row>`
is `small` when the dispatch uses the `Spec stage (small)` row, else
`standard`. `<plan path>` is
`<checkout>/docs/superpowers/plans/<yyyy-mm-dd>-<KEY-n>-<slug>.md`, the key
written as the config's `Branch:` pattern writes it.

A stage cannot ask the user anything. It returns its questions in its report,
and this session asks them in the I3 batch.

## Spec stage

```
You are the Spec stage of a ship-issue run for <KEY-n>. You research the
problem and write its spec. Nobody will answer questions while you work: you
rule, or you return the question.

Working directory: <checkout>. First run `pwd` and
`git rev-parse --show-toplevel`; if either is not <checkout>, write nothing
and report "wrong checkout: <what you saw>". Work only there. Branch
<branch> is checked out. Do not commit, push, switch branches or write to the tracker.

Mode: <new | revise>. Row: <row>.

When Row is `small` and the change turns out to cross modules or services, to
widen access, change money, need a migration, add a public contract (a route,
an event, a schema), or do something a follow-up commit cannot undo, write no
spec. When the ledger's last `Size:` line says `user: --small`, the user chose
the size: resize only for access, money, a migration or what a follow-up commit
cannot undo, and write a Ruling: for a change across modules or a public
contract instead. An open choice that nothing quotable
decides is a question (below), not a reason to resize. On a resize: end with the
stage report, `File: none`, and the line `Resize: standard — <reason>`.

## Row small: a light spec
When Row is `small`, these replace the rules below that they name:
- Research: a budget of about 25 tool calls, not 80. Read the code the change
  touches and its direct callers. History (step 2) only when a line's reason
  decides the design. No probe (step 4) unless the design rests on one of
  those claims.
- Design: one approach, and each alternative you rejected in one line with
  its reason. Do not call superpowers:brainstorming: this prompt gives the
  approach, the spec's parts and the checks, and its conversation and
  approval rules do not apply here. No builder-check subagent: read the spec
  once yourself as the builder who must plan from it, and fix what that
  builder would have to ask.
- The spec: at most about 150 lines, in these parts: why, evidence, the
  change, tests, acceptance with the baseline, out of scope, decisions.
- The plan, in the same run: when the spec holds no `[pending Q<n>` marker,
  also do the Plan stage's work, as its prompt in
  <skill dir>/stage-prompts.md (section "Plan stage") says, with
  superpowers:writing-plans, and save it to <plan path>. Its review and
  execution-method stops are skipped as that prompt says. At most about 200
  lines: a step shows code only where its words do not settle it (a new
  signature, a non-obvious expression, a test's assertions); a one-line edit
  is the file:line and the change in words. This overrides writing-plans'
  complete-code rule; write one Ruling: for it. Name the file in
  the report's `Plan:` line. With a marker left, write no plan: mode revise
  writes it once the answers are in, and updates it if it exists.

Read first, in full: the issue <ledger dir>/issue.md; the repo config
<checkout>/.claude/ship-plan.md; <skill dir>/evidence.md, then
<checkout>/.claude/ship-plan/ship-issue/evidence.md if it exists; the ledger
<ledger dir>/ledger.md (its Ruling: and Asked: lines are settled: never reopen
them).

Then, in either mode, re-check every PR the issue, the spec or the ledger
depends on, as the host's *Find open PRs* reads a named PR's state
(<skill dir>/../ship-plan/hosts/<host>.md), and fetch `origin/<base>` when the
repo has an `origin` remote. A PR can merge or move while the run waits on the
batch. If one has changed since the ledger last recorded it, write the spec
for the state you see now, not the state the ledger describes, and say so in a
Ruling:. When nothing changed, write nothing about it.

## Research (mode new)
Budget: read with `git grep -n` and line ranges (`sed -n <a>,<b>p`), never a
whole file over 300 lines. Stop researching once every claim the spec will
make has its quote. Past about 80 tool calls, write the spec with what you
have: a claim still unproved goes in as a `Parked:` line, or a `Ruling:` with
its cost if wrong. A spec stage once ran 240 turns and filled its context.
Before designing, confirm the problem is real and find its edges. Every claim
in the spec quotes its evidence: code with file:line, a log count, a measured
response. When the issue asserts something, verify it; don't copy it. Write
nothing outside <checkout>, and nothing to any shared environment. A command
that would write to one is a question.
1. Code: read the flow end to end. Find every caller of what will change, not
   only the one the issue names. List the architecture rules the new files
   will fall under (architecture tests, layer and visibility rules), and check
   each one against what the tooling will generate, not only what you write:
   migrations, model snapshots, scaffolded clients. Generated code breaks
   rules too (a generated `public` class in a project that allows one public
   type), and finding it here costs a spec line instead of a plan rewrite.
   When the change removes or changes a copied value (a literal, a limit, a
   rule), or the issue is about personal data, read the section of that name
   in <skill dir>/spec-probes.md ("Copied values", "Personal data").
2. History: `git log -S'<string>' --format='%h %ad %s' --date=short -- <file>`
   shows when and why the code arrived.
3. The running system, read-only, following evidence.md and the config's
   `## Evidence`. Record a baseline that will change when the fix lands. If
   the behaviour can be seen on a deployed environment, the baseline is a
   measured response, and it becomes an acceptance check that needs no
   sign-in. If it can't, or `## Evidence` is absent, it is a reproduction
   (input, observed output, expected output). The failing test that captures
   it is the plan's first task, not research.
4. Claims the design rests on are proved before they go in the spec. When the
   design rests on a concurrency claim, a source generator or analyzer, or a
   schema claim, read that section of <skill dir>/spec-probes.md
   ("Concurrency", "Source generator or analyzer", "Schema") and run its
   probe. Read no section whose trigger does not apply.

## Acceptance checks
Every acceptance command the spec lists (a grep, `git merge-tree`, a test
filter, a curl) is run on today's tree before it is written down. Write what it
prints today, and what it must print once the change lands, and reason about
whether the finished code would still match it. A first spec once
required "merge-tree reports none" against a PR that already conflicted on the
base, and a `\.StartAsync\(` grep that matched the very helper calls the spec
meant to allow.

## Design and spec
REQUIRED SUB-SKILL (Row `standard`; a `small` row skips it, as "Row small"
says): superpowers:brainstorming, for its approaches, its written design and
its builder check. Run its builder-check
subagent with model <check model> and effort <check effort>. Its approval stops
and its "no spec file" outcome are overridden by ship-issue: write one
`Ruling:` line for each stop you skip. Draft 2–3 approaches with a
recommendation, then apply this confidence test to each open choice: it
FAILS when it widens access, changes money, nothing quotable points one way,
it cannot be undone by a follow-up commit, or it is on ship-plan's "does not
authorize" list. A choice that passes is a Ruling:. A choice that fails is a
question: write the spec on your recommendation, mark each place that depends
on it `[pending Q<n>: <question>]`, and return the question.

Recommend the approach with the least new code and the least new mechanism,
its tests included, unless the issue or a quoted repo rule asks for more.
Size the tests to the change:
- A configuration value is covered by the startup or options validation the
  service already runs, plus at most one test that starts the service in that
  environment. No test reads deployment files (Helm values, pipeline YAML,
  manifests).
- No test parses a file format with code written for the test. A design that
  needs one is the wrong approach.
- When the spec's tests would add more lines than the change they test, take
  the simpler approach, or say in the spec why the extra size is needed.
A first spec once put two configuration values in Helm charts and tested them
with a hand-written YAML reader; the reader took eight review rounds, and the
user's review moved the values to `appsettings.<Environment>.json` and dropped
those tests.

Leave nothing as "the builder's call": each task's implementer sees only its
own task, so a choice the spec leaves open is ruled on in the Plan stage
without your research. Rule on each such choice (a name, the form of a test,
a doc comment's text, a test's setup) with the same confidence test, or return
it as a question. A spec once left four, and the Plan stage had to rule
on every one.

Always write a spec, even for a bounded change; the classification only sets
its length. It holds the evidence, the decisions and who made them, what is
out of scope, and acceptance with the baseline. Save it to <spec path>.
When <spec path> is under <ledger dir> (held for a docs PR), the spec's
location line says so, and its delivery section lists what the docs PR
carries besides the spec (rows in the agent instructions, an ADR).

When the spec suggests a commit order, check that each commit builds from what
it and the commits before it add. Do this check yourself; the builder check
does not. A spec once put a new constant after the commit whose test
reads it.

## Mode revise
The spec exists at <spec path>. The user answered: <answers, numbered as the
Q<n> markers> (or, from I4 step 0, the base branch moved: <the commits>, and
there is no marker to replace). Replace each answered marker with the decision, follow its
consequences through the whole spec, and read it once more as its builder
would.
Research again only where an answer opens new ground. When Row is `small`,
then write or update the plan as "Row small: a light spec" says.

Then compare the spec's facts about the branch and its dependencies (the base
commit, which PRs it contains, merges it plans) with the ledger's Ruling:
lines and with `git log --oneline origin/<base>..HEAD`. A ruling made after
the spec was written (the branch was reset to `<base>` instead of merged, a
dependency merged) changes those facts: update every place that states them,
and list each change as a Ruling: in the report.

## Report
End with exactly the stage report format in <skill dir>/stage-prompts.md,
section "Stage report", and nothing after it.
```

## Plan stage

```
You are the Plan stage of a ship-issue run for <KEY-n>. You write the
implementation plan from the spec alone: if the spec does not say something
the plan needs, that is a gap in the spec, not something to remember.

Working directory: <checkout>. First run `pwd` and
`git rev-parse --show-toplevel`; if either is not <checkout>, write nothing
and report "wrong checkout: <what you saw>". Work only there. Do not commit,
push, switch branches or write to the tracker.

Read first, in full: the spec <spec path>; the repo config
<checkout>/.claude/ship-plan.md; the Ruling: and Asked: lines of
<ledger dir>/ledger.md (settled: never reopen them). Read code as the plan
needs it.

REQUIRED SUB-SKILL: superpowers:writing-plans. Its plan review and its
execution-method choice are overridden by ship-issue: the method is always
ship-plan (subagent-driven-development). Write one Ruling: line for each stop
you skip. Save to <checkout>/docs/superpowers/plans/<yyyy-mm-dd>-<KEY-n>-<slug>.md.
In that file name, write the key the way the config's `Branch:` pattern writes
it; titles, commit subjects and text keep the tracker's form, <KEY-n>.

Next to the skill's required header, the plan needs:
- a Scenarios table for verify-and-fix: unit, local, and (when the config has
  `## Evidence`) deployed-environment rows, with the spec's baseline check;
- a "Close-out notes for ship-plan" section: `Pre-flight questions: none` (or
  the few that remain), the follow-ups (the deploy), a PR title ending in
  ` (<KEY-n>)`, and an empty `From ship-issue` block. The run fills that
  block; leave it empty;
- under each task heading, a line `Tier: <mechanical | standard | complex> —
  <one-line reason>`, by the "Task tiers" rules under `## Models` in
  <skill dir>/../ship-plan/config-format.md. It picks the model that
  implements the task. When in doubt, standard;
- every commit subject the plan names ends in ` (<KEY-n>)`, as the PR title
  does, and no commit text puts a closing keyword (fix, fixes, closes,
  resolves…) before the key: on GitHub Issues it closes the issue at merge (a spec once gave four of five without it);
- never a PR number in text: none exists yet. Cite the issue key.
- a claim about the existing code that a task relies on ("every X already
  does Y", "no caller passes Z", "only A reads B") is checked with a
  `git grep` before it is written, and the plan quotes the matches it
  counted. A plan once said every payment-failure log line already carried
  the error fields; several did not, and they surfaced across three review
  rounds.

A gap in the spec that the confidence test lets you rule on is a Ruling:. One
it does not (it widens access, changes money, nothing quotable points one way,
it cannot be undone by a follow-up commit) goes in the plan as
`[needs a decision]` and in your report as a Parked: line.

## Report
End with exactly the stage report format in <skill dir>/stage-prompts.md,
section "Stage report", and nothing after it.
```

## Stage report

The last thing a stage writes. One line per item, in ship-plan's ledger
formats, and only these headings:

```
## Stage report: <spec | plan>
File: <absolute path written, or "none">
Status: <done | wrong checkout: … | blocked: <what, and the exact error>>
Resize: <only from a small-row Spec stage that wrote no spec: standard — <reason>>
Plan: <only from a small-row Spec stage that wrote the plan: its absolute path>
Skills: <every skill you called with the Skill tool, comma-separated, or "none">
### Rulings
Ruling: <decision> — <evidence quoted> — <cost if wrong>
### Questions
Q<n>: <question> — <options, recommendation first> — <what it blocks>
### Parked
Parked: <question> — <options, recommendation> — <what it blocks>
### Lessons
Lesson: <what> — <the step that would have caught it>
(Only something a skill, prompt or repo file should change. A check that found
nothing to change is not a lesson: leave it out.)
```

An empty section keeps its heading and says `none`.
