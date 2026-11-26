"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientOptions = clientOptions;
const apidef_1 = require("@voxgig/apidef");
const facts_1 = require("./facts");
// The options a caller sets, in the order a table lists them. Each is listed
// only where the optspec declares it; `feature` the option spec adds per target.
const DOCUMENTED = [
    ['apikey', 'string', 'API key for authentication.'],
    ['secret', 'string', 'API secret for authentication.'],
    ['base', 'string', 'Base URL of the API server.'],
    ['prefix', 'string', 'URL path prefix prepended to all requests.'],
    ['suffix', 'string', 'URL path suffix appended to all requests.'],
    ['headers', 'map', 'Headers sent with every request.'],
    ['feature', 'map', 'Feature activation flags.'],
    ['extend', 'list', 'Additional feature instances to load.'],
    ['system', 'map', 'System overrides, such as a custom fetch function.'],
];
// The rows of a client options table: the server variables first where the
// URL is a template, the credential where the auth fact names it, then the rest.
function clientOptions(model) {
    const kit = model.main[apidef_1.KIT];
    const auth = (0, facts_1.fact)(kit, 'auth');
    const declared = new Set((0, facts_1.fact)(kit, 'option').map((o) => o.name).concat('feature'));
    const svars = (0, facts_1.fact)(kit, 'server');
    const required = svars.filter((v) => v.required);
    const rows = 0 === svars.length ? [] : [{
            name: 'server', kind: 'map',
            desc: (0 === required.length ? '' : '**Required.** ') +
                'Values for the server-URL variables: ' +
                [...required.map((v) => '`' + v.name + '`'),
                    ...svars.filter((v) => !v.required)
                        .map((v) => '`' + v.name + '` (default `' + v.dflt + '`)')].join(', ') +
                '. The API base URL is a template over them.',
        }];
    for (const [name, kind, desc] of DOCUMENTED) {
        if (declared.has(name) && ('apikey' !== name || auth.apikey) &&
            ('secret' !== name || auth.secret)) {
            rows.push({ name, kind, desc });
        }
    }
    return rows;
}
//# sourceMappingURL=clientOptions.js.map