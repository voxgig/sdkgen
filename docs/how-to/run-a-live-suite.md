# How to run a generated SDK's live suite

Every generated target ships two suites in one: the same tests run against an
in-process mock by default, and against the real API when
`<PROJ>_TEST_LIVE=TRUE`. This is what a live run needs to be told, and where
each piece belongs.

## The three inputs

| Input | Where it comes from | Why not somewhere else |
| --- | --- | --- |
| **Credential** | `<PROJ>_APIKEY` (and `<PROJ>_SECRET` for HTTP Basic) | A secret. It belongs in the environment, never in the repo. |
| **Server variables** | `<PROJ>_SERVER_<NAME>` | Not a secret, but per-run: a tenant or account id identifies *which* deployment this run points at. |
| **Everything else** | `test/sdk-test-control.json`, under `test.client.options` | Configuration: it describes the API, is the same on every run, and belongs in the repo next to the API it describes. |

```bash
ELEMENTDEMO_TEST_LIVE=TRUE \
ELEMENTDEMO_SERVER_ACCOUNT_ID=acc01 \
npm test
```

## Server variables

An OpenAPI spec may template its server URL:

```yaml
servers:
  - url: http://localhost:8902/api/{account_id}
    variables:
      account_id: { default: '' }
```

A variable with no usable default is REQUIRED: the SDK refuses to construct
rather than issue requests to a URL with a literal `{account_id}` in it. So a
live suite for such an API cannot run at all until it is given the values —
which is what `<PROJ>_SERVER_<NAME>` is for. `account_id` becomes
`<PROJ>_SERVER_ACCOUNT_ID`.

In MOCK mode nothing needs supplying: a required variable resolves to the
deterministic `test-<name>`, so the offline suite needs no configuration.

## Extra client options: `test.client.options`

The generated live client knows two things — the base URL, from the spec, and
the credential, from the environment. Everything else about how a particular
API wants to be talked to is a property of THAT API, known to the project and
to nothing in the toolchain.

The commonest case is an API that issues short-lived access tokens. The
credential in `<PROJ>_APIKEY` then expires mid-run, and the suite needs the
[`secrets`](../reference/features.md#secrets) feature's exchange turned on and
pointed at the token endpoint:

```json
{
  "version": 1,
  "test": {
    "client": {
      "options": {
        "feature": {
          "secrets": {
            "active": true,
            "name": "refresh_token",
            "providers": [{ "kind": "dotenv", "file": ".env" }, { "kind": "env" }],
            "exchange": { "active": true, "path": "auth/token" }
          }
        }
      }
    }
  }
}
```

These options are merged UNDER the generated fields, so the suite's own
`apikey` and `server` values still win: this block ADDS to the live client, it
does not redirect it. The credential itself is NOT in the file — the providers
it names read that from the environment or a gitignored `.env`.

## Target coverage

Twelve targets carry the full live wiring — credential, server variables and
`test.client.options`:

`ts`, `js`, `go`, `py`, `java`, `php`, `rb`, `lua`, `rust`, `dart`, `csharp`, `perl`

The rest generate the mock suite only: they have no live client to configure,
so those environment variables do nothing there. `ts/test/generate.test.ts`
pins that list, so a target gaining a live client without the wiring fails the
suite rather than shipping a live suite that cannot run.

## Outcomes and continued execution

Live request assertions are enabled by default in the TS and Go direct-test
generators through `main.kit.test.live.strict`. A failed request fails its test;
the test framework continues the other tests. Explicit `false` retains legacy
exploratory result handling for migration.

The TS and JS entity flow runners also continue independent operations within
a flow. A failed create blocks dependent writes, while independent reads still
run. A failed update does not prevent a later load or cleanup of the resource
created by that flow. An unavailable prerequisite is reported as blocked.

Entity flows print `LIVE STEP` outcomes and a `LIVE SUMMARY` containing planned,
attempted, passed, failed, blocked, and excluded counts. Request records contain
methods, paths, and HTTP statuses; response bodies and credentials are omitted.
The runner raises its final failure after the remaining operations and cleanup
have run. A flow that attempted no requests cannot report live success.

These execution changes do not supply valid API inputs automatically. The model,
fixtures, and configured identifiers still determine which requests can succeed.
Live assertions remain separate from the mock transport's synthetic identities.
`ts/test/livegenerated.test.ts` executes generated TS and JS suites against a
local HTTP server to check continuation, cleanup, and failure outcomes.

## `sdk-test-control.json` is write-once

Edit the copy under `<lang>/test/` — the one the test runner actually loads.
It is emitted **only when absent**, so `npm run generate` leaves an existing
file alone and your edits survive regeneration.

Do **not** edit the template master at `.sdk/tm/<lang>/test/sdk-test-control.json`.
That was the old workaround, from when `generate` overwrote the generated copy;
it is no longer needed and was never safe — `voxgig-sdkgen target add <lang>`
refreshes the master from the toolchain, and `voxgig-sdkgen doctor` reports the
edit as drift. If a project still carries that workaround, move the content to
`<lang>/test/sdk-test-control.json` and revert the master.

The trade-off of write-once is the usual one: a project that already has the
file will not pick up later changes to the toolchain's default. To take a fresh
default, delete `<lang>/test/sdk-test-control.json` and regenerate.

## See also

- [`features.md#secrets`](../reference/features.md#secrets) — the credential chain and the token exchange
- [`simulate-network.md`](./simulate-network.md) — offline failure injection

## Declarative operation scenarios

TS and JS also consume versioned point contracts produced by apidef. Add a
`live` entry under a guide path's operation to activate a consolidated
scenario suite. It includes every modelled point, records missing inputs as
blocked, and replaces duplicate live entity invocations while retaining the
offline tests. `npm run test:live` runs this same scenario suite separately.
Contracts are emitted into test inputs, not runtime client configuration, so
large request and response schemas do not inflate entity clones or debug output.

A live entry has an `id`, an `input` recipe, an authentication role
(`public`, `account`, or `issued`), and optional assertions. A recipe such as
`{ from: 'embedding', path: 'embeddings' }` binds a previous step's output.
A discovery recipe can select a row with `where` and require a matching row
with `related: { from, local, foreign, where }`. An issued credential uses
`credential: { from: 'key', path: 'key' }`; it is never included in reports.
Literal nested input objects and arrays are retained. Response contracts,
field equality, nonempty outputs, and vector count/dimension checks validate
the result. Unknown required inputs and unsupported constraints block work.

Declare `cleanup: true` for a modelled cleanup step and bind only resources
created by the run. Cleanup may use a published identity after an assertion
failure; ordinary dependants require their producer to pass. A `retention`
note records resources for which the API provides no deletion operation.
Requests have timeouts, retries are disabled for scenarios, and input
payloads are bounded. Control-file exclusions and pacing still apply.

Each target receives `live-coverage.json` when these recipes are present.
It declares whether the target executes them. The new scenario interpreter
supports TS and JS. Other targets, including the language pack, retain their
existing tests and report these scenarios as unsupported; those tests do
not establish equivalent operation coverage.

The Univec regression model exercises eight routes with public, account,
and issued credentials. Its conversion requests consume actual embedding
output and catalogue-selected dimensions. Generated TS and JS clients run
against loopback HTTP servers covering authentication errors, invalid
payloads and responses, rate limiting, disconnection, discovery failures,
and continued independent work. Existing CRUD and cleanup regressions run
alongside these scenarios.
