# Paper scenarios for the tool-neutral ship skills

These scenarios test `ship-issue`, `ship-plan` and `verify-and-fix` without
running them. A fresh subagent reads the skills, is told where a run stands in
a fictional repo, and answers numbered questions with the exact commands and
tool calls the skills would make. The answers are graded against each
scenario's **Pass if** lines.

The structural checker, `~/.claude/skills/_specs/check-skills.mjs`, pins the
files' shape. These scenarios pin behaviour.

| Id | File | What it pins |
|---|---|---|
| S1 | [S1-github-jira.md](S1-github-jira.md) | GitHub with Jira and no `Host:`/`Tracker:`: the same commands as before the change (regression) |
| S2 | [S2-ghe-no-tracker.md](S2-ghe-no-tracker.md) | GitHub Enterprise with `Tracker: none` |
| S3 | [S3-azure-linear.md](S3-azure-linear.md) | Azure DevOps with Linear, no `.github/` folder, a long PR body |
| S4 | [S4-azure-jira.md](S4-azure-jira.md) | Azure DevOps with Jira: how the PR reaches the issue |
| S5 | [S5-no-config.md](S5-no-config.md) | No config: the draft and the tracker question |
| S6 | [S6-jira-no-tracker-field.md](S6-jira-no-tracker-field.md) | `## Jira` without `Tracker:`: no new question |
| S7 | [S7-loaded-on-demand.md](S7-loaded-on-demand.md) | Five runs, one per file read only on a condition |
| S8 | [S8-slack-rereview.md](S8-slack-rereview.md) | Slack re-review reply and merged reaction, across a resume |
| S9 | [S9-ship-repo.md](S9-ship-repo.md) | A repo still set up for the removed `ship` skill |
| S10 | [S10-verify-standalone.md](S10-verify-standalone.md) | `verify-and-fix` on a branch with no PR |
| S11 | [S11-override-files.md](S11-override-files.md) | A repo override file: read right after its shared file and followed; a line that widens is not applied |
| S12 | [S12-allowed-merge-deploys.md](S12-allowed-merge-deploys.md) | Four runs: `Merge deploys to:` with and without `## Allowed` `Merge that deploys to:`, a production-like name, a fix-forward PR |
| S13 | [S13-lessons.md](S13-lessons.md) | Two runs: where each kind of lesson goes, and a lessons PR that loosens the config stays open |
| S14 | [S14-validate-deploy.md](S14-validate-deploy.md) | Four runs: validating the deploy at `Hosted URL:`: the run signs in, a failure that leads to `red-base.md`, no sign-in, a refused sign-in |
| S15 | [S15-loop-behaviors.md](S15-loop-behaviors.md) | Implementer context, prerequisites first, reviewers run no gates, gates after a base-branch merge, the key in a branch name, a handoff |

## How to run one

1. Pick `SKILLDIR`: the folder that holds the skill folders
   (`ship-plan/`, `ship-issue/`, `verify-and-fix/`). For the new layout it is
   `/Users/tarmoprotsin/Development/ai-skills/skills`. For the S1 baseline it
   is a copy of the `skills/` folder as it was before the change, in a scratch
   folder.
2. Dispatch one fresh `general-purpose` subagent per prompt. Its prompt is
   the text of the scenario's `## Prompt` section (S7 has five, `## Prompt
   S7a` … `## Prompt S7e`, each its own run), with every `SKILLDIR` replaced by
   the path from step 1, followed by the whole **Answer format** section below.
   Never give it the **Pass if** lines, this README's table, or the spec and
   plan: a runner that knows what is being tested answers to the test.
3. Save its answer verbatim to `results/<id>.md` (`baseline/<id>.md` for the
   baseline).
4. Grade the answer against the scenario's `## Pass if` lines. Every line must
   hold. Quote the answer's line for each failure.

## Answer format

Copy this section, from here to the end of the file, into every runner's
prompt.

> This is a paper exercise. Run no commands and call no tools other than
> reading files. Read only files under `SKILLDIR`: the skills are the only
> source. Where the skills leave a value open, use the values the scenario
> gives; where the scenario gives none, write a placeholder like `<sha>`.
>
> Answer in this format:
>
> **Files read:** every file under `SKILLDIR` you read, in the order you read
> it, as a path relative to `SKILLDIR`. Include files you read only to check
> something.
>
> Then, for each numbered question, a heading `### Q<n>` and one block per
> step:
>
> - **Step:** what the step does, in a few words.
> - **Command or tool call:** the exact command, as you would type it, in
>   backticks; or the tool name with every parameter you would pass; or
>   "none", with the reason. One step, one command. List every command a step
>   needs, in order.
> - **Source:** the file (relative to `SKILLDIR`) and the heading it sits
>   under, for the rule or command you used. Several, if it took several.
> - **Told or worked out:** "told" when the file gives the command or call
>   (placeholders filled in); "worked out" when you built it yourself.
> - **Files read for this step:** the files you opened for it, in order, or
>   "none new".
>
> When a question asks whether you ask the user something, quote the question
> and its options exactly, or say "nothing asked". When it asks whether you
> write a file, name the file and the exact lines, or say "nothing written".
> Be brief: no explanations beyond what a question asks for.
