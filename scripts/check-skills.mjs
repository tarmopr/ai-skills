#!/usr/bin/env node
// Structural checks for the tool-neutral ship-queue, ship-issue, ship-plan and verify-and-fix skills,
// and, in a full run, a private-data scan of the published .md files (C13).
// Behaviour is tested by the paper scenarios in docs/superpowers/scenarios/; this pins shape only.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { basename, join, dirname, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Usage: node scripts/check-skills.mjs [skill file …]   (paths relative to skills/)
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.SKILLS_ROOT || resolve(HERE, '..', 'skills');

// Operation names: the `##` headings every file of a kind has, and the names a
// skill may use in "the host's *X*", "the tracker's *X*", "the notifier's *X*".
const HOST_OPS = [
  'Auth check', 'Repo identity', 'Default branch', 'Has CI', 'Where CI is defined',
  'Allowed merge methods', 'Open the PR', 'PR web URL', 'PR size', 'Find open PRs',
  "Wait for the PR's checks", 'Does CI cover this diff', 'Read a failed run',
  'Rerun a failed PR check', 'Read the review rule', 'Request an AI review',
  'Re-request a reviewer', 'Fetch review items', 'Reply to a review item',
  "Resolve a bot's thread", 'Review state', 'Merge state', 'Merge the PR',
  'Find the base-branch run', 'Watch a run', 'Rerun a base-branch run', 'PR comment',
  'Run web URL', 'Never',
];
const TRACKER_OPS = [
  'Auth', 'Issue keys', 'Integration', 'Find an issue', 'Read an issue',
  'Where a new issue goes', 'Create an issue', 'Append the plan', 'Assign', 'Set status',
  'Link the PR', 'Comment', 'Link two issues', 'Find an existing follow-up', 'List sub-issues',
];
const NOTIFIER_OPS = [
  'Choose the channel', 'People', 'Review request', 'Re-review request', 'Mark merged', 'Failures',
];
const OPS = { host: HOST_OPS, tracker: TRACKER_OPS, notifier: NOTIFIER_OPS };
const h2 = (names) => names.map((n) => `## ${n}`);

const FILES = {
  'ship-plan/SKILL.md': [
    '## What invoking this skill authorizes', '## The run', '### The ledger',
    // Ship runner (2026-11-03): the phase sections moved to phase files; SKILL.md keeps one index line each.
    '## 0. Pre-flight — see [phase-implement.md](phase-implement.md); read it when this phase starts',
    '## 1. Tracker and branch — see [phase-implement.md](phase-implement.md); read it when this phase starts',
    '## 2. Implement — see [phase-implement.md](phase-implement.md); read it when this phase starts',
    '## 2b. Simplify — see [phase-implement.md](phase-implement.md); read it when this phase starts',
    '## 3. Questions — see [phase-verify.md](phase-verify.md); read it when this phase starts, and whenever a question comes up before it',
    '## 4. Verify, push, PR — see [phase-verify.md](phase-verify.md); read it when this phase starts',
    '## 4R. Review — see [phase-merge.md](phase-merge.md); read it when this phase starts',
    '## 5. Merge — see [phase-merge.md](phase-merge.md); read it when this phase starts',
    '## 6. Base-branch CI — see [phase-merge.md](phase-merge.md); read it when this phase starts',
    '## 6b. Validate the deploy — see [phase-merge.md](phase-merge.md); read it when this phase starts',
    '## 7. Close out — see [phase-close.md](phase-close.md); read it when this phase starts',
    '## 8. Lessons — see [phase-close.md](phase-close.md); read it when this phase starts',
    '## Queued mode (ship-queue)', '## Runner mode (ship-runner)', '## Red flags',
  ],
  // Ship runner (2026-11-03): phase sections moved verbatim from SKILL.md.
  'ship-plan/phase-implement.md': ['## 0. Pre-flight',
    '## 1. Tracker and branch',
    '## 2. Implement',
    '## 2b. Simplify'],
  'ship-plan/phase-verify.md': ['## 3. Questions',
    '## 4. Verify, push, PR'],
  'ship-plan/phase-merge.md': ['## 4R. Review',
    '## 5. Merge',
    '## 6. Base-branch CI',
    '## 6b. Validate the deploy'],
  'ship-plan/phase-close.md': ['## 7. Close out',
    '## 8. Lessons'],
  'ship-plan/config-format.md': [
    '## Reading rules', '## Sections', '### `## Repo`', '### `## Prerequisites`', '### `## Gates`',
    '### `## Reviewers by path`', '### `## Security extras`', '### `## Fix rules`',
    '### `## UI testing`', '### `## CI`', '### `## After merge`', '### `## Jira`',
    '### `## Linear`', '### `## GitHub Issues`', '### `## Slack`', '### `## Evidence`', '### `## Worktree`',
    '### `## Models`', '### `## Never do`',
  ],
  'ship-plan/config-drafting.md': ['## Drafting a missing config', '## Examples'],
  'ship-plan/templates.md': ['## PR body'],
  'ship-plan/templates-pr.md': [
    '## PR comment: done', '## PR comment: not merged', '## PR comment: base branch red',
  ],
  'ship-plan/templates-issue.md': [
    '## Issue question', '## New issue', '## Plan appended', '## Issue comment: merged',
    '## Issue comment: done', '## Issue comment: base branch red', '## Issue comment: not merged',
    '## Issue comment: review round', '## Issue comment: awaiting review',
  ],
  // Moved verbatim from SKILL.md sections; no headings are pinned.
  'ship-plan/docs-pr.md': [],
  'ship-plan/red-base.md': [],
  'ship-plan/log-formats.md': ['## interruptions.md seed', '## blockers.md seed'],
  'ship-plan/hosts/github.md': h2(HOST_OPS),
  'ship-plan/hosts/azure-devops.md': h2(HOST_OPS),
  'ship-plan/trackers/jira.md': h2(TRACKER_OPS),
  'ship-plan/trackers/linear.md': h2(TRACKER_OPS),
  'ship-plan/trackers/github.md': h2(TRACKER_OPS),
  'ship-plan/notifiers/slack.md': h2(NOTIFIER_OPS),
  'verify-and-fix/SKILL.md': [
    '## The loop', '## 1. Setup', '## 2. Gates', '## 3. UI scenarios', '## 4. Review round',
    '## 5. Triage and fix', '## 6. When to stop and ask', '## 7. Report',
    '## 8. Self-improvement', '## Runner mode (ship-runner)', '## Red flags',
  ],
  'verify-and-fix/ui-testing.md': [
    '## 1. Write the scenarios before opening the browser', '## 2. Where to run',
    '## 3. Drive each scenario', '## 4. When a scenario fails',
  ],
  'verify-and-fix/review-comments.md': ['## Review reply'],
  'ship-issue/SKILL.md': [
    '## What invoking this skill authorizes', '## The ledger',
    // Ship runner (2026-11-03): I0–I5 moved to phase files; SKILL.md keeps one index line each.
    '## I0. Route: what already exists — see [phase-spec.md](phase-spec.md); read it when this phase starts',
    '## I1. The issue — see [phase-spec.md](phase-spec.md); read it when this phase starts',
    '## I2. Research and spec: the Spec stage — see [phase-spec.md](phase-spec.md); read it when this phase starts',
    '## I3. The one question batch — see [phase-spec.md](phase-spec.md); read it when this phase starts',
    '## I4. Plan: the Plan stage — see [phase-plan.md](phase-plan.md); read it when this phase starts',
    '## I5. Tracker — see [phase-plan.md](phase-plan.md); read it when this phase starts',
    '## I6. Hand off', '## Queued mode (ship-queue)', '## Runner mode (ship-runner)', '## Red flags',
  ],
  // Ship runner (2026-11-03): phase sections moved verbatim from SKILL.md.
  'ship-issue/phase-spec.md': ['## I0. Route: what already exists',
    '## I1. The issue',
    '## I2. Research and spec: the Spec stage',
    '## I3. The one question batch'],
  'ship-issue/phase-plan.md': ['## I4. Plan: the Plan stage',
    '## I5. Tracker'],
  'ship-issue/stage-prompts.md': ['## Spec stage', '## Plan stage', '## Stage report'],
  'ship-issue/evidence.md': [
    '## Where the sources come from', '## Kinds of source', '## The baseline',
    '## Personal and sensitive data', '## When a source is refused',
  ],
  'ship-issue/log-formats.md': ['## interruptions.md seed'],
  'ship-issue/worktree.md': [],
  'ship-queue/SKILL.md': [
    '## What invoking this skill authorizes', '## The ledger', '## Q0. Pre-flight', '## Q1. Order',
    '## Q2. The loop', '## Q3. The review sweep', '## Q4. Summary', '## Checkout',
    '## Resume and session end', '## Red flags',
  ],
};

