# Host commands

`ship` and `verify` write their PR and CI steps as `gh` commands. When the
config's `Host:` is `azure-devops`, every one of those steps uses the Azure
DevOps column below instead. Write each command exactly as shown: the `az`
lines in `ship`'s `allowed-tools` match only these forms.

**Host:** the config's `## Repo` `Host:`. When it is missing, read
`git remote get-url origin`: `dev.azure.com` or `*.visualstudio.com` is
`azure-devops`, anything else is `github`. Record the result as a `Ruling:`.

## The mapping

`<n>` is the PR number (`pullRequestId` on Azure DevOps), `<id>` a CI run id,
`<pipeline>` the config's `Workflow:` (a pipeline definition id on Azure
DevOps), `<repo>` and `<project>` the names in the remote URL
(`https://dev.azure.com/<org>/<project>/_git/<repo>`).

| Step | GitHub | Azure DevOps |
|---|---|---|
| Auth (ship 0.4) | `gh auth status` | `az account show`, then `az devops configure --list`. Every `az` command here takes the organization from those defaults or detects it from the remote when run in the checkout; a missing `azure-devops` extension or a sign-in error goes in the batch. |
| Default branch | `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name` | `az repos show --repository <repo> --query defaultBranch -o tsv`, minus `refs/heads/` |
| Has CI (config absent) | `.github/workflows/` holds a workflow file | `az pipelines list --repository <repo> --repository-type tfsgit --query "[].{id:id,name:name}" -o json` is not empty |
| Open the PR (ship 4.3) | `gh pr create --base <base>` | Write the body to `<ledger folder>/pr-body.md`, then `az repos pr create --source-branch <branch> --target-branch <base> --title "<title>" --description "$(cat <ledger folder>/pr-body.md)" --query pullRequestId -o tsv`. The file keeps the body's backticks and quotes away from the shell. The description is capped at 4000 characters: when the body is longer, the description keeps everything up to `## What changed`, and the rest is the PR's first comment. |
| PR web URL | in `gh pr create`'s output | `az repos pr show --id <n> --query repository.webUrl -o tsv`, then append `/pullrequest/<n>` |
| PR checks (ship 4.5, verify 2) | `gh pr checks <n> --watch --fail-fast` | See "Waiting for PR checks" |
| A red check's log (ship 4.6, verify 2) | `gh run view <id> --log-failed \| tail -150` | See "Reading a failed run" |
| Rerun a red PR check (ship 4.6) | `gh run rerun <id> --failed` | `az repos pr policy queue --id <n> --evaluation-id <evaluationId>` |
| Mergeable (ship 5.1) | `gh pr view <n> --json mergeable,mergeStateStatus,statusCheckRollup,reviewDecision` | See "Before merging" |
| Merge (ship 5.3) | `gh pr merge <n> --squash --delete-branch` (or `--merge`) | `az repos pr update --id <n> --status completed --squash true --delete-source-branch true` (`Merge: merge`: `--squash false`). See "Merging". |
| Merge SHA | `gh pr view <n> --json mergeCommit --jq .mergeCommit.oid` | `az repos pr show --id <n> --query lastMergeCommit.commitId -o tsv`, once `status` is `completed` |
| Base-branch run (ship 6.1) | `gh run list --workflow=<pipeline> --branch=<base> --commit <sha> --json databaseId,status` | See "Base-branch run" |
| Watch a run (ship 6.1) | `gh run watch <id> --exit-status` | Poll `az pipelines runs show --id <id> --query "{status:status,result:result}" -o json`, with `sleep 60` run in the background between polls, until `status` is `completed` |
| Rerun a base-branch run (ship 6.3) | `gh run rerun <id> --failed` | `az pipelines run --id <pipeline> --branch <base> --commit-id <sha>`. It reruns the whole pipeline as a new run: watch the new id. A pipeline that also deploys is never rerun this way; park the failure. Not pre-approved: a pattern would also match a deploy pipeline. When `Workflow:` names a pipeline, list the exact allow line `Bash(az pipelines run --id <pipeline> --branch <base> *)` in the pre-flight batch. |
| PR comment (ship 5.5, 7.2) | `gh pr comment <n> --body-file <file>` | See "PR comment" |
| Run URL for templates | in `gh run view`'s output | the repository web URL (`az repos pr show --id <n> --query repository.webUrl -o tsv`, before `/pullrequest/<n>` is appended) with `_git/<repo>` replaced by `_build/results?buildId=<id>` |
| Never | `--admin` | `--bypass-policy`, `--bypass-policy-reason`, editing branch policies or pipeline definitions |

## Azure DevOps details

### Waiting for PR checks

The PR's checks are the base branch's policies, evaluated on the PR. Read them:

```bash
az repos pr policy list --id <n> --query "[].{name:configuration.type.displayName,blocking:configuration.isBlocking,status:status,build:context.buildId,expired:context.isExpired,evaluationId:evaluationId}" -o json
```

Poll it, with `sleep 60` run in the background between polls, until no `Build`
evaluation is `queued` or `running`. Still `queued` with no `build` after 30
minutes, and not expired: no agent picked it up; park it as a blocker.

