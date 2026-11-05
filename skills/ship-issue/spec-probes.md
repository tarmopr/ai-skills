# Spec probes

The Spec stage ([stage-prompts.md](stage-prompts.md)) reads a section of this
file only when its trigger applies. Each one proves a claim before the spec
makes it.

## Copied values

**Trigger:** the change removes or changes a copied value (a literal, a limit, a rule).

`git grep` the value itself, not only its name, across every module and
service. A match in another module's domain is a copy across a boundary,
which the design treats differently from a literal in the same module.
A first draft once took another module's two limits for its own rules; they
copy two limits across the boundary.

## Personal data

**Trigger:** the issue is about personal data (logs, events, masking).

Count as personal data every stored text a person can be identified by: a
name, a display name, an email, an identity provider's subject. That holds
whether or not any code writes it yet: a mapped column with no writer today
is still exposed once one exists. A spec once said a module maps no plaintext
personal data; its review found a display name and a subject.

## Concurrency

**Trigger:** the design claims writes do not interleave, a lock is enough, or an append is atomic.

Run a two-writer probe in a scratch directory outside the checkout and quote
its result. A first spec once said concurrent appends do not interleave; in
.NET, FileMode.Append seeks to the end once, at open, and a second writer
overwrote the first line.

## Source generator or analyzer

**Trigger:** the design relies on a source generator or analyzer (`[LoggerMessage]`, `[GeneratedRegex]`, a JSON source generator).

Check it reaches the new project. Prove it with a build: add one use of the
generator to the project, run `dotnet build` on it, quote the result, and
remove the probe. A .nuspec's `exclude="Analyzers"` is not proof: a prompt
once said a package keeps `[LoggerMessage]` out of a project, and on the SDK
in use it did not.

## Schema

**Trigger:** the design claims what a migration does, a column's type, or what a schema test will find.

Apply the migration to a scratch database and run there every query the
spec's tests will run, quoting what each returns. A column-classification
query was once written but never run; it would also have matched EF Core's
`__ef_migrations_history`, which the module keeps in the same schema. Run
each probe command on its own: a worktree-isolated session refuses a
`docker exec … psql` joined to another command. Start a session that must
hold a lock while another runs with `run_in_background`.
