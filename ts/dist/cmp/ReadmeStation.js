"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeStation = void 0;
const jostraca_1 = require("jostraca");
const types_1 = require("../types");
const packageMeta_1 = require("../helpers/packageMeta");
// The "Use with Station" README section (station design §9.4): rendered
// ONLY when the project's model carries the station feature (installed
// via `package add @voxgig/sdkgen-station`) — a project without it sees
// nothing. Leads with the DECLARATIVE flow — a `station.json` block and
// `station.sdk()` (declarative design §11 item 3) — keeps the imperative
// `connect()` form as the retrofit path, and documents the
// instance-derived secret/env-var name (declarative design §3.4, §5.1:
// the same envtoken grammar as sdkgen's envName, applied to the INSTANCE
// name, so the untagged instance keeps the env var this README already
// documents to the byte). Store configuration is sekreto's
// documentation, deliberately not restated here (one canonical source);
// the error codes live in sdkgen's one catalog page, linked rather than
// restated for the same reason.
// Targets where station.connect(SDK) is the idiomatic binding; everything
// else uses inverted binding through the SDK's own constructor.
const CONNECT_TARGETS = ['ts', 'js', 'py', 'rb', 'php', 'lua', 'perl'];
// Targets whose module system has an init hook that actually runs
// (station design §6.2 path 1): there, linking the generated package
// fills the process-global factory table and `station.sdk()` needs no
// application code. Everywhere else the README must say
// `Station.provide` (path 2) plainly rather than imply an import is
// enough — a Java import is a compile-time alias that runs nothing.
const SELF_REGISTER_TARGETS = ['ts', 'js', 'go', 'py', 'rb', 'php', 'lua', 'perl', 'elixir', 'clojure'];
const ERROR_CATALOG_URL = 'https://github.com/voxgig/sdkgen/blob/main/docs/reference/station-errors.md';
const ReadmeStation = (0, jostraca_1.cmp)(function ReadmeStation(props) {
    const { target } = props;
    const { model } = props.ctx$;
    const features = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.feature`, { only_active: false, required: false }) || {};
    const station = Object.values(features)
        .find((f) => 'station' === f?.name);
    if (null == station) {
        return;
    }
    // The descriptor slug is the model's hyphenated name (carried as
    // main.slug in the embedded config); an untagged instance ref IS the
    // slug, so this is also the default instance name.
    const slug = model.name;
    const env = (0, packageMeta_1.envName)(model);
    const secretbase = env.toLowerCase();
    const secretname = secretbase + '.apikey';
    const connect = CONNECT_TARGETS.includes(target.name);
    const selfreg = SELF_REGISTER_TARGETS.includes(target.name);
    (0, jostraca_1.Content)(`
## Use with Station

This SDK ships as a [voxgig/station](https://github.com/voxgig/station)
plugin: bind it to a local \`Station\` and outbound configuration,
credentials, and observability move to one place. The feature is
present but **off by default** — nothing changes until you bind.

### Declarative: \`station.json\` + \`station.sdk()\`

Declare an instance in \`station.json\` at the repo root (committable —
names and stores, never values):

\`\`\`json
{ "station": 1,
  "profiles": { "default": {
    "sdk": { "${slug}": {${selfreg ?
        `\n      "package": "${(0, packageMeta_1.packageName)(model, target.name)}"` : ''} } } } } }
\`\`\`

Then get the client where you need it:

1. \`station = Station.open()\` — reads and validates \`station.json\`;
   constructs nothing.
2. \`client = station.sdk('${slug}')\` — built on first ask and cached,
   so the same name returns the same client.

${selfreg
        ? `Loading this package is the whole bootstrap: it registers its own
factory (constructor plus embedded config) with the station library at
module init, so \`station.sdk()\` needs no SDK import in application
code. That is what the \`package\` key above is for — it names the module
for station to load, since nothing else in this example would execute
it. An application that imports this SDK for its types anyway can drop
the key: that import is itself the bootstrap.`
        : `In this language an import runs no code, so register the factory
once at startup — \`Station.provide('${slug}', ...)\`, one line — and
every other line of configuration stays in \`station.json\`.`}

A second instance of the same API is one more key — \`"${slug}$test"\`
beside \`"${slug}"\` — and \`station.sdk('${slug}$test')\` returns it.
SDK features are configured in the same file too: fleet-wide, per api,
or per instance. \`station.check()\` resolves and constructs every
active instance without sending a request — run it in CI.

### The secret name derives from the instance

The credential comes from [sekreto](https://github.com/voxgig/sekreto)
under a name derived from the **instance** name — the instance token
lowercased, plus \`.apikey\`. The untagged instance \`${slug}\` derives
\`${secretname}\` — by default the \`${env}_APIKEY\` environment
variable this README already documents, unchanged. A tagged instance
derives its own: \`${slug}$test\` → \`${secretbase}_test.apikey\` →
\`${env}_TEST_APIKEY\` — each instance is a separate credentialed use
of the API, and its env var is derivable from the name you chose. To
pin a name instead, set \`secret\` on the instance block, or at the
api level for several instances sharing one key. Point a profile at a
vault later and application code does not change; sekreto's own
documentation covers the stores. The key stays out of \`options()\` and
\`prepare()\` output; \`station.tap(...)\` shows live traffic.

### Imperative: ${connect ? '`connect()`' : 'inverted binding'} — the retrofit path

${connect
        ? `Bind by passing the SDK class to the station:

1. \`station = Station.open()\` — profile, env, and proxy all defaulted.
2. \`client = station.connect(${model.const.Name}SDK)\` — replaces direct
   construction; \`connect(${model.const.Name}SDK, { as: 'test' })\` binds
   a second, tagged instance.`
        : `Bind through the constructor this SDK already has (inverted
binding): open a station, then construct with station-built options —
\`station.options()\` merges the handle, the activation entry, and the
correct feature order into the plain options the constructor accepts.`}

With no \`station.json\` at all this runs solo with everything
defaulted — the two-line form is how an existing application starts.

Station failures surface through this SDK's own error path
(\`err.code\`, \`station_*\`); the codes are catalogued in
[station error codes](${ERROR_CATALOG_URL}).
`);
});
exports.ReadmeStation = ReadmeStation;
//# sourceMappingURL=ReadmeStation.js.map