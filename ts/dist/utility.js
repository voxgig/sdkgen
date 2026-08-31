"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG_REPR_VALUES = exports.CONFIG_DATA_THRESHOLD = exports.SdkGenError = void 0;
exports.resolvePath = resolvePath;
exports.requirePath = requirePath;
exports.isAuthActive = isAuthActive;
exports.resolveAuthPrefix = resolveAuthPrefix;
exports.resolveAuthExchange = resolveAuthExchange;
exports.isHttpBasicAuth = isHttpBasicAuth;
exports.isConfigData = isConfigData;
exports.configRepr = configRepr;
exports.configReprSetting = configReprSetting;
exports.configDefinition = configDefinition;
exports.clean = clean;
exports.rawStringLiteral = rawStringLiteral;
const node_path_1 = __importDefault(require("node:path"));
const jostraca_1 = require("jostraca");
const apidef_1 = require("@voxgig/apidef");
const applicability_1 = require("./helpers/applicability");
const serverVars_1 = require("./helpers/serverVars");
const packageMeta_1 = require("./helpers/packageMeta");
// Where a per-target component is loaded from: `<project>/.sdk/dist/<path>`.
//
// `ctx$.folder` is jostraca's OUTPUT folder, which is the project for an
// ordinary target but the destination repo for one generating out of tree
// (`output: path`). Components always live in the project that owns the
// model, never in the place its files land, so an external pass sets
// `ctx$.cmpfolder` and this prefers it. Without that, generating out of tree
// looks for `<destination>/.sdk/dist/cmp/...` and fails to resolve.
function resolvePath(ctx$, path) {
    const base = null == ctx$.cmpfolder ? ctx$.folder : ctx$.cmpfolder;
    const fullpath = node_path_1.default.join(base, '.sdk', 'dist', path);
    return fullpath;
}
// True unless the model declares auth off. Templates use this to gate
// apikey-related code, docs, and examples for public APIs that need no
// authentication. Two opt-outs, in priority order:
//   1. main.kit.info.auth: false        (user-facing, set in api-info.aon)
//   2. main.kit.config.auth.active: false
function isAuthActive(model) {
    const info = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.info`, { only_active: false, required: false });
    if (info && false === info.auth)
        return false;
    const auth = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.config.auth`, { only_active: false, required: false });
    return null == auth || false !== auth.active;
}
// The credential prefix for the Authorization header value, resolved in
// priority order:
//   1. main.kit.config.auth.prefix   (per-SDK user override)
//   2. main.kit.info.security.prefix (spec-derived, set by apidef from the
//      API's securityScheme — e.g. 'OAuth' for Statuspage)
//   3. 'Bearer'                      (conventional fallback)
// '' is a valid resolved value: it means a raw credential with no prefix
// (e.g. an apiKey scheme in a custom header). Config generators for every
// language target must use this instead of hardcoding 'Bearer'.
function resolveAuthPrefix(model) {
    const auth = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.config.auth`, { only_active: false, required: false });
    if (null != auth && null != auth.prefix)
        return String(auth.prefix);
    const security = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.info.security`, { only_active: false, required: false });
    if (null != security && null != security.prefix)
        return String(security.prefix);
    return 'Bearer';
}
// True when the spec's security scheme is genuine HTTP Basic Auth (two
// credentials, base64-joined) rather than a single bearer-style token with
// a prefix. Priority order mirrors resolveAuthPrefix:
//   1. main.kit.config.auth.basic     (per-SDK user override)
//   2. main.kit.info.security, spec-derived: type 'http' + a 'basic' prefix
//      (apidef sets prefix from the OpenAPI `scheme: basic` value, title-cased)
function isHttpBasicAuth(model) {
    const auth = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.config.auth`, { only_active: false, required: false });
    if (null != auth && null != auth.basic)
        return Boolean(auth.basic);
    const security = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.info.security`, { only_active: false, required: false });
    return null != security && 'http' === security.type &&
        'basic' === String(security.prefix || '').toLowerCase();
}
// The API's ACCESS-TOKEN EXCHANGE, as apidef recorded it from the spec
// (main.kit.info.security.exchange): where the token endpoint lives, and the
// field names it sends and answers with. Null when the spec describes none,
// which is the common case.
//
// These are FACTS ABOUT THE API, so they belong in the generated config
// rather than in a project's hand-written model: an SDK whose spec says the
// exchange is at `auth/token` should not need to be told so again. A feature
// opts in to receiving them with `spec: { authexchange: '<options-key>' }`;
// configDefinition does the overlay.
//
// Deliberately NOT included: `active`. Whether a client performs the
// exchange is the project's decision (some resolve a static credential
// through the same feature on an API that also has a token endpoint), so
// apidef records only what the exchange IS, never that it should run.
function resolveAuthExchange(model) {
    const security = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.info.security`, { only_active: false, required: false });
    const exchange = security?.exchange;
    if (null == exchange || 'object' !== typeof exchange) {
        return null;
    }
    return exchange;
}
function requirePath(ctx$, path, flags) {
    const fullpath = resolvePath(ctx$, path);
    const ignore = null == flags?.ignore ? false : flags.ignore;
    // When `ignore` is set, only swallow a genuine "module not found"
    // resolution failure. A module that resolves but throws while loading
    // (syntax error, runtime bug, or a missing *nested* dependency) must
    // propagate — otherwise the optional component silently renders nothing
    // and the real failure is invisible.
    if (ignore) {
        try {
            require.resolve(fullpath);
        }
        catch (err) {
            ctx$.log.warn({ point: 'require-missing', path, note: path });
            return undefined;
        }
    }
    return require(fullpath);
}
class SdkGenError extends Error {
    constructor(...args) {
        super(...args);
        this.name = 'SdkGenError';
    }
}
exports.SdkGenError = SdkGenError;
// CONFIG REPRESENTATION (design rung L1, threshold from design Q7).
//
// Above a size threshold the API model is emitted as DATA - a JSON string
// constant parsed once - rather than as a composite literal. Below it the
// literal stays, because for a small model the literal is smaller, simpler,
// faster to load and far easier to debug, and a symbol table would be pure
// complexity.
//
// The threshold is on the JSON, not the emitted source, because the emitted
// source size varies by language while the model does not. It is measured in
// UTF-8 BYTES rather than string length: `.length` counts UTF-16 code units,
// so a CJK-heavy model would read as roughly a third of its real size and
// stay on the expensive literal path well past the point where it hurts.
//
// Measured on the real gitlab model (923.5 KB of JSON), Go, cold cache,
// recompiling only the config package:
//
//                       composite literal   JSON string constant
//   compile+link wall        30.80 s              0.34 s     91x faster
//   peak compiler RSS         2.49 GB             0.06 GB    39x less
//   binary                    7.44 MB             3.51 MB    2.1x smaller
//
// The reader side is unchanged either way: make_config returns the same map,
// so nothing downstream can tell which representation it got.
//
// For two targets the literal is not merely expensive but IMPOSSIBLE past a
// point, which is what fixes the threshold rather than leaving it a taste
// question:
//
//   haskell  GHC 9.4.7 refuses a large static structure outright -
//            "sorry! (unimplemented feature or known bug) ... Trying to
//            allocate more than 129024 bytes ... Suggestion: read data from a
//            file instead of having large static data structures in code"
//            (GHC issue 4505). Measured: the CV literal compiles at 828 KB of
//            model and fails at 1.4 MB, so 256 KB clears it by more than 3x.
//
//   clojure  a string literal is a constant-pool UTF-8 entry capped at 65,535
//            bytes, so the DATA constant has to be chunked - see cljStringChunks.
//
// Anything above the threshold therefore takes the data path in every target,
// and the languages with a hard ceiling are the ones with the most margin.
const CONFIG_DATA_THRESHOLD = 256 * 1024;
exports.CONFIG_DATA_THRESHOLD = CONFIG_DATA_THRESHOLD;
// Should this model be emitted as data rather than as a literal?
//
// `repr` is the per-SDK override from `main.kit.config.repr`: 'auto' (the
// default) decides by size, 'data' and 'literal' pin it. The override is what
// lets a small fixture exercise the data path - by size alone no test model
// comes near the threshold, so the branch every large SDK depends on would
// never be generated, compiled or run in CI.
const CONFIG_REPR_VALUES = ['auto', 'data', 'literal'];
exports.CONFIG_REPR_VALUES = CONFIG_REPR_VALUES;
function isConfigData(configJson, repr) {
    // An unknown value is REJECTED, not ignored. The aontu declaration
    // documents the closed set but does not enforce it here, and silently
    // treating `repr: 'date'` as `auto` would quietly restore the compile cost
    // this exists to remove - the failure mode being a slow build nobody
    // connects to a typo.
    if (null != repr && '' !== repr && !CONFIG_REPR_VALUES.includes(repr)) {
        throw new SdkGenError('sdkgen: main.kit.config.repr must be one of ' +
            CONFIG_REPR_VALUES.join(', ') + ' (got: ' + repr + ')', {});
    }
    if ('data' === repr) {
        return true;
    }
    if ('literal' === repr) {
        return false;
    }
    return CONFIG_DATA_THRESHOLD < Buffer.byteLength(configJson, 'utf8');
}
// The chosen representation, as a word - for generation logs and for the
// per-SDK reporting the fleet regen needs, so a model crossing the threshold
// is visible rather than showing up as an unexplained whole-file diff.
function configRepr(configJson, repr) {
    return isConfigData(configJson, repr) ? 'data' : 'literal';
}
// The per-SDK override, or 'auto'. `main.kit.config.repr` is optional, and
// getModelPath throws rather than returning undefined for an absent path.
function configReprSetting(model) {
    try {
        return (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.config.repr`) || 'auto';
    }
    catch (_e) {
        return 'auto';
    }
}
// L0 NORMALISATION: strip what the emitted config must not carry.
//
// Three kinds of noise, and the distinction between them matters:
//
//   MODEL_META      jostraca's `each` injects index$/key$/val$ into every node
//                   it iterates. Pure bookkeeping, and it leaked into every
//                   generated SDK for years (5,231 occurrences in gitlab
//                   alone) because this helper deleted keys during a walk that
//                   assigned them straight back.
//
//   CONFIG_DEFAULT  a key whose value equals the default the reader already
//                   applies. Emitting it is pure bulk. Only these three names
//                   are dropped, and only at their default value - `entity$`
//                   is real Seneca data, so no blanket suffix rule.
//
//   PAYLOAD_KEYS    the boundary. Under `default`/`example`/`examples` the
//                   value is API DATA, not config, and an example that happens
//                   to contain `active: true` must survive intact. Below one of
//                   these keys default-dropping stops; metadata stripping does
//                   not, because jostraca's bookkeeping is never payload.
const MODEL_META = ['index$', 'key$', 'val$'];
const CONFIG_DEFAULT = {
    active: true,
    req: false,
    reqd: false,
};
const PAYLOAD_KEYS = ['default', 'example', 'examples'];
function clean(o, dropDefaults) {
    // Rebuild rather than delete in place: the caller's model is shared with
    // every other component, and mutating it here would strip metadata a later
    // target still needs.
    const prune = (node, defaults) => {
        if (Array.isArray(node))
            return node.map((n) => prune(n, defaults));
        if (null != node && 'object' === typeof node) {
            const out = {};
            for (const k of Object.keys(node)) {
                if (MODEL_META.includes(k))
                    continue;
                // An ABSENT optional member, dropped rather than carried as undefined.
                //
                // Callers build `{fields, name, op, relations}` from an entity, and
                // `op` and `relations` are optional - so the key exists with value
                // undefined. JSON.stringify silently omits such a key, while the
                // literal formatters emit it as None/nil/null, and the two
                // representations would describe different configs for any entity
                // without an `op`. Dropping it here fixes both branches at once,
                // because both reach the emitter through this function.
                if (undefined === node[k])
                    continue;
                if (defaults && k in CONFIG_DEFAULT && CONFIG_DEFAULT[k] === node[k])
                    continue;
                out[k] = prune(node[k], defaults && !PAYLOAD_KEYS.includes(k));
            }
            return out;
        }
        return node;
    };
    return prune(o, true === dropDefaults);
}
// The JSON as a source-level string literal, for a language whose SINGLE
// quoted literal neither interpolates nor processes escapes beyond the quote
// and the backslash - Ruby, PHP, Perl, Lua.
//
// Reproducing the JSON text VERBATIM is all that is needed, because the JSON
// already encodes control characters and non-ASCII itself. That is why this is
// preferred over the double-quoted form in those languages: Ruby and PHP
// interpolate (`#{...}`, `$var`) and Lua does not understand `\uXXXX` at all,
// so a double-quoted literal would need a language-specific escape table and
// would get it wrong for exactly the inputs nobody tests.
function rawStringLiteral(s) {
    return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}