// C2: headings that moved out and must not be left behind (prefix match, outside fences).
const ABSENT = {
  'ship-plan/templates.md': ['## PR comment:', '## Review reply', '## Jira', '## Issue', '## Slack:'],
};

// C12: files of one kind share one `##` heading set.
const KINDS = [
  ['ship-plan/hosts/github.md', 'ship-plan/hosts/azure-devops.md'],
  ['ship-plan/trackers/jira.md', 'ship-plan/trackers/linear.md', 'ship-plan/trackers/github.md'],
];

const MOVE_LINE = 'move `.claude/ship.md` to `.claude/ship-plan.md`';

// C8: phrases that pin decisions from the spec and plan.
// Ship runner (2026-11-03): what skills/ship-plan/scripts/runner*.mjs parses from a child.
const RUNNER_PHRASES = ['## Runner mode (ship-runner)', 'printenv SHIP_RUNNER', 'printenv SHIP_RUNNER_KEY', 'state.json', '`current`',
  'RUNNER: <phase-done|waiting|blocked|done> <text>', 'Blocked: <reason>', '`Asked: … — pending`',
  'Progress: <text>', 'Answer in the session that started the run.'];
const PHRASES = {
  'ship-plan/SKILL.md': [
    'not pre-approved', MOVE_LINE,
    // Repo overrides and `## Allowed`: post-deploy validation, and this skill's override folder.
    '## 6b. Validate the deploy', '.claude/ship-plan/ship-plan/',
    // Ship runner (2026-11-03): the phrases of moved sections are pinned in their phase files below.
    ...RUNNER_PHRASES, 'Progress: task <n> done', 'Phase: 4R', 'git log <base>..HEAD --oneline',
    // ship-queue (2026-11-01).
    '/ship-queue <parent> <KEY>: <answers>', 'never `AskUserQuestion`', 'docs/ship-plan-lessons-<yyyy-mm-dd>-<KEY-n>',
    'Outcome: <Done|Base branch red|Awaiting review|Not merged>', 'Lessons branch: <name>', 'started by ship-queue as its child session',
  ],
  'ship-plan/phase-implement.md': ['read [templates-issue.md](templates-issue.md)', 'read [notifiers/slack.md](notifiers/slack.md)',
    'jira, linear, github or none', 'closing keyword'],
  'ship-plan/phase-verify.md': ['no PR CI for this diff'],
  'ship-plan/phase-merge.md': ['read [red-base.md](red-base.md)', '## 6b. Validate the deploy'],
  'ship-plan/phase-close.md': ['read [docs-pr.md](docs-pr.md)'],
  'verify-and-fix/SKILL.md': ['`jira.md`, `linear.md` or `github.md`', 'closing keyword', MOVE_LINE, 'read [review-comments.md](review-comments.md)', '.claude/ship-plan/verify-and-fix/',
    ...RUNNER_PHRASES, 'Done: <HEAD sha>'],
  'ship-issue/phase-spec.md': ['jira, linear, github or none', 'as file names write it'],
  'ship-issue/SKILL.md': [MOVE_LINE, ...RUNNER_PHRASES, 'Phase: I6', 'read [worktree.md](worktree.md)', '.claude/ship-plan/ship-issue/',
    '/ship-queue <parent> <KEY>: <answers>', 'never `AskUserQuestion`', 'started by ship-queue as its child session'],
  'ship-plan/config-format.md': [
    'A missing `.github/` folder', 'Tracker:', 'Host:', 'read [config-drafting.md](config-drafting.md)',
    // Repo overrides and `## Allowed`: the override layout, the closed list, the loosening rule, the new fields.
    '## Repo override files', '### `## Allowed`', 'Merge that deploys to:', 'Sign in on Hosted URL: test users',
    '## Loosening changes', 'Merge deploys to:', 'Hosted URL:',
  ],
  'ship-plan/templates-issue.md': ['Which tracker does this repo use?', 'No tracker (the PR is the record)', '"GitHub Issues"', 'gh issue list -R <Repo> --state all --limit 1', 'prefixed with `<host>/`'],
  'ship-queue/SKILL.md': ['show order', 'not in this queue', 'waits for <KEY>', 'base branch red',
    'Current: <KEY> started', 'Result: <KEY>', '/ship-queue <parent> <KEY>: <answers>',
    'never writes a ship-issue or ship-plan ledger', 'read [../ship-issue/worktree.md](../ship-issue/worktree.md)',
    // Final review fixes (2026-11-02).
    'Summary: posted <time>', 'Stopped: <reason>', '`done, questions pending`', 'Lessons branch:', 'every checkout `git worktree list` shows', 'Outcome: Base branch red',
    // Token wave 1 (2026-11-02): child sessions.
    '## Child sessions', 'SHIP_QUEUE_PARENT', '`cut off`', 'Cost: <KEY> run <n>', 'not started: session limit'],
  'ship-issue/worktree.md': ['The ship-queue worktree'],
  'ship-plan/notifiers/slack.md': ['pr-merged', 'thread_ts', 'Slack: re-review', 'Slack: merged reaction'],
  'ship-plan/hosts/github.md': ['--hostname', 'contains("/issues/<n>)")'],
  'ship-plan/hosts/azure-devops.md': ['git merge-base --is-ancestor', 'Full description in the first comment'],
  'ship-plan/trackers/jira.md': ['createJiraIssueLink', '32,767', 'parent = <key>', 'is blocked by'],
  'ship-plan/trackers/linear.md': ['gitBranchName', 'links', 'parentId', 'includeRelations'],
  'ship-plan/trackers/github.md': ['ship-queue does not support', '65,536', 'closing keyword', '--reason completed', 'hasIssuesEnabled',
    // Final review fixes: GHE host in -R and gh api; a branch number is a key only when the PR links that issue.
    '`<host>/<owner>/<name>` on GitHub Enterprise', 'milestones --hostname <host>', 'links that issue',
    // Deferred minors, 2026-11-01: exact type-label name; failure rule covers labels and milestones; an issue's PR by its URL.
    'whose `name` is exactly', 'A `gh issue`, `gh label` or milestones `gh api` call', 'never `#<n>`'],
  'ship-plan/templates.md': ['never a closing keyword'],
  'ship-issue/stage-prompts.md': ['closing keyword'],
};

