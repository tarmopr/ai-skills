# Host: Azure DevOps

The commands `ship-plan`, `verify-and-fix` and `ship-issue` use when the
config's `Host:` is `azure-devops`. Write each command exactly as shown: the
`az` lines in the skills' `allowed-tools` match only these forms.

**Host:** the config's `## Repo` `Host:`. When it is missing, read
`git remote get-url origin`: `dev.azure.com` or `*.visualstudio.com` is
`azure-devops`, anything else is `github`. Record the result as a `Ruling:`.

`<n>` is the PR number (`pullRequestId`), `<id>` a pipeline run id,
`<pipeline>` the config's `Workflow:` (a pipeline definition id),
`<base>` the base branch, `<branch>` the PR's source branch, `<sha>` a commit,
and `<repo>` and `<project>` the names in the remote URL
(`https://dev.azure.com/<org>/<project>/_git/<repo>`).

Every command here was run read-only against a real Azure DevOps repo on
2026-10-24, except the writes (`pr create`, `pr update`, `pr policy queue`,
`pipelines run`, and `az devops invoke` with `POST` or `PATCH`), which were
never run.

## Auth check

`az account show`, then `az devops configure --list`. Every `az` command here takes the organization from those defaults or detects it from the remote when run in the checkout; a missing `azure-devops` extension or a sign-in error goes in the batch.

Your login is `user.name` in `az account show`'s output. It is the `uniqueName` that reviewers and comment authors carry.

## Repo identity

`<repo>` and `<project>` come from the remote URL. Two values are looked up once per run:

- `<repo id>`: `az repos show --repository <repo> --query id -o tsv`. `az repos policy list` needs it.
- The repository web URL: `az repos show --repository <repo> --query webUrl -o tsv`. It can be a `https://<org>.visualstudio.com/DefaultCollection/<project>/_git/<repo>` URL even when the remote is `dev.azure.com`; use it as it is.

## Default branch

`az repos show --repository <repo> --query defaultBranch -o tsv`, minus `refs/heads/`.

## Has CI

`az pipelines list --repository <repo> --repository-type tfsgit --query "[].{id:id,name:name}" -o json` is not empty.

## Where CI is defined

