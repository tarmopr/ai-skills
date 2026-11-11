# Spec probes

The Spec stage ([stage-prompts.md](stage-prompts.md)) reads a section of this
file only when its trigger applies. Each one proves a claim before the spec
makes it.

## Copied values

**Trigger:** the change removes or changes a copied value (a literal, a limit, a rule).

`git grep` the value itself, not only its name, across every module and
service. A match in another module's domain is a copy across a boundary,
which the design treats differently from a literal in the same module.

## Personal data

**Trigger:** the issue is about personal data (logs, events, masking).

Count as personal data every stored text a person can be identified by: a
name, a display name, an email, an identity provider's subject. That holds
whether or not any code writes it yet: a mapped column with no writer today
is still exposed once one exists.

## Concurrency

**Trigger:** the design claims writes do not interleave, a lock is enough, or an append is atomic.

Run a two-writer probe in a scratch directory outside the checkout and quote
its result.

## Build-time code generation

**Trigger:** the design relies on code a build step generates or checks: a source generator, an analyzer, an annotation processor, a macro, a codegen step.

Check it reaches the new project or package. Prove it with a build: add one
use of it, run the repo's build command, quote the result, and remove the
probe. A package manifest's dependency list or exclude rule is not proof.

## Schema

**Trigger:** the design claims what a migration does, a column's type, or what a schema test will find.

Apply the migration to a scratch database and run there every query the
spec's tests will run, quoting what each returns. Run
each probe command on its own: a worktree-isolated session refuses a
`docker exec … psql` joined to another command. Start a session that must
hold a lock while another runs with `run_in_background`.