// C6: each skill's full allowed-tools list: today's frontmatter plus the plan's Tasks 7, 8 and 9.
const BRANCH_TYPES = ['feature', 'fix', 'docs', 'chore', 'refactor'];
const AZ_THREADS = [
  'Bash(az devops invoke --area git --resource pullRequestThreads *)',
  'Bash(az devops invoke --area git --resource pullRequestThreadComments *)',
];
const AZ_BUILD_READ = [
  'Bash(az devops invoke --area build --resource timeline *)',
  'Bash(az devops invoke --area build --resource logs *)',
];
const linear = (...ops) => ops.map((o) => `mcp__plugin_linear_linear__${o}`);
// GitHub Issues tracker (trackers/github.md), 2026-11-01.
const GH_ISSUES = [
  'Bash(gh issue view *)', 'Bash(gh issue list *)', 'Bash(gh issue create *)',
  'Bash(gh issue edit *)', 'Bash(gh issue comment *)', 'Bash(gh issue close *)',
  'Bash(gh issue reopen *)', 'Bash(gh label list *)', 'Bash(gh label create *)',
  'Bash(gh api repos/*/milestones*)',
];

const SHIP_PLAN_ALLOWED_TOOLS = [
  'Bash(printenv SHIP_QUEUE_PARENT)', // Token wave 1: the queued test of a ship-queue child.
  'Bash(printenv SHIP_RUNNER)', // Ship runner (2026-11-03): the Runner mode test of a runner child.
  'Bash(printenv SHIP_RUNNER_KEY)', // Ship runner review round 3 (D5): the item key the runner gives a child.
  ...BRANCH_TYPES.map((t) => `Bash(git switch -c ${t}/*)`),
  ...BRANCH_TYPES.map((t) => `Bash(git push -u origin ${t}/*)`),
  ...BRANCH_TYPES.map((t) => `Bash(git push origin ${t}/*)`),
  'Bash(git fetch origin *)', 'Bash(git add *)', 'Bash(git commit *)',
  'Bash(git merge origin/*)', 'Bash(git revert --no-edit *)',
  'Bash(gh pr create *)', 'Bash(gh pr view *)', 'Bash(gh pr checks *)', 'Bash(gh pr comment *)',
  'Bash(gh pr edit * --add-reviewer *)', 'Bash(gh repo view *)',
  'Bash(gh api user --jq .login)', 'Bash(gh api user --jq .login --hostname *)',
  'Bash(gh api repos/*/rules/branches/*)',
  'Bash(gh api repos/*/branches/*/protection/required_pull_request_reviews)',
  'Bash(gh api repos/*/branches/*/protection/required_pull_request_reviews --hostname *)',
  "Bash(gh api graphql -f query='query ReviewThreads*)",
  "Bash(gh api graphql -f query='mutation ReplyToThread*)",
  "Bash(gh api graphql -f query='mutation ResolveThread*)",
  'Bash(gh auth status)', 'Bash(git status *)', 'Bash(git diff *)', 'Bash(git reset --keep origin/*)',
  'Bash(tail *)', 'Bash(sleep *)', 'Bash(git rev-parse *)', 'Bash(git log *)',
  ...BRANCH_TYPES.map((t) => `Bash(git switch ${t}/*)`),
  'Bash(git remote set-head origin --auto)', 'Bash(git remote get-url origin)', 'Bash(mkdir -p .superpowers/*)',
  'mcp__plugin_atlassian_atlassian__discover',
  'mcp__plugin_engineering_slack__slack_search_channels',
  'mcp__plugin_engineering_slack__slack_send_message',
  'Bash(gh pr merge * --squash --delete-branch)', 'Bash(gh pr merge * --merge --delete-branch)',
  'Bash(gh run list *)', 'Bash(gh run view *)', 'Bash(gh run watch *)', 'Bash(gh run rerun * --failed)',
  'mcp__plugin_atlassian_atlassian__getAccessibleAtlassianResources',
  'mcp__plugin_atlassian_atlassian__atlassianUserInfo',
  'mcp__plugin_atlassian_atlassian__searchJiraIssuesUsingJql',
  'mcp__plugin_atlassian_atlassian__getJiraIssue',
  'mcp__plugin_atlassian_atlassian__executeRead',
  'mcp__plugin_atlassian_atlassian__executeWrite',
  'mcp__plugin_atlassian_atlassian__createJiraIssue',
  'mcp__plugin_atlassian_atlassian__editJiraIssue',
  'mcp__plugin_atlassian_atlassian__transitionJiraIssue',
  'mcp__plugin_atlassian_atlassian__addOrEditJiraIssueComment',
  // Task 8 additions.
  'Bash(az account show)', 'Bash(az devops configure --list)', 'Bash(az repos show *)',
  'Bash(az repos policy list *)', 'Bash(az pipelines list *)',
  // Read-only, used by the host's deploy-pipeline check (controller ruling, Task 8).
  'Bash(az pipelines show *)',
  // The host's *Find open PRs*: lessons PRs by search, and the copy check by changed files.
  'Bash(gh pr list *)', 'Bash(gh pr diff *)',
  'Bash(az devops invoke --area git --resource pullRequests --http-method POST *)', 'Bash(az repos pr show *)', 'Bash(az repos pr list *)',
  'Bash(az repos pr policy list *)', 'Bash(az repos pr policy queue *)',
  'Bash(az repos pr update --id * --status completed --squash true --delete-source-branch true)',
  'Bash(az repos pr update --id * --status completed --squash false --delete-source-branch true)',
  'Bash(az pipelines runs list *)', 'Bash(az pipelines runs show *)',
  ...AZ_BUILD_READ, ...AZ_THREADS,
  'Bash(git merge-base *)',
  ...linear('get_user', 'get_issue', 'list_issues', 'list_comments', 'list_issue_statuses', 'save_issue', 'save_comment'),
  // Task 8 fix round 1: drafting a missing `## Linear` (linear.md *Where a new issue goes*).
  ...linear('list_teams', 'list_projects'),
  'mcp__plugin_engineering_slack__slack_add_reaction',
  'mcp__plugin_engineering_slack__slack_search_users',
  ...GH_ISSUES,
];