- **PR CI** is the base branch's build policies: `az repos policy list --repository-id <repo id> --branch <base> --query "[?type.displayName=='Build'].{pipeline:settings.buildDefinitionId,blocking:isBlocking,filters:settings.filenamePatterns}" -o json`. Each `pipeline` is a build definition the PR must pass.
- **Push CI** (the config's `Workflow:`) is the pipeline whose runs on the base branch were started by a push: `az pipelines runs list --branch refs/heads/<base> --top 20 --query-order QueueTimeDesc --query "[?reason=='batchedCI' || reason=='individualCI'].{pipeline:definition.id,name:definition.name}" -o json`. `Workflow:` is that pipeline's id. Several: ask which one the run watches. None: leave `Workflow:` out and note "no push pipeline" in the batch.
- **What a pipeline runs:** `az pipelines show --id <pipeline> --query "{name:name,type:process.type,yaml:process.yamlFilename,steps:process.phases[].steps[?enabled].displayName}" -o json`. `type` 2 is a YAML pipeline: read the file `yaml` names with `git show origin/<base>:<yaml>`, and draft gates from its script steps as from a GitHub workflow. `type` 1 is a classic pipeline: `steps` holds only the step names, so draft the gates from the repo's manifests, and name the steps in the batch as the source.
- **Never a gate:** a step that deploys, publishes, uploads (coverage, artifacts), comments on the PR, or reads secret variables.

## Allowed merge methods

`az repos policy list --repository-id <repo id> --branch <base> --query "[?type.displayName=='Require a merge strategy' && isEnabled].settings" -o json`.

- Empty (no merge strategy policy): every method is allowed. `Merge:` is `squash`.
- Otherwise `allowSquash` true: `squash`; else `allowNoFastForward` true: `merge`. Neither (rebase only): put it in the batch; the skills merge only by squash or merge commit.

These two field names were not seen in a real policy: the repo checked has no merge strategy policy. If they are missing from the output, put the output in the batch.

## Open the PR

The description is capped at 4000 characters. Write the body to two files in the ledger folder, with the Write tool:

1. The full body is 3,900 characters or less: all of it goes in `pr-body.md`. There is no `pr-body-rest.md`.
2. Longer: `pr-body.md` is the head, everything before `## What changed`, and `pr-body-rest.md` is the rest, from `## What changed` to the end.
3. The head is still over 3,900 characters (a long `## Plan`): the head is the summary paragraph only, and `pr-body-rest.md` is everything after it.

When the body is split, the head's last line is: "Full description in the first comment: what changed, how it was verified, and the decisions made without the user." The rulings are then in the first comment, and the closing comment's "Decisions" pointer names the first comment, not the description.

Open it:

```bash
az repos pr create --source-branch <branch> --target-branch <base> --title "<title>" --description "$(cat <ledger folder>/pr-body.md)" --query pullRequestId -o tsv
```

The file keeps the body's backticks and quotes away from the shell. Right after creation, post `pr-body-rest.md` with *PR comment*, before anything else is posted, so it is the first comment.

`"$(cat <file>)"` in a pre-approved command was checked once, on 2026-10-24: `az repos pr list --top 1 --query "$(cat <file>)" -o tsv` ran in the test repo without a permission denial. So the PR is opened with `az repos pr create`, not with `az devops invoke --area git --resource pullRequests --http-method POST`.

## PR web URL

`az repos pr show --id <n> --query repository.webUrl -o tsv`, then append `/pullrequest/<n>`.

## PR size

Azure DevOps has no size fields on a PR. Read it from git: `git diff --shortstat origin/<base>...origin/<branch>` (after `git fetch origin <branch>`), right before it is used, never from memory.

## Find open PRs

- **The branch's own PR:** `az repos pr list --status active --source-branch <branch> --query "[].pullRequestId" -o tsv`.
- **By search:** `az repos pr list --status active --query "[?contains(title,'<KEY-n>') || contains(sourceRefName,'<KEY-n>')].{id:pullRequestId,title:title,source:sourceRefName}" -o json` (an issue's PR); `az repos pr list --status active --query "[?contains(sourceRefName,'lessons')].{id:pullRequestId,source:sourceRefName}" -o json` (open lessons PRs). `contains` is case-sensitive.
- **A named PR's state:** `az repos pr show --id <n> --query "{status:status,closedDate:closedDate,head:lastMergeSourceCommit.commitId,source:sourceRefName}" -o json`, then `git fetch origin <its source branch>` and `git log --oneline origin/<base>..origin/<its source branch>`. `status` is `active`, `completed` (merged) or `abandoned`.
- **By changed files under a folder** (copies in flight): `az repos pr list --status active --query "[].{id:pullRequestId,source:sourceRefName}" -o json`. For each PR, `git fetch origin <its source branch>`, then `git diff --name-only origin/<base>...origin/<its source branch> -- <that folder>/`. For each PR that lists a file, `git diff origin/<base>...origin/<its source branch> | grep -n -e <name>`: a hit is a copy in flight.

## Wait for the PR's checks

The PR's checks are the base branch's policies, evaluated on the PR. Read them:

```bash
az repos pr policy list --id <n> --query "[].{name:configuration.type.displayName,blocking:configuration.isBlocking,status:status,build:context.buildId,expired:context.isExpired,evaluationId:evaluationId}" -o json
```

Poll it, with `sleep 60` run in the background between polls, until no `Build`
evaluation is `queued` or `running`. Still `queued` with no `build` after 30
minutes, and not expired: no agent picked it up; park it as a blocker.

- **Green:** every `Build` evaluation with `blocking: true` is `approved`. A non-blocking evaluation (a coverage `Status` check) is reported, never a gate. `notApplicable` counts as not there.
- **Red:** a blocking `Build` evaluation is `rejected`. Its `build` is the run id to read (*Read a failed run*).
- **Stale:** `queued` with `expired: true` and no new `build`. The base branch moved; the build will not restart on its own. Requeue it with *Rerun a failed PR check*, then poll again.
- **No `Build` evaluation** (or only `notApplicable` ones): see *Does CI cover this diff*.

## Does CI cover this diff

Read the base branch's build policies and their path filters:

```bash
az repos policy list --repository-id <repo id> --branch <base> --query "[?type.displayName=='Build'].{pipeline:settings.buildDefinitionId,blocking:isBlocking,filters:settings.filenamePatterns}" -o json
```

How `filenamePatterns` match a changed file:

- Patterns are evaluated in order, and the last pattern that matches the file wins. A file no pattern matches is excluded.
- `/` is the repo root. Paths are matched against `/<path from the repo root>`.
- `!` excludes a file an earlier pattern included. A list that starts with `!` includes nothing.
- `*` also matches `/`, so a pattern that starts with `*` (`*.md`, `*/.claude/*`) matches at any depth.
- A pattern that starts with neither `/` nor `*` has no effect.
- No filters (`null` or empty) means every file.

Every changed file excluded, or no build policy at all: "no PR CI for this diff", not CI None. A changed file a blocking policy includes: the build has not registered yet; wait up to 10 minutes, then treat it as a blocker.

## Read a failed run

The steps that did not succeed and their log ids:

```bash
az devops invoke --area build --resource timeline --route-parameters project=<project> buildId=<id> --api-version 7.1 --query "records[?result=='failed' || result=='succeededWithIssues' || result=='canceled'].{name:name,type:type,result:result,log:log.id}" -o json
```

A `partiallySucceeded` run's culprits are its `succeededWithIssues` records.
Then the log of each such `Task` record, last 150 lines:

```bash
az devops invoke --area build --resource logs --route-parameters project=<project> buildId=<id> logId=<log> --api-version 7.1 --query value -o tsv | tail -150
```

## Rerun a failed PR check

`az repos pr policy queue --id <n> --evaluation-id <evaluationId>`, with the `evaluationId` of the red or stale `Build` evaluation. It queues the whole build again, as a new run: read its id from the policy list.

## Read the review rule

The base branch's policies:

```bash
az repos policy list --repository-id <repo id> --branch <base> --query "[?isEnabled].{type:type.displayName,blocking:isBlocking,settings:settings}" -o json
```

Record
`Review rule: approvals <n> | code owners <yes/no> | stale dismissed <yes/no> | threads must be resolved <yes/no> | source <config/policy/unknown>`:

- **Approvals:** the blocking "Minimum number of reviewers" policy's `settings.minimumApproverCount`. No such policy: 0.
- **Code owners:** yes when a blocking "Required reviewers" policy exists.
- **Stale dismissed:** the "Minimum number of reviewers" policy's `settings.resetOnSourcePush` is true.
- **Threads must be resolved:** yes when a blocking "Comment requirements" policy exists.
- **The config's `Approvals:`** applies when the policies could not be read, and can raise what they say, never lower it: Azure DevOps enforces its own policies whatever the config says.
- **The policy list fails, and no `Approvals:`:** assume 1.

## Request an AI review

None on this host. Skip. A config `Copilot review: yes` has no effect here: say so in the report.

## Re-request a reviewer

None on this host. Skip. The reply notifies the reviewer, and a push resets votes when the policy's `resetOnSourcePush` says so.

## Fetch review items

The PR's threads:

```bash
az devops invoke --area git --resource pullRequestThreads --route-parameters project=<project> repositoryId=<repo> pullRequestId=<n> --api-version 7.1 --query "value[?!isDeleted].{id:id,status:status,file:threadContext.filePath,line:threadContext.rightFileStart.line,comments:comments[?commentType!='system' && !isDeleted].{id:id,author:author.uniqueName,content:content,published:publishedDate}}" -o json
```

A thread with no comments left after the filter is a system message ("updated the pull request status"): skip it. A thread with a `file` is an inline thread; one without is a conversation comment. Azure DevOps has no review bodies: approvals are votes (*Review state*).

| Item | Key | New when |
|---|---|---|
| Thread | `thread <thread id> @ <last comment id>` | Its `status` is `active` or `pending`, its last comment is not yours, and the ledger has no line for this key. A reviewer's reply in a handled thread changes the last comment, so it is new. |

Comment ids count from 1 within each thread, so the key needs both ids.

## Reply to a review item

Write the reply to a JSON file in the ledger folder with the Write tool:

```json
{"content": "<the markdown>", "parentCommentId": 1, "commentType": 1}
```

Post it to the thread:

```bash
az devops invoke --area git --resource pullRequestThreadComments --route-parameters project=<project> repositoryId=<repo> pullRequestId=<n> threadId=<thread id> --http-method POST --in-file <file> --api-version 7.1
```

## Resolve a bot's thread

Only a bot's thread, once it has a reply. Azure DevOps has no Copilot reviewer, so in practice never. A person's thread is theirs to resolve.

The command sets the thread's status. Write `{"status": "fixed"}` to a JSON file in the ledger folder, then:

```bash
az devops invoke --area git --resource pullRequestThreads --route-parameters project=<project> repositoryId=<repo> pullRequestId=<n> threadId=<thread id> --http-method PATCH --in-file <file> --api-version 7.1
```

## Review state

The reviewers and their votes:

```bash
az repos pr show --id <n> --query "reviewers[].{name:displayName,unique:uniqueName,vote:vote,required:isRequired}" -o json
```

- **Votes:** 10 (approved) and 5 (approved with suggestions) count as approved. -10 (rejected) is changes requested. -5 (waiting for the author) is not an approval. 0 is no vote.
- **Approvals:** leave out yours (`unique` is your login), and count the approved votes. The count reaches the rule's number, and no vote is -10.
- **Threads:** when threads must be resolved, every thread from *Fetch review items* is resolved (`status` is not `active` or `pending`).
- **Policies that are not reviews:** read the PR's policy list (*Merge state*). A blocking evaluation that is not `approved` and is not "Build", "Minimum number of reviewers", "Required reviewers" or "Comment requirements" (for example "Work item linking") gets its own park text: "needs: <policy display name>", never "needs approval".

## Merge state

Always read both, with PR CI or without it:

1. `az repos pr show --id <n> --query "{status:status,mergeStatus:mergeStatus,isDraft:isDraft}" -o json`. `mergeStatus` `conflicts`: merge the base branch (ship-plan 5.2). A draft is not mergeable: park it.
2. The policy list from *Wait for the PR's checks*, filtered to `blocking: true`. Every blocking evaluation must be `approved` (or `notApplicable`). With no PR CI there is no `Build` evaluation, but the reviewer, comment and work item policies are still read.

A blocking evaluation other than `Build` that is not `approved` means the repo needs a human. Park it, naming the policy:

- "Minimum number of reviewers" or "Required reviewers": "needs approval: <policy display name>".
- Any other policy ("Comment requirements", "Work item linking", …): "needs: <policy display name>".

Azure DevOps has no "behind the base branch" state: a build that went stale
when the base branch moved is requeued ("Stale" in *Wait for the PR's checks*),
and only `mergeStatus` `conflicts` sends you to ship-plan 5.2.

## Merge the PR

`Merge: squash`:

```bash
az repos pr update --id <n> --status completed --squash true --delete-source-branch true
```

`Merge: merge`: the same with `--squash false`.

This asks Azure DevOps to complete the PR; the merge itself is asynchronous.
Poll `az repos pr show --id <n> --query "{status:status,mergeStatus:mergeStatus,sha:lastMergeCommit.commitId}" -o json`
until `status` is `completed`. Still `active` after 5 minutes, or a
`mergeStatus` of `rejectedByPolicy`, `conflicts` or `failure`: the merge is
refused (ship-plan 5.4).

The merge SHA: `az repos pr show --id <n> --query lastMergeCommit.commitId -o tsv`, once `status` is `completed`.

Unlike `gh pr merge --delete-branch`, this does not switch the local checkout.
It stays on the feature branch, whose remote branch is now deleted. Sections
6–8 create their branches from `origin/<base>`, so leave it.

## Find the base-branch run

Find the run on the merge SHA, newest first:

```bash
az pipelines runs list --pipeline-ids <pipeline> --branch refs/heads/<base> --top 10 --query-order QueueTimeDesc --query "[?sourceVersion=='<sha>'].{id:id,status:status,result:result,reason:reason}" -o json
```

- Without `--query-order QueueTimeDesc`, a run still in progress can fall outside `--top`, and the run looks missing. Without `--branch`, the same pipeline's PR builds can fill `--top`.
- No `Workflow:` configured: leave out `--pipeline-ids` and watch every run on the SHA.

**Batched CI** (`reason: batchedCI`) builds only the newest commit when several merges land together, so a run on `<sha>` may never exist. Find the run that contains it:

1. List the recent runs, with no SHA filter: `az pipelines runs list --pipeline-ids <pipeline> --branch refs/heads/<base> --top 10 --query-order QueueTimeDesc --query "[].{id:id,sourceVersion:sourceVersion,reason:reason}" -o json`.
2. `git fetch origin <base>`.
3. For each candidate, oldest first: `git merge-base --is-ancestor <sha> <sourceVersion>`. The first one that exits 0 is the run for this merge.

**No run within 5 minutes** (neither on `<sha>` nor one that contains it): record "no base-branch run for `<sha>`", treat it like CI None for this merge, and say so in the report. Never queue a run yourself: the pipeline's own run is usually already queued, and a manual one duplicates it, or deploys.

The base branch's last runs: `az pipelines runs list --pipeline-ids <pipeline> --branch refs/heads/<base> --top 3 --query-order QueueTimeDesc --query "[].{id:id,status:status,result:result,sourceVersion:sourceVersion}" -o json`.

## Watch a run

Poll `az pipelines runs show --id <id> --query "{status:status,result:result}" -o json`, with `sleep 60` run in the background between polls, until `status` is `completed`.

**Green:** `result` is `succeeded`, unless the config's `Green:` says
otherwise. `partiallySucceeded`, `failed` and `canceled` are red. Still
`notStarted` after 30 minutes: no agent picked it up; park it as a blocker.

## Rerun a base-branch run

`az pipelines run --id <pipeline> --branch <base> --commit-id <sha>`. It reruns the whole pipeline as a new run: watch the new id.

**Never rerun a pipeline that deploys.** Park the failure instead. A pipeline deploys when:

- the config's `## Never do` names it; or
- its definition deploys. Read it with `az pipelines show --id <pipeline> --query "{name:name,type:process.type,yaml:process.yamlFilename,steps:process.phases[].steps[?enabled].displayName}" -o json`. A YAML pipeline (`type` 2) deploys when its file (`git show origin/<base>:<yaml>`) has a `deployment:` job or an `environment:`. A classic pipeline (`type` 1) deploys when an enabled step deploys or publishes (its name says Deploy, Publish, Release or App Service), or its name does. Unsure: it deploys.

`process.stages` is empty for both kinds of pipeline, so it cannot tell.

Not pre-approved: a pattern would also match a deploy pipeline. When `Workflow:` names a pipeline that does not deploy, ship-plan's pre-flight batch lists the exact allow line:

```
Bash(az pipelines run --id <pipeline> --branch <base> *)
```

## PR comment

`az repos pr` has no comment command. Write the comment to a JSON file in the
ledger folder, with the Write tool:

```json
{"comments": [{"parentCommentId": 0, "content": "<the markdown>", "commentType": 1}], "status": "closed"}
```

`status: closed` keeps it from counting as an open comment under a
comment-resolution policy. Post it:

```bash
az devops invoke --area git --resource pullRequestThreads --route-parameters project=<project> repositoryId=<repo> pullRequestId=<n> --http-method POST --in-file <file> --api-version 7.1
```

## Run web URL

The repository web URL (*Repo identity*) with `_git/<repo>` replaced by `_build/results?buildId=<id>`.

## Never

- `--bypass-policy`, `--bypass-policy-reason`.
- Editing branch policies or pipeline definitions.
- Voting on the PR (approving), or resolving a person's thread.
- Queuing a base-branch run that the pipeline did not start itself, except the rerun above; and never any run of a pipeline that deploys.
