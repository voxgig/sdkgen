"use strict";
// OpenAPI server-variable support (templated server URLs).
//
// A spec may declare its server URL as a template over named variables:
//
//   servers:
//     - url: https://{tenant_id}.hanko.io
//       variables:
//         tenant_id: { default: '', description: '...' }
//
// The generated SDKs carry the template verbatim in `options.base` and
// resolve it AT CONSTRUCTION via the `server` options block:
//
//   new SDK({ server: { tenant_id: 'my-tenant' } })
//
// Resolution rules (identical in every target runtime):
//   - each `{name}` in base is replaced with options.server[name],
//     falling back to the spec default emitted into the SDK's Config;
//   - a variable that resolves to '' is an ERROR at construction — the
//     URL cannot work without it — EXCEPT in test mode, where the
//     deterministic value `test-<name>` is substituted so offline tests
//     never require configuration.
//
// This module is the emission-side half: it parses the spec's variables
// out of the model so Config emitters can write the `server` defaults
// block, and docs can name the required variables.
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverVariables = serverVariables;
exports.hasServerVariables = hasServerVariables;
exports.serverVarEnv = serverVarEnv;
// Match {name} placeholders in a server URL template. OpenAPI variable
// names are restricted to word characters in practice; a brace group that
// is not a well-formed name is left untouched rather than guessed at.
const SERVER_VAR_RE = /\{([A-Za-z0-9_]+)\}/g;
// Parse the server variables declared on servers[0] of the model
// (main.<KIT>.info.servers.0). Variables are returned in URL order —
// the order their placeholders appear in the template — with declared
// variables that never appear in the URL appended after (harmless, but
// kept so docs can still describe them). Returns [] when the URL has no
// placeholders.
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
// The environment variable a generated LIVE test reads one server variable
// from: `<PROJ>_SERVER_<NAME>`, e.g. ELEMENTDEMO_SERVER_ACCOUNT_ID.
//
// A live client CANNOT BE CONSTRUCTED without every required server
// variable — makeOptions raises rather than issue requests to a URL with a
// literal `{account_id}` in it — so an SDK whose spec templates its server
// URL had no runnable live suite at all until the generated tests could be
// told the values. The apikey has had `<PROJ>_APIKEY` since the beginning;
// this is the same idea for the other half of "where do I point".
//
// One variable per NAME rather than one JSON blob: the names come from the
// spec, they are few, and a shell export per name is what a CI secret store
// and a .env file both hold naturally.
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