const SHIP_ISSUE_ALLOWED_TOOLS = [
  'Bash(printenv SHIP_QUEUE_PARENT)', // Token wave 1: the queued test of a ship-queue child.
  'Bash(printenv SHIP_RUNNER)', // Ship runner (2026-11-03): the Runner mode test of a runner child.
  'Bash(printenv SHIP_RUNNER_KEY)', // Ship runner review round 3 (D5): the item key the runner gives a child.
  ...BRANCH_TYPES.map((t) => `Bash(git switch -c ${t}/*)`),
  'Bash(git worktree add *)', 'Bash(git fetch origin *)', 'Bash(git add *)', 'Bash(git commit *)',
  'Bash(git hook run pre-commit)', 'Bash(git status)', 'Bash(git worktree list)', 'Bash(git remote get-url origin)',
  'Bash(git rev-parse *)', 'Bash(git check-ignore *)',
  'Bash(gh auth status)', 'Bash(gh run list *)', 'Bash(gh pr list *)',
  'mcp__plugin_atlassian_atlassian__getAccessibleAtlassianResources',
  'mcp__plugin_atlassian_atlassian__atlassianUserInfo',
  'mcp__plugin_atlassian_atlassian__getJiraIssue',
  'mcp__plugin_atlassian_atlassian__searchJiraIssuesUsingJql',
  'mcp__plugin_atlassian_atlassian__executeRead',
  'mcp__plugin_atlassian_atlassian__discover',
  'mcp__plugin_engineering_slack__slack_search_channels',
  'mcp__plugin_atlassian_atlassian__executeWrite',
  'mcp__plugin_atlassian_atlassian__createJiraIssue',
  'mcp__plugin_atlassian_atlassian__editJiraIssue',
  'mcp__plugin_atlassian_atlassian__transitionJiraIssue',
  'mcp__plugin_atlassian_atlassian__addOrEditJiraIssueComment',
  // Task 9 additions.
  'Bash(az account show)', 'Bash(az repos pr list *)', 'Bash(az pipelines runs list *)',
  ...linear('get_user', 'get_issue', 'list_issues', 'list_comments', 'list_teams', 'list_projects', 'save_issue', 'save_comment'),
  // Controller ruling, Task 9: drafting a missing `## Linear` (linear.md *Where a new issue goes*) reads the statuses.
  ...linear('list_issue_statuses'),
  // Task 9 fix round 1 (read-only): a named PR's state, and the Azure DevOps *Auth check*.
  'Bash(gh pr view *)', 'Bash(az repos pr show *)', 'Bash(az devops configure --list)',
  ...GH_ISSUES, 'Bash(gh repo view *)',
];

