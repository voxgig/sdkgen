# How to use voxgig/station with a generated SDK

[voxgig/station](https://github.com/voxgig/station) is the runtime
companion: every generated SDK an application uses registers with a
local `Station` as a plugin, and station becomes the one place outbound
integrations are configured, credentialed, and observed. The full
design lives in the station repo —
[docs/design/station.md](https://github.com/voxgig/station/blob/main/docs/design/station.md)
and, for the declarative config this page leads with,
[docs/design/station-declarative-config.md](https://github.com/voxgig/station/blob/main/docs/design/station-declarative-config.md)
— this page is the install flow and the two ways to bind.

## Add the station feature to an SDK project

The feature ships as an sdkgen package, `@voxgig/sdkgen-station`:

```bash
cd my-sdk/.sdk
npm install --save-dev @voxgig/sdkgen-station
voxgig-sdkgen package add @voxgig/sdkgen-station
npm run generate
```

The npm install comes first because `package add` resolves from
`.sdk/node_modules` and deliberately does not fetch (only
`package update` shells out to npm). The add installs the declared
station feature — no separate `add-feature` step — and the next
generate emits the per-target adapter plus the station library
dependency in each generated manifest.

The feature is present but **off by default**
(`feature.station.active: false` in the generated config); a project
that does nothing gets exactly the SDK it had before.

## Declare instances in `station.json` (the leading form)

The application — the consumer of the generated SDK — declares its
integrations in a `station.json` at its repo root. Committable: it
holds names and stores, never values.

```json
{ "station": 1,
  "profiles": { "default": {
    "sdk": { "voxgig-solardemo": {} } } } }
```

```ts
import { Station } from '@voxgig/station'

const station = Station.open()                 // reads + validates station.json
const solar = station.sdk('voxgig-solardemo')  // built on first ask, cached
```

`open()` validates the whole file at once — a typo'd key fails there,
with every error reported — and constructs nothing. The instance is
built lazily on the first `sdk()` call, through a process-global
factory table filled three ways: a generated SDK **self-registers** its
`{construct, config}` pair at module init (ts/js today; any language
with a module-init hook that actually runs), `Station.provide(api,
factory)` is the one-line explicit form for everything else, and in
dynamic languages the loader imports a declared `package` on demand.
Note what the application code no longer contains: no SDK import, no
constructor, no credential.

The `sdk` map is keyed by **ref** — `api$tag`, where an untagged ref
*is* the api slug (the SDK model's hyphenated `name`). A second
instance of one API is one more key:

```json
"sdk": {
  "voxgig-solardemo":      {},
  "voxgig-solardemo$test": { "base": "https://api.solar.test" }
}
```

The secret name derives from the **instance** name — instance token
lowercased plus `.apikey`, so `voxgig-solardemo` reads
`VOXGIG_SOLARDEMO_APIKEY` (the env var the generated README already
documents, unchanged) and `voxgig-solardemo$test` reads
`VOXGIG_SOLARDEMO_TEST_APIKEY`. Pin a name instead with `secret` on
the instance, or at the api level for a shared key.

SDK features are configured in the same file — fleet-wide
(profile-level `feature`), per api, or per instance — rather than per
call site; the option keys are validated against the schema each
feature model declares (this is what `configDefinition`'s embedded
feature options and `transport` roles exist for). And `station.check()`
resolves and constructs every active instance without sending a
request, so a typo'd package name or feature option is a CI failure
rather than a 3am one.

## Bind imperatively: `connect()` and `adopt()`

The declarative form is the leading one; the two-line imperative form
is the retrofit path for an existing application, needs no
`station.json` at all, and stays fully supported:

```ts
import { Station } from '@voxgig/station'
import { SolardemoSDK } from '@voxgig/solardemo-sdk'

const station = Station.open()               // profile/env/proxy all defaulted
const solar = station.connect(SolardemoSDK)  // was: new SolardemoSDK({ apikey: … })
```

With no `station.json` and no proxy, this runs solo: the secret is
resolved by [sekreto](https://github.com/voxgig/sekreto)'s default
env-provider chain under the SDK's documented env var
(`<SLUG>_APIKEY`), the credential leaves `options()`/`prepare()`
output, and `station.tap(console.log)` shows live traffic.
`connect(SDK, { as: 'test' })` binds a second, tagged instance —
`as` is a tag, so the ref is `<slug>$test`, same as the declarative
key.

Languages where passing a class is not idiomatic use inverted binding —
the SDK's own constructor with station-built options:

```go
st := station.Open()
solar := solardemo.NewSolardemoSDK(st.Options())
```

Retrofitting an SDK generated before the feature existed:
`station.adopt(SDK, opts)` constructs the client with the library's
carried adapter; regenerate with the feature to graduate to the
generated path.

## Profiles

Profiles live in the same `station.json`: per-profile secret chains
(`secrets.providers`, sekreto's own spec form, passed through
untouched), and overlays that adjust instances rather than redeclare
them — `"sdk": { "voxgig-solardemo$test": { "active": false } }` in a
`prod` profile switches the test instance off with one key.
`VOXGIG_STATION_PROFILE=prod` or `Station.open({ profile: 'prod' })`
selects a profile.

## Errors

Station error codes follow the SDK house grammar and live in one
catalog: [station error codes](../reference/station-errors.md).
