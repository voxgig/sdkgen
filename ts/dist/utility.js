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
exports.resolveAuthIn = resolveAuthIn;
exports.resolveAuthName = resolveAuthName;
exports.isAuthSuppressed = isAuthSuppressed;
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
const pointPath_1 = require("./helpers/pointPath");
const packageMeta_1 = require("./helpers/packageMeta");
function resolvePath(ctx$, path) {
    const base = null == ctx$.cmpfolder ? ctx$.folder : ctx$.cmpfolder;
    const fullpath = node_path_1.default.join(base, '.sdk', 'dist', path);
    return fullpath;
}
function isAuthActive(model) {
    const auth = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.config.auth`, { only_active: false, required: false });
    if (null != auth && 'boolean' === typeof auth.active)
        return auth.active;
    const info = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.info`, { only_active: false, required: false });
    return !(info && false === info.auth);
}
function resolveAuthPrefix(model) {
    const auth = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.config.auth`, { only_active: false, required: false });
    if (null != auth && null != auth.prefix)
        return String(auth.prefix);
    const security = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.info.security`, { only_active: false, required: false });
    if (null != security && null != security.prefix)
        return String(security.prefix);
    return 'Bearer';
}
function isAuthSuppressed(model) {
    const auth = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.config.auth`, { only_active: false, required: false });
    return null != auth && false === auth.active;
}
function resolveAuthIn(model) {
    const auth = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.config.auth`, { only_active: false, required: false });
    if (null != auth && null != auth.in && '' !== auth.in) {
        return String(auth.in).toLowerCase();
    }
    const security = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.info.security`, { only_active: false, required: false });
    if (null != security && null != security.in && '' !== security.in) {
        return String(security.in).toLowerCase();
    }
    return 'header';
}
function resolveAuthName(model) {
    const auth = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.config.auth`, { only_active: false, required: false });
    if (null != auth && null != auth.name && '' !== auth.name) {
        return String(auth.name);
    }
    const security = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.info.security`, { only_active: false, required: false });
    if (null != security && null != security.name && '' !== security.name) {
        return String(security.name);
    }
    return 'Authorization';
}
function isHttpBasicAuth(model) {
    const auth = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.config.auth`, { only_active: false, required: false });
    if (null != auth && null != auth.basic)
        return Boolean(auth.basic);
    const security = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.info.security`, { only_active: false, required: false });
    return null != security && 'http' === security.type &&
        'basic' === String(security.prefix || '').toLowerCase();
}
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
const CONFIG_DATA_THRESHOLD = 256 * 1024;
exports.CONFIG_DATA_THRESHOLD = CONFIG_DATA_THRESHOLD;
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
function withPointParts(op) {
    if (null == op) {
        return op;
    }
    const out = {};
    (0, jostraca_1.each)(op, (o, opname) => {
        out[opname] = null == o || null == o.points ? o : {
            ...o,
            points: (0, jostraca_1.each)(o.points).map((pt) => {
                if (null == pt)
                    return pt;
                // Contracts feed test generation directly from the model. Keeping
                // them in every runtime entity also retains entire request/response
                // schemas in clones and debug output, exhausting large SDKs' memory.
                const { contract, ...runtimePoint } = pt;
                return { ...runtimePoint, parts: (0, pointPath_1.pointParts)(pt) };
            }),
        };
    });
    return out;
}
function configDefinition(model, targetname) {
    const entity = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.entity`);
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
            id: e.id,
            name: e.name,
            op: withPointParts(e.op),
            relations: e.relations,
        }, true);
        entityStubs[e.name] = {};
    });
    const featureDefs = {};
    (0, jostraca_1.each)(feature, (f) => {
        const fdef = { ...(f.config || {}) };
        if (null != f.transport && '' !== f.transport) {
            fdef.transport = String(f.transport);
        }
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