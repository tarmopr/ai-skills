# UI scenario testing in Chrome

Unit and integration tests prove the pieces. They do not prove that a person
clicking through the app gets the right result: suites pass and flows still
break in the UI. For any change a user can see or trigger, **you drive the
scenarios yourself** in Chrome, fix what breaks, and drive them again. Do not
hand the testing to the user.

## 1. Write the scenarios before opening the browser

In `.superpowers/verify-and-fix/<branch>/scenarios.md`, one row per scenario:

| # | Role | Steps | Expected (what the page shows, what the network returns) | Result |
|---|---|---|---|---|

Derive them from the issue's acceptance criteria and the spec, then add:

- **Every role the change touches**, from the config's `Roles:`. A role that bypasses checks (an admin) never stands in for an ordinary user.
- **The failure paths, not only the happy one:** refused (permission, limit reached), invalid input, the server erroring, a double click, a reload in the middle of a flow.
- **What must not happen:** a refused write that reads as saved, a raw error string, untranslated text, data from another tenant or account.
- **Every language the UI ships**, when the change adds text.
- **For multi-step flows**, such as a payment, then a callback, then a status: the final state after a reload, not only the toast.

## 2. Where to run

Run at the config's `## UI testing` `URL:`, after its `Started by:` is ready.
Follow its `Notes:` as part of every scenario: a preflight, test-mode values,
what cannot run at `URL:`, the languages, extra failure paths.

- **A local URL** (`localhost`, `127.0.0.1`): sign in yourself, only with test users from the config's `Sign-in:` source.
- **A hosted URL** (anything else): the user signs in, not you. A browser holds one session per origin, so test one role at a time. Give the user the whole role list, in order, up front, and ask them to sign in as the next role when you finish one. Reuse each session. Under `ship-plan`'s section 6b, the run never waits for a sign-in.
  A hosted URL is a shared environment: only read-only scenarios run there, unless the config's `## UI testing` says `Writes allowed: yes`. Without it, a scenario that creates, edits or deletes anything is reported as pending, not run.
- **`Hosted URL:`**, when set: a scenario that cannot run at `URL:` is **pending after merge**, and runs there after the merge under the hosted-URL rules above.
  - You sign in there yourself only when `## Allowed` has `Sign in on Hosted URL: test users` ([format](../ship-plan/config-format.md#-allowed)), and only with the `Sign-in:` source's users. Otherwise the user signs in.
  - If a tool or safety rule refuses that sign-in, try no other route: list the scenario under Not tested.

No `## UI testing` section: no scenarios. User-visible changes are reported as
not tested.

## 3. Drive each scenario

- Load all the browser tools in one ToolSearch call. Open a **new** tab (`tabs_create_mcp`), and close it when you finish.
- Judge by the DOM and the network, not by a screenshot alone. Read the page with `get_page_text` / `find`, read errors with `read_console_messages` (`onlyErrors: true`) and API responses with `read_network_requests` (`urlPattern`). A green toast over a 403 is a failed scenario.
- Record a GIF (`gif_creator`) of any multi-step flow that fails, and of the final passing run of each multi-step scenario. Give the file a meaningful name.
- Click through `find` refs or `javascript_tool` (`el.click()`). Screenshot coordinates can miss.
- Never trigger a native `alert` / `confirm`: it freezes the extension. If one comes up, stop and tell the user.
- Only no-op or throwaway writes on data you did not create. Test deletes on rows the scenario created itself. On a hosted URL, no writes at all unless `Writes allowed: yes` (section 2).

## 4. When a scenario fails

1. Find the root cause (superpowers:systematic-debugging): network response, console, then code.
2. Reproduce it as an automated test where one can see it (whatever test kind the repo's gates run), and watch that test fail.
3. Fix it, run the gates, then rerun the failing scenario and every scenario that shares its code path. These targeted reruns are for your own feedback while fixing.
4. Log it in `scenarios.md` and the ledger: the scenario, the cause, the test, the commit.

A scenario that cannot be automated, such as a scenario on a third-party
hosted page, keeps its manual repro steps in `scenarios.md`.

**The UI gate passes only after a full pass: every scenario in `scenarios.md`,
run in order, after the last fix of the round, and all of them Pass.** A fix made
after that pass means a new full pass.
