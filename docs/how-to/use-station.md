# How to use voxgig/station with a generated SDK

[voxgig/station](https://github.com/voxgig/station) is the runtime
companion: every generated SDK an application uses registers with a
local `Station` as a plugin, and station becomes the one place outbound
integrations are configured, credentialed, and observed. The full
design lives in the station repo
([docs/design/station.md](https://github.com/voxgig/station/blob/main/docs/design/station.md));
this page is the install flow.

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

## Use it from application code

Two lines, in every first-wave language:

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

`station.json` (committable — names and stores, never values) selects
per-profile secret chains and per-plugin config; see the design's §11
for the shape. `VOXGIG_STATION_PROFILE=prod` or
`Station.open({ profile: 'prod' })` selects a profile.

## Errors

Station error codes follow the SDK house grammar and live in one
catalog: [station error codes](../reference/station-errors.md).