const VERIFY_AND_FIX_ALLOWED_TOOLS = [
  'Bash(printenv SHIP_RUNNER)', // Ship runner (2026-11-03): the Runner mode test of a runner child.
  'Bash(printenv SHIP_RUNNER_KEY)', // Ship runner review round 3 (D5): the item key the runner gives a child.
  'Bash(git fetch origin *)', 'Bash(git status *)', 'Bash(git diff *)', 'Bash(git add *)',
  'Bash(git commit *)',
  // 0.5.3 (user approved): pushes name the branch, as in ship-plan; a non-fast-forward push merges origin/<branch>.
  'Bash(git push origin feature/*)', 'Bash(git push origin fix/*)', 'Bash(git push origin docs/*)',
  'Bash(git push origin chore/*)', 'Bash(git push origin refactor/*)', 'Bash(git merge origin/*)',
  'Bash(git rev-parse *)', 'Bash(git log *)',
  'Bash(git remote set-head origin --auto)', 'Bash(git remote get-url origin)', 'Bash(mkdir -p .superpowers/*)',
  'Bash(gh repo view *)', 'Bash(gh api user --jq .login)', 'Bash(gh api user --jq .login --hostname *)',
  'Bash(gh pr view *)', 'Bash(gh pr checks *)', 'Bash(gh pr comment *)',
  'Bash(gh pr edit * --add-reviewer *)', 'Bash(gh run view *)', 'Bash(tail *)',
  "Bash(gh api graphql -f query='query ReviewThreads*)",
  "Bash(gh api graphql -f query='mutation ReplyToThread*)",
  "Bash(gh api graphql -f query='mutation ResolveThread*)",
  'mcp__plugin_atlassian_atlassian__getJiraIssue',
  'mcp__plugin_atlassian_atlassian__addOrEditJiraIssueComment',
  // Task 7 additions.
  'Bash(az repos pr show *)', 'Bash(az repos pr list *)', 'Bash(az repos pr policy list *)',
  'Bash(az repos show *)', 'Bash(az pipelines runs show *)',
  ...AZ_BUILD_READ, ...AZ_THREADS,
  'Bash(az account show)',
  'Bash(az devops configure --list)', 'Bash(az repos policy list *)', 'Bash(gh pr list *)', 'Bash(gh pr diff *)',
  ...linear('get_issue', 'save_comment'),
  'Bash(gh issue view *)', 'Bash(gh issue comment *)',
];

// ship-queue (2026-11-01): its own reads, comments and checkout switches; ship-issue and ship-plan bring their own.
const SHIP_QUEUE_ALLOWED_TOOLS = [
  'Bash(git status)', 'Bash(git status --porcelain)', 'Bash(git worktree list)', 'Bash(git worktree add *)',
  'Bash(git fetch origin *)', 'Bash(git rev-parse *)', 'Bash(git remote get-url origin)',
  'Bash(git switch --detach origin/*)', 'Bash(git switch main)', 'Bash(git switch master)', 'Bash(git switch develop)',
  ...BRANCH_TYPES.map((t) => `Bash(git switch ${t}/*)`),
  'Bash(gh auth status)', 'Bash(gh api user --jq .login)', 'Bash(gh api user --jq .login --hostname *)', 'Bash(gh pr list *)',
  'Bash(az account show)', 'Bash(az devops configure --list)', 'Bash(az repos pr list *)',
  // Token wave 1 (2026-11-02): each sub-issue runs in a headless child session.
  'Bash(SHIP_QUEUE_PARENT=* claude -p *)', 'Bash(jq * .superpowers/ship-queue/*)',
  ...linear('get_user', 'get_issue', 'list_issues', 'list_comments', 'save_comment'),
  'mcp__plugin_atlassian_atlassian__getAccessibleAtlassianResources',
  'mcp__plugin_atlassian_atlassian__atlassianUserInfo',
  'mcp__plugin_atlassian_atlassian__getJiraIssue',
  'mcp__plugin_atlassian_atlassian__searchJiraIssuesUsingJql',
  'mcp__plugin_atlassian_atlassian__executeRead',
  'mcp__plugin_atlassian_atlassian__discover',
  'mcp__plugin_atlassian_atlassian__addOrEditJiraIssueComment',
];

const ALLOWED_TOOLS = {
  'ship-queue': SHIP_QUEUE_ALLOWED_TOOLS,
  'ship-plan': SHIP_PLAN_ALLOWED_TOOLS,
  'ship-issue': SHIP_ISSUE_ALLOWED_TOOLS,
  'verify-and-fix': VERIFY_AND_FIX_ALLOWED_TOOLS,
};
// Never pre-approved, on any host.
const NEVER_ALLOWED = /(--admin\b|--bypass-policy\b|\baz pipelines run\b)/;