// The closed vocabulary of spec-derived facts a feature may ask for by
// declaring `spec: { <fact>: <options-key> }`. Closed, and resolved through
// one function each, so a feature cannot reach arbitrarily into the model
// and a fact's shape is defined in exactly one place.
const SPEC_FACTS = {
    authexchange: resolveAuthExchange,
};
// THE CANONICAL CONFIG OBJECT, and the JSON the threshold is measured on.
//
// Every target builds its config from this one function, so the literal a
// target emits and the data that replaces it above the threshold cannot
// describe different configs - which is the entire promise of rung L1. Before
// this existed each target assembled its own, and they had already drifted:
// `feature.<name>` came out as `{}` in Go and as nothing at all in ts when a
// feature declared no config.
//
// Key order is `each`'s order, which is sorted, so the JSON is byte-stable
// across runs exactly like the literal it replaces.
function configDefinition(model, targetname) {
    const entity = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.entity`);
    // Gated by the target when one is named, so the embedded config cannot
    // advertise a feature this target has no implementation for — the exact
    // hybrid state the applicability gate exists to prevent. With no
    // targetname (a caller that cannot say which target it is building) the
    // helper returns every active feature, i.e. the old behaviour.
    const feature = (0, applicability_1.targetFeatures)(model, targetname);
    const headers = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.config.headers`) || {};
    const authActive = isAuthActive(model);
    const authPrefix = resolveAuthPrefix(model);
    const authBasic = isHttpBasicAuth(model);
    let baseUrl = '';
    try {
        baseUrl = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.info.servers.0.url`);
    }
    catch (_e) { }
    const svars = (0, serverVars_1.serverVariables)(model);
    const entityDefs = {};
    const entityStubs = {};
    (0, jostraca_1.each)(entity, (e) => {
        entityDefs[e.name] = clean({
            fields: e.fields,
            name: e.name,
            op: e.op,
            relations: e.relations,
        }, true);
        entityStubs[e.name] = {};
    });
    const featureDefs = {};
    (0, jostraca_1.each)(feature, (f) => {
        // The feature's declared config (its `options` key set with typed
        // defaults) PLUS its transport role (station design §8.4): 'base'
        // replaces the transport slot, 'wrap' wraps it, 'none' is hook-only.
        // Station's descriptor (normalizeDescriptor in voxgig/station) reads
        // `transport` beside `options` to validate the resolved feature order.
        // The role is DECLARED in the feature model, never inferred - an empty
        // `hook: {}` is wrong for station, which both wraps and dispatches
        // hooks. Additive: a model unified without the schema's `transport`
        // default simply omits the key, which station tolerates by degrading
        // its role checks to nothing.
        const fdef = { ...(f.config || {}) };
        if (null != f.transport && '' !== f.transport) {
            fdef.transport = String(f.transport);
        }
        // SPEC-DERIVED OPTIONS. A feature declares `spec: { <fact>: <options
        // key> }` to receive facts apidef recorded from the OpenAPI spec — the
        // same declare-never-infer rule `needs` and `transport` follow, and for
        // the same reason: the alternative is this function knowing feature
        // names, which is exactly the coupling the generic feature loop exists
        // to avoid.
        //
        // The fact overlays the feature's DECLARED DEFAULTS, and rightly: a
        // default like `path: 'auth/token'` is a generic guess, while the spec
        // states where this API's endpoint actually is. A project that needs
        // something else still overrides at runtime through `options.feature`,
        // which beats the embedded config either way.
        for (const factname of Object.keys(f.spec || {}).sort()) {
            const optkey = f.spec[factname];
            const fact = SPEC_FACTS[factname]?.(model);
            if (null == fact || null == optkey || '' === optkey) {
                continue;
            }
            fdef.options = { ...(fdef.options || {}) };
            fdef.options[optkey] = { ...(fdef.options[optkey] || {}), ...fact };
        }
        featureDefs[f.name] = fdef;
    });
    const options = { base: baseUrl };
    if (0 < svars.length) {
        options.server = svars.reduce((a, v) => (a[v.name] = v.dflt, a), {});
    }
    if (authActive) {
        options.auth = authBasic ? { prefix: authPrefix, basic: true } : { prefix: authPrefix };
    }
    options.headers = headers;
    options.entity = entityStubs;
    // Identity beyond the camel Name: the hyphenated slug is CARRIED, never
    // derived from the camel form downstream (deriving swallows hyphens - the
    // packageMeta envToken defect), and version/target let a running SDK say
    // what it is. Station's descriptor (voxgig/station) reads all three.
    // Gated on targetname so a target that does not pass its name emits the
    // exact config it always has - each target opts in when its literal
    // emitter learns the fields too, keeping data and literal reps in step.
    const main = { name: model.const.Name };
    if (null != targetname) {
        main.slug = model.name;
        main.version = (0, packageMeta_1.packageVersion)(model, targetname);
        main.target = targetname;
    }
    const def = {
        main,
        feature: featureDefs,
        options,
        entity: entityDefs,
    };
    return { def, json: JSON.stringify(def) };
}
//# sourceMappingURL=utility.js.map