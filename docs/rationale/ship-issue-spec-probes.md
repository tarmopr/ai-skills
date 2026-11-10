# ship-issue spec-probes.md: rationale

Incidents moved out of skills/ship-issue/spec-probes.md to keep it short. Read when changing a probe, not when running the skill.

## Copied values

A first draft once took another module's two limits for its own rules; that module copies two limits across the boundary.

## Personal data

A spec once said a module maps no plaintext personal data; its review found a display name and a subject.

## Concurrency

A first spec once said concurrent appends do not interleave; in .NET, FileMode.Append seeks to the end once, at open, and a second writer overwrote the first line.

## Source generator or analyzer

A prompt once said a package's .nuspec `exclude="Analyzers"` keeps `[LoggerMessage]` out of a project, and on the SDK in use it did not.

## Schema

A column-classification query was once written but never run; it would also have matched EF Core's `__ef_migrations_history`, which the module keeps in the same schema.
