"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverVariables = serverVariables;
exports.hasServerVariables = hasServerVariables;
exports.serverVarEnv = serverVarEnv;
// Match {name} placeholders in a server URL template. OpenAPI variable
// names are restricted to word characters in practice; a brace group that
// is not a well-formed name is left untouched rather than guessed at.
const SERVER_VAR_RE = /\{([A-Za-z0-9_]+)\}/g;
function serverVariables(model) {
    const info = model?.main?.kit?.info || model?.main?.KIT?.info;
    const server = info?.servers?.[0];
    const url = server?.url || '';
    const declared = server?.variables || {};
    const out = [];
    const seen = new Set();
    SERVER_VAR_RE.lastIndex = 0;
    let m;
    while (null != (m = SERVER_VAR_RE.exec(url))) {
        const name = m[1];
        if (seen.has(name)) {
            continue;
        }
        seen.add(name);
        const decl = declared[name] || {};
        const dflt = 'string' === typeof decl.default ? decl.default : '';
        out.push({
            name,
            dflt,
            required: '' === dflt,
            description: 'string' === typeof decl.description ? decl.description : '',
        });
    }
    // Declared-but-unreferenced variables: not substitutable, never required.
    for (const name of Object.keys(declared)) {
        if (seen.has(name)) {
            continue;
        }
        seen.add(name);
        const decl = declared[name] || {};
        out.push({
            name,
            dflt: 'string' === typeof decl.default ? decl.default : '',
            required: false,
            description: 'string' === typeof decl.description ? decl.description : '',
        });
    }
    return out;
}
function serverVarEnv(projenvname, name) {
    return projenvname + '_SERVER_' + String(name).toUpperCase();
}
// Does the model's server URL contain any {name} placeholders at all?
function hasServerVariables(model) {
    const info = model?.main?.kit?.info || model?.main?.KIT?.info;
    const url = info?.servers?.[0]?.url || '';
    SERVER_VAR_RE.lastIndex = 0;
    return SERVER_VAR_RE.test(url);
}
//# sourceMappingURL=serverVars.js.map