"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userAgent = userAgent;
const apidef_1 = require("@voxgig/apidef");
const utility_1 = require("../utility");
const packageMeta_1 = require("./packageMeta");
// The agent lands verbatim in a string literal in every target, so it may hold
// only what no target's literal escapes or interpolates: no quote, backslash,
// `$`, brace or C trigraph.
const AGENT_CHARS = /^[A-Za-z0-9!#%&()*+,\-./:;<=>?@[\]^_|~](?:[A-Za-z0-9 !#%&()*+,\-./:;<=>?@[\]^_|~]*[A-Za-z0-9!#%&()*+,\-./:;<=>?@[\]^_|~])?$/;
// The User-Agent every target's transport sends when the caller sets none,
// from `main.kit.http.useragent`: unset keeps the browser shape several CDNs
// need, `plain` sends `<Name>SDK/<version>`, and any other value is sent as is.
function userAgent(model, target) {
    const Name = model?.const?.Name;
    const declared = model?.main?.[apidef_1.KIT]?.http?.useragent;
    if (null == declared || '' === declared) {
        return 'Mozilla/5.0 (compatible; ' + Name + 'SDK/1.0)';
    }
    if ('plain' === declared) {
        return Name + 'SDK/' + (0, packageMeta_1.packageVersion)(model, target);
    }
    const agent = String(declared);
    if (!AGENT_CHARS.test(agent) || agent.includes('??')) {
        throw new utility_1.SdkGenError('main.kit.http.useragent: ' + JSON.stringify(agent) +
            ' cannot be sent as written. Use printable ASCII without quotes, a backslash, `$`, ' +
            'braces or `??`, and no leading or trailing space.');
    }
    return agent;
}
//# sourceMappingURL=useragent.js.map