// Tech/OS commands may appear only in the config's illustrative examples.
const TECH = /\b(npm|npx|yarn|pnpm|bun|dotnet|pytest|ruff|mypy|docker|deno|terraform|tflint|cargo|go test|go vet|open -a|brew)\b/;
const TECH_EXEMPT = new Set(['ship-plan/config-format.md', 'ship-plan/config-drafting.md']);
// Single lines exempt from C3: verbatim lessons that name the command that failed, not commands the run is told to use (Task 9 ruling).
const TECH_LINE_EXEMPT = {
  'ship-issue/stage-prompts.md': ['run `dotnet build` on it', 'refuses a `docker exec … psql` joined to'],
};
// C4: names from the repos these skills were first written for may appear nowhere. This repo is
// public, so those names are not in it: they are read from the SKILLS_PRIVATE_PATTERNS env var
// when it is non-empty, else from the gitignored `.claude/check-skills-private.txt` of this
// checkout or, from a worktree, of the main checkout. One regular expression per line, matched
// case-insensitively, also across a line break; a line starting with `#` is a comment, and a `#`
// after a space elsewhere is refused (it would silently become part of the pattern). C13 applies
// them to every scanned file and, in a full run, to every other tracked file. No failure message
// ever shows text a pattern matches (see `fail`). With none loaded, C4 checks only for a staging
// host name, and SKILLS_REQUIRE_PRIVATE=1 turns that into a failure.
// `staging\.[a-z]` catches a staging host name; a sentence that ends in "staging." is not one.
const STAGING = /staging\.[a-z]/;
function privateSource() {
  if (process.env.SKILLS_PRIVATE_PATTERNS) return ['SKILLS_PRIVATE_PATTERNS', process.env.SKILLS_PRIVATE_PATTERNS];
  const repo = resolve(ROOT, '..');
  const common = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: repo, encoding: 'utf8' });
  const roots = [repo];
  // The main checkout holds the common git dir as `.git` (as handoff's lib.mjs repoRoot assumes).
  const dir = common.status === 0 ? common.stdout.trim() : '';
  if (dir && basename(dir) === '.git') roots.push(dirname(dir));
  for (const [n, root] of roots.entries()) {
    const file = join(root, '.claude', 'check-skills-private.txt');
    if (existsSync(file)) return [`${basename(file)}${n ? ' (main checkout)' : ''}`, readFileSync(file, 'utf8')];
  }
  return ['', ''];
}
const [PRIVATE_FROM, privateText] = privateSource();
const invalid = (i, why) => {
  // Never echo the pattern: it is the private text this check keeps out of logs.
  process.stderr.write(`${PRIVATE_FROM.replace(/ \(main checkout\)$/, '')} line ${i + 1}: invalid pattern${why ? ` (${why})` : ''}\n`);
  process.exit(2);
};
const privatePatterns = [];
privateText.split(/\r?\n/).forEach((raw, i) => {
  const line = raw.trim();
  if (!line || line.startsWith('#')) return;
  if (/\s#/.test(line)) invalid(i, 'a comment goes on its own line');
  let re = null;
  try { re = new RegExp(line, 'i'); } catch {}
  if (!re) invalid(i);
  privatePatterns.push(re);
});
const isPrivate = (l) => privatePatterns.some((re) => re.test(l));
// A path is private when any of its parts is (an anchored pattern still matches a file's own name).
const privatePath = (p) => isPrivate(p) || p.split('/').some(isPrivate);
// Line indexes holding private text, a name wrapped onto the next line included (reported at its first line).
function privateHits(text) {
  const lines = text.split('\n');
  const hits = new Set();
  lines.forEach((l, i) => {
    if (isPrivate(l)) hits.add(i);
    else if (i + 1 < lines.length && !isPrivate(lines[i + 1]) && isPrivate(`${l.trimEnd()} ${lines[i + 1].trimStart()}`)) hits.add(i);
  });
  return hits;
}
const C4_PRIVATE = privatePatterns.length > 0;
if (!C4_PRIVATE && process.env.SKILLS_REQUIRE_PRIVATE === '1') {
  process.stderr.write('SKILLS_REQUIRE_PRIVATE=1: no private patterns loaded (.claude/check-skills-private.txt or SKILLS_PRIVATE_PATTERNS)\n');
  process.exit(2);
}
const MAIN = /(origin\/main\b|\bmain CI\b|green main\b)/;
// C13: no private information in the published .md files: skills/, docs/superpowers/scenarios/,
// docs/rationale/, the repo root's .md files and .claude/ship-plan.md. All sit beside skills/.
const REPO_ROOT = resolve(ROOT, '..');
const SCENARIOS = resolve(REPO_ROOT, 'docs/superpowers/scenarios');
const RATIONALE = resolve(REPO_ROOT, 'docs/rationale');
const ISSUE_KEY = /\b[A-Z][A-Z0-9]+-\d+\b/g;
// Tokens shaped like an issue key that are allowed: generic placeholders the skills use,
// the fictional keys the scenarios use, and standard names that are not issue keys.
// Anything else (a real key such as an `ABC-<n>` one) fails.
const KEY_ALLOW = new Set([
  // Placeholders in skills/.
  'ENG-123', 'PROJ-123', 'KEY-1',
  // Placeholders a scenario runner wrote in its saved answer.
  'PROJECT-2', 'PROJECT-3',
  // Fictional keys in the scenarios and their results (KEY_FICTIONAL covers the rest).
  'BILL-401', 'BILL-412', 'BILL-415', 'BILL-420', 'BILL-430', 'BILL-433', 'BILL-440', 'BILL-450',
  'BILL-461', 'BILL-462', 'BILL-463', 'BILL-464', 'BILL-470', 'PAY-301', 'RTE-88',
  // Standard names, not issue keys.
  'UTF-8', 'UTF-16', 'UTF-32', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512', 'ISO-8601', 'ISO-639',
  'ISO-3166', 'ISO-4217', 'RFC-3339', 'AES-128', 'AES-256',
]);
// Fictional prefixes the scenarios use: any number under them is allowed.
const KEY_FICTIONAL = /^(BILL|ENG|PAY|RTE|PROJ)-\d+$/;
const keyAllowed = (k) => KEY_ALLOW.has(k) || KEY_FICTIONAL.test(k);
// A lower-case key (`abc-123`, as in a branch name), checked in skills/ prose only.
const LOWER_KEY = /\b[a-z]{2,}-\d{3,}\b/g;
const PR_NUMBER = /(#|\bPR |\/pull\/)\d{2,}/; // skills/ only, outside fenced blocks: scenarios use fictional PR numbers.
const HOME_PATH = /(\/Users\/|\/home\/)/;

// C9: no tool call in a SKILL.md body.
const TOOL_CALL = [/\b(gh|az) [a-z]/, /mcp__/];
// C10: operation references.
const OP_REF = /\bthe (host|tracker|notifier)['’]s \*([^*]+)\*/g;
// C11: a conditional read ("when <condition>, read [<file>](<path>)") and the tail of its bold form.
// A ". " ends the condition; dots inside paths (`.claude/ship.md`) do not.
const READ_LINE = /\b[Ww]hen ((?:[^.]|\.(?!\s))*?), read \[[^\]]+\]\(([^)\s]+)\)/g;
const READ_TAIL = /^(?:[^.]|\.(?!\s))*?\.\*\*/;

const failures = [];
// Every failure goes through here. A detail that holds private text, or names a line that does
// (an anchored pattern, a name wrapped onto the next line), keeps only its `line <n>`; a path that
// holds private text is hidden. `fileHits` holds each read file's private line indexes.
const fileHits = new Map();
const fail = (file, check, detail) => {
  const n = /^line (\d+)/.exec(detail);
  const hidden = isPrivate(detail) || (n && fileHits.get(file)?.has(Number(n[1]) - 1));
  const shown = hidden ? `${n?.[0] ?? ''} (private text not shown)`.trim() : detail;
  failures.push(`${privatePath(file) ? '(path hidden)' : file}: ${check}: ${shown}`);
};

// Text with fenced blocks blanked out, line count preserved.
const FENCE = /^(`{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm;
const unfenced = (text) => text.replace(FENCE, (m) => m.replace(/[^\n]/g, ''));
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;

function frontmatter(file, text) {
  const m = text.match(FRONTMATTER);
  if (!m) return fail(file, 'C1 frontmatter', 'missing --- block at top');
  const lines = m[1].split('\n');
  lines.forEach((l, i) => {
    if (/^\s+[A-Za-z_-]+:/.test(l) && !/^\s+-\s/.test(l)) fail(file, 'C1 frontmatter', `indented key on line ${i + 2}: ${l.trim()}`);
  });
  const r = spawnSync('ruby', ['-ryaml', '-rjson', '-e', 'puts JSON.generate(YAML.safe_load(STDIN.read))'], { input: m[1], encoding: 'utf8' });
  if (r.status !== 0) return fail(file, 'C1 frontmatter', `YAML does not parse: ${r.stderr.trim()}`);
  const data = JSON.parse(r.stdout);
  const dir = file.split('/')[0];
  if (data.name !== dir) fail(file, 'C1 frontmatter', `name is ${data.name}, expected ${dir}`);
  if (!data.description || data.description.length < 40) fail(file, 'C1 frontmatter', 'description missing or too short');
  const want = ALLOWED_TOOLS[dir];
  if (want) {
    const got = new Set(data['allowed-tools'] || []);
    for (const t of want) if (!got.has(t)) fail(file, 'C6 allowed-tools', `missing ${t}`);
    for (const t of got) if (!want.includes(t)) fail(file, 'C6 allowed-tools', `unexpected ${t}`);
    for (const t of got) if (NEVER_ALLOWED.test(t)) fail(file, 'C6 allowed-tools', `never pre-approved: ${t}`);
  }
}

const headings2 = (text) => unfenced(text).split('\n').filter((l) => /^## /.test(l)).map((l) => l.trim());

const targets = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(FILES);
for (const file of targets) {
  const path = join(ROOT, file);
  if (!(file in FILES)) { fail(file, 'C0 exists', 'not a known skill file'); continue; }
  if (!existsSync(path)) { fail(file, 'C0 exists', 'file missing'); continue; }
  const text = readFileSync(path, 'utf8');
  fileHits.set(file, privateHits(text));
  const isSkill = file.endsWith('SKILL.md');
  if (isSkill) frontmatter(file, text);
  const fm = text.match(FRONTMATTER);
  const bodyStart = fm ? fm[0].split('\n').length - 1 : 0;
  for (const p of PHRASES[file] || []) {
    if (!text.includes(p)) fail(file, 'C8 phrase', `missing "${p}"`);
  }
  for (const h of FILES[file]) {
    if (!text.split('\n').some((l) => l.trim() === h)) fail(file, 'C2 heading', `missing "${h}"`);
  }
  for (const prefix of ABSENT[file] || []) {
    for (const h of headings2(text)) if (h.startsWith(prefix)) fail(file, 'C2 heading', `unexpected "${h}" (moved out)`);
  }
  text.split('\n').forEach((l, i) => {
    if (!TECH_EXEMPT.has(file) && TECH.test(l) && !(TECH_LINE_EXEMPT[file] || []).some((x) => l.includes(x))) fail(file, 'C3 tech command', `line ${i + 1}: ${l.trim()}`);
    // ship-plan/config-drafting.md: its example config is illustrative (a `staging.` host), not a repo reference.
    if (file !== 'ship-plan/config-drafting.md' && STAGING.test(l)) fail(file, 'C4 repo specific', `line ${i + 1}: ${l.trim()}`);
    if (MAIN.test(l)) fail(file, 'C5 literal main', `line ${i + 1}: ${l.trim()}`);
    if (isSkill && i >= bodyStart && TOOL_CALL.some((re) => re.test(l))) fail(file, 'C9 tool call in SKILL body', `line ${i + 1}: ${l.trim()}`);
  });
  // Links inside fenced blocks are templates (seed files), resolved where they are written.
  const prose = unfenced(text);
  for (const [, link] of prose.matchAll(/\]\(([^)#\s]+\.md)(?:#[^)]*)?\)/g)) {
    if (/^https?:/.test(link)) continue;
    if (!existsSync(resolve(dirname(path), link))) fail(file, 'C7 link', `broken link ${link}`);
  }
  for (const m of prose.matchAll(OP_REF)) {
    const [ref, kind, name] = m;
    if (!OPS[kind].includes(name.trim())) fail(file, 'C10 operation', `line ${lineOf(prose, m.index)}: "${ref}" names no ${kind} heading`);
  }
  // Read lines may wrap: match on the prose with newlines turned into spaces (indexes unchanged).
  const flat = prose.replace(/\n/g, ' ');
  for (const m of flat.matchAll(READ_LINE)) {
    const line = lineOf(prose, m.index);
    const link = m[2].replace(/#.*$/, '');
    const bold = flat.slice(m.index - 2, m.index) === '**' && m[0].startsWith('When')
      && READ_TAIL.test(flat.slice(m.index + m[0].length));
    if (!bold) fail(file, 'C11 read line', `line ${line}: not "**When <condition>, read [<file>](<path>).**": ${m[0]}`);
    if (!/^https?:/.test(link) && !existsSync(resolve(dirname(path), link))) fail(file, 'C11 read line', `line ${line}: ${link} does not exist`);
  }
}

// C12: one heading set per kind.
for (const kind of KINDS) {
  const paths = kind.map((f) => join(ROOT, f));
  if (!kind.some((f) => targets.includes(f)) || !paths.every(existsSync)) continue;
  const sets = paths.map((p) => headings2(readFileSync(p, 'utf8')));
  kind.forEach((f, i) => {
    if (!targets.includes(f)) return;
    kind.forEach((other, j) => {
      if (i !== j) for (const h of sets[j]) if (!sets[i].includes(h)) fail(f, 'C12 heading set', `"${h}" is in ${other} but not here`);
    });
  });
}

// C13: no private information. With no arguments: the published .md files listed above.
// With arguments: the named skill files only.
const mdUnder = (dir) => (existsSync(dir)
  ? readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.md')).sort().map((f) => join(dir, f))
  : []);
const privateTargets = process.argv.length > 2
  ? targets.map((f) => join(ROOT, f)).filter(existsSync)
  : [...mdUnder(ROOT), ...mdUnder(SCENARIOS), ...mdUnder(RATIONALE),
    ...readdirSync(REPO_ROOT).filter((f) => f.endsWith('.md')).sort().map((f) => join(REPO_ROOT, f)),
    ...[join(REPO_ROOT, '.claude', 'ship-plan.md')].filter(existsSync)];
for (const path of privateTargets) {
  const inSkills = !relative(ROOT, path).startsWith('..');
  const inScenarios = !relative(SCENARIOS, path).startsWith('..');
  const inRationale = !relative(RATIONALE, path).startsWith('..');
  const file = inSkills ? relative(ROOT, path)
    : inScenarios ? `scenarios/${relative(SCENARIOS, path)}`
    : inRationale ? `rationale/${relative(RATIONALE, path)}` : relative(REPO_ROOT, path);
  const text = readFileSync(path, 'utf8');
  const prose = unfenced(text).split('\n');
  const hits = privateHits(text);
  fileHits.set(file, hits);
  if (privatePath(file)) fail(file, 'C13 private', 'file name (private text not shown)');
  text.split('\n').forEach((l, i) => {
    const bad = [...l.matchAll(ISSUE_KEY)].map((m) => m[0]).some((k) => !keyAllowed(k))
      || (inSkills && [...prose[i].matchAll(LOWER_KEY)].some((m) => !keyAllowed(m[0].toUpperCase())))
      || (inSkills && PR_NUMBER.test(prose[i]))
      || HOME_PATH.test(l);
    if (hits.has(i)) fail(file, 'C13 private', `line ${i + 1} (private text not shown)`);
    else if (bad) fail(file, 'C13 private', `line ${i + 1}: ${l.trim()}`);
  });
}

// C13, full run: every other tracked or untracked-but-not-ignored text file (scripts, tests,
// manifests) gets the private-pattern check only, on its name and content; their fixtures hold
// fictional keys and paths the .md checks above would refuse.
const scanned = new Set(privateTargets);
const tracked = process.argv.length > 2 || !privatePatterns.length ? null
  : spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: REPO_ROOT, encoding: 'utf8' });
for (const f of tracked?.status === 0 ? tracked.stdout.split('\0').filter(Boolean) : []) {
  const path = join(REPO_ROOT, f);
  if (scanned.has(path) || !existsSync(path)) continue;
  if (privatePath(f)) fail(f, 'C13 private', 'file name (private text not shown)');
  const text = readFileSync(path, 'utf8');
  if (text.includes('\0')) continue;
  scanned.add(path);
  for (const i of privateHits(text)) fail(f, 'C13 private', `line ${i + 1} (private text not shown)`);
}
const checked = new Set([...targets.map((f) => join(ROOT, f)), ...scanned]);
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log(`ok: ${checked.size} file(s) (C4: ${C4_PRIVATE
  ? `${privatePatterns.length} private pattern(s) from ${PRIVATE_FROM}`
  : 'no private patterns loaded, staging host names only'})`);