- **Green:** every `Build` evaluation with `blocking: true` is `approved`. A non-blocking evaluation (a coverage `Status` check) is reported, never a gate. `notApplicable` counts as not there.
- **Red:** a blocking `Build` evaluation is `rejected`. Its `build` is the run id to read ("Reading a failed run").
- **Stale:** `queued` with `expired: true` and no new `build`. The base branch moved; the build will not restart on its own. Requeue it: `az repos pr policy queue --id <n> --evaluation-id <evaluationId>`, then poll again.
- **No `Build` evaluation** (or only `notApplicable` ones): read the base branch's build policies and their path filters, `az repos policy list --repository-id <id> --branch <base> --query "[?type.displayName=='Build'].{pipeline:settings.buildDefinitionId,blocking:isBlocking,filters:settings.filenamePatterns}" -o json` (the id from `az repos show --repository <repo> --query id -o tsv`). Filters are paths from the repo root; a `!` pattern excludes, and no filters means every file. Every changed file excluded, or no build policy at all: ship's "no PR CI for this diff", not CI None. A changed file a blocking policy includes: the build has not registered yet; wait as ship 4.5 says, then park.

### Before merging

1. `az repos pr show --id <n> --query "{status:status,mergeStatus:mergeStatus,isDraft:isDraft}" -o json`. `mergeStatus` `conflicts`: ship 5.2 (merge the base branch). A draft is not mergeable: park it.
2. The policy list above, filtered to `blocking: true`. Every blocking evaluation must be `approved` (or `notApplicable`). A blocking evaluation other than `Build` that is not `approved` (minimum reviewers, required reviewers, comment resolution, linked work items) means the repo needs a human: park it as ship 5.1 says, naming the policy ("needs approval: Minimum number of reviewers").

Azure DevOps has no "behind the base branch" state: a build that went stale
when the base branch moved is requeued ("Stale" above), and only
`mergeStatus` `conflicts` sends you to ship 5.2.

### Merging

`az repos pr update` with `--status completed` asks Azure DevOps to complete
the PR; the merge itself is asynchronous. Poll
`az repos pr show --id <n> --query "{status:status,mergeStatus:mergeStatus,sha:lastMergeCommit.commitId}" -o json`
until `status` is `completed`. Still `active` after 5 minutes, or a
`mergeStatus` of `rejectedByPolicy`, `conflicts` or `failure`: the merge is
refused (ship 5.4).

Unlike `gh pr merge --delete-branch`, this does not switch the local checkout.
It stays on the feature branch, whose remote branch is now deleted. Sections
6–8 create their branches from `origin/<base>`, so leave it.

### Base-branch run

Find the run on the merge SHA, newest first:

```bash
az pipelines runs list --pipeline-ids <pipeline> --branch refs/heads/<base> --top 10 --query-order QueueTimeDesc --query "[?sourceVersion=='<sha>'].{id:id,status:status,result:result,reason:reason}" -o json
```

- Without `--query-order QueueTimeDesc`, a run still in progress can fall outside `--top`, and the run looks missing. Without `--branch`, the same pipeline's PR builds can fill `--top`.
- No `Workflow:` configured: leave out `--pipeline-ids` and watch every run on the SHA.
- **Batched CI** (`reason: batchedCI`) builds the newest commit when several merges land together. No run on `<sha>` but a newer run whose `sourceVersion` contains it (`git merge-base --is-ancestor <sha> <sourceVersion>` exits 0) is the run for this merge.
- Never queue a run before the 5 minutes of ship 6.1 are up: the pipeline's own run is usually already queued, and a manual one duplicates it.

**Green:** `result` is `succeeded`, unless the config's `Green:` says
otherwise. `partiallySucceeded`, `failed` and `canceled` are red. Still
`notStarted` after 30 minutes: no agent picked it up; park it as a blocker.

### Reading a failed run

The steps that did not succeed and their log ids:

```bash
az devops invoke --area build --resource timeline --route-parameters project=<project> buildId=<id> --api-version 7.1 --query "records[?result=='failed' || result=='succeededWithIssues' || result=='canceled'].{name:name,type:type,result:result,log:log.id}" -o json
```

A `partiallySucceeded` run's culprits are its `succeededWithIssues` records.
Then the log of each such `Task` record, last 150 lines:

```bash
az devops invoke --area build --resource logs --route-parameters project=<project> buildId=<id> logId=<log> --api-version 7.1 --query value -o tsv | tail -150
```

### PR comment

`az repos pr` has no comment command. Write the comment to a JSON file in the
ledger's folder:

```json
{"comments": [{"parentCommentId": 0, "content": "<the markdown>", "commentType": 1}], "status": "closed"}
```

`status: closed` keeps it from counting as an open comment under a
comment-resolution policy. Post it:

```bash
az devops invoke --area git --resource pullRequestThreads --route-parameters project=<project> repositoryId=<repo> pullRequestId=<n> --http-method POST --in-file <file> --api-version 7.1
```
