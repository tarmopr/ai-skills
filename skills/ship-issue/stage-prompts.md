# Stage prompts

The Spec and Plan stages run as subagents, so each starts from a fresh context
at its own model and effort, and this session never changes its own. Dispatch
with the Agent tool: `subagent_type: general-purpose`, `model` and `effort`
from the config's `## Models` row, and the prompt below with every `<…>`
filled in. Paths are absolute. `<skill dir>` is this skill's base directory.

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
<branch> is checked out. Do not commit, push, switch branches or write to Jira.

Mode: <new | revise>.

Read first, in full: the issue <ledger dir>/issue.md; the repo config
<checkout>/.claude/ship-plan.md; <skill dir>/evidence.md; the ledger
<ledger dir>/ledger.md (its Ruling: and Asked: lines are settled: never reopen
them).

## Research (mode new)
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
2. History: `git log -S'<string>' --format='%h %ad %s' --date=short -- <file>`
   shows when and why the code arrived.
3. The running system, read-only, following evidence.md and the config's
   `## Evidence`. Record a baseline that will change when the fix lands. If
   the behaviour can be seen on a deployed environment, the baseline is a
   measured response, and it becomes an acceptance check that needs no
   sign-in. If it can't, or `## Evidence` is absent, it is a reproduction
   (input, observed output, expected output). The failing test that captures
   it is the plan's first task, not research.

## Design and spec
REQUIRED SUB-SKILL: superpowers:brainstorming, for its approaches, design
sections, spec format, self-review and builder check. Run its builder-check
subagent with model <spec model> and effort <spec effort>. Its approval stops
and its "no spec file" outcome are overridden by ship-issue: write one
`Ruling:` line for each stop you skip. Draft 2–3 approaches with a
recommendation, then apply this confidence test to each open choice: it
FAILS when it widens access, changes money, nothing quotable points one way,
it cannot be undone by a follow-up commit, or it is on ship-plan's "does not
authorize" list. A choice that passes is a Ruling:. A choice that fails is a
question: write the spec on your recommendation, mark each place that depends
on it `[pending Q<n>: <question>]`, and return the question.

Always write a spec, even for a bounded change; the classification only sets
its length. It holds the evidence, the decisions and who made them, what is
out of scope, and acceptance with the baseline. Save it to
<checkout>/docs/superpowers/specs/<yyyy-mm-dd>-<KEY-n>-<slug>-design.md.

## Mode revise
The spec exists at <spec path>. The user answered: <answers, numbered as the
Q<n> markers>. Replace each answered marker with the decision, follow its
consequences through the whole spec, and re-run brainstorming's self-review.
Research again only where an answer opens new ground.

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
push, switch branches or write to Jira.

Read first, in full: the spec <spec path>; the repo config
<checkout>/.claude/ship-plan.md; the Ruling: and Asked: lines of
<ledger dir>/ledger.md (settled: never reopen them). Read code as the plan
needs it.

REQUIRED SUB-SKILL: superpowers:writing-plans. Its plan review and its
execution-method choice are overridden by ship-issue: the method is always
ship-plan (subagent-driven-development). Write one Ruling: line for each stop
you skip. Save to <checkout>/docs/superpowers/plans/<yyyy-mm-dd>-<KEY-n>-<slug>.md.

Next to the skill's required header, the plan needs:
- a Scenarios table for verify-and-fix: unit, local, and (when the config has
  `## Evidence`) deployed-environment rows, with the spec's baseline check;
- a "Close-out notes for ship-plan" section: `Pre-flight questions: none` (or
  the few that remain), the follow-ups (the deploy), a PR title ending in
  ` (<KEY-n>)`, and an empty `From ship-issue` block. The run fills that
  block; leave it empty;
- never a PR number in text: none exists yet. Cite the issue key.

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
### Rulings
Ruling: <decision> — <evidence quoted> — <cost if wrong>
### Questions
Q<n>: <question> — <options, recommendation first> — <what it blocks>
### Parked
Parked: <question> — <options, recommendation> — <what it blocks>
### Lessons
Lesson: <what> — <the step that would have caught it>
```

An empty section keeps its heading and says `none`.
