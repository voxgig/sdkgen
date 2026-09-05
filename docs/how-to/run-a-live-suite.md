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

## Strict mode

`main.kit.test.live.strict` decides what a live non-2xx means.

The default is lenient, and right for a fleet SDK generated against an
arbitrary third-party API: synthetic ids 4xx constantly and list-response
shapes vary wildly, so a non-2xx is an early return rather than a failure —
asserting would mean permanent red.

Set it true when the project OWNS the server it tests against:

```aontu
main: kit: test: live: strict: true
```

A live run then FAILS on a non-2xx, which is the point: without it a suite
passes with nothing listening on the port. What strict mode does not do is
assert the mock transport's own fixtures against a live server — the scripted ids and
recorded calls belong to the mock transport and exist only offline.

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
