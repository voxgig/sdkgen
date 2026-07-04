"use strict";
// Single source of truth for a generated SDK's PUBLISHED identity and its
// descriptive metadata, shared by the per-language Package_<lang>.ts manifest
// generators AND the README install/heading components — so the install
// command a README prints can never drift from the real published package name
// (the #1 defect the publishing recommendations call out).
//
// The recommendations require, for every package:
//   - install commands that match the real package name EXACTLY;
//   - description "Unofficial generated <Lang> SDK for the <API> public API.";
//   - a generic non-affiliation statement (upstream owner names are unreliable);
//   - homepage / repository / issues under github.com/<origin>/<slug>-sdk;
//   - the fixed keyword set [voxgig sdk generated-sdk openapi api-client <slug>].
//
// Every value here is derived from the resolved model (model.name, model.origin,
// main.kit.info.title) — no new inputs required.
Object.defineProperty(exports, "__esModule", { value: true });
exports.LANG_LABEL = exports.GENERATOR_URL = exports.SECURITY_EMAIL = exports.PUBLISHER_URL = exports.PUBLISHER = void 0;
exports.langLabel = langLabel;
exports.repoInfo = repoInfo;
exports.apiName = apiName;
exports.packageName = packageName;
exports.installCommand = installCommand;
exports.pkgDescription = pkgDescription;
exports.nonAffiliation = nonAffiliation;
exports.keywords = keywords;
exports.envName = envName;
const apidef_1 = require("@voxgig/apidef");
const PUBLISHER = 'Voxgig';
exports.PUBLISHER = PUBLISHER;
const PUBLISHER_URL = 'https://voxgig.com';
exports.PUBLISHER_URL = PUBLISHER_URL;
const SECURITY_EMAIL = 'security@voxgig.com';
exports.SECURITY_EMAIL = SECURITY_EMAIL;
const GENERATOR_URL = 'https://github.com/voxgig/sdkgen';
exports.GENERATOR_URL = GENERATOR_URL;
const LANG_LABEL = {
    ts: 'TypeScript',
    js: 'JavaScript',
    py: 'Python',
    php: 'PHP',
    rb: 'Ruby',
    lua: 'Lua',
    go: 'Go',
    'go-cli': 'Go CLI',
    'go-mcp': 'Go MCP server',
};
exports.LANG_LABEL = LANG_LABEL;
function langLabel(target) {
    return LANG_LABEL[target] || target;
}
// GitHub org (publisher slug), repo name, and the canonical repo URLs.
function repoInfo(model) {
    const slug = model.name;
    const origin = model.origin || 'voxgig-sdk';
    const repo = `${slug}-sdk`;
    const repoUrl = `https://github.com/${origin}/${repo}`;
    return {
        slug,
        origin,
        repo,
        repoUrl,
        issuesUrl: `${repoUrl}/issues`,
        changelogUrl: `${repoUrl}/blob/main/CHANGELOG.md`,
    };
}
// API display name for descriptions, e.g. "Aare.guru". Uses the OpenAPI
// info.title (present for ~98% of the fleet), stripping a trailing " API" so
// we don't render "... Aare.guru API public API". Falls back to the normalised
// SDK Name, then the slug.
function apiName(model) {
    const info = (model.main && model.main[apidef_1.KIT] && model.main[apidef_1.KIT].info) || {};
    const raw = (null != info.title ? String(info.title) : '').trim();
    const stripped = raw.replace(/\s*API\s*$/i, '').trim();
    return stripped || (0, apidef_1.nom)(model, 'Name') || model.name;
}
// The REAL published package name per ecosystem — mirrors the exact formula in
// each Package_<lang>.ts. This is the one canonical implementation.
function packageName(model, eco) {
    const slug = model.name;
    const origin = model.origin || 'voxgig-sdk';
    const base = origin.endsWith('-sdk') ? slug : `${slug}-sdk`;
    const npmScoped = `@${origin}/${slug}${origin.endsWith('-sdk') ? '' : '-sdk'}`;
    switch (eco) {
        case 'npm':
        case 'ts':
            return npmScoped;
        case 'js':
            return `${npmScoped}-js`;
        case 'pypi':
        case 'py':
        case 'gem':
        case 'rb':
        case 'luarocks':
        case 'lua':
            return `${origin}-${base}`;
        case 'composer':
        case 'php':
            return `${origin}/${base}`;
        case 'go':
            return `github.com/${origin}/${slug}-sdk/go`;
        case 'go-cli':
            return `github.com/${origin}/${slug}-sdk/go-cli`;
        case 'go-mcp':
            return `github.com/${origin}/${slug}-sdk/go-mcp`;
        default:
            return `${origin}-${base}`;
    }
}
// Copy-paste install command for a target, using the REAL package name.
function installCommand(model, target) {
    switch (target) {
        case 'ts':
            return `npm install ${packageName(model, 'npm')}`;
        case 'js':
            return `npm install ${packageName(model, 'js')}`;
        case 'py':
            return `pip install ${packageName(model, 'pypi')}`;
        case 'php':
            return `composer require ${packageName(model, 'composer')}`;
        case 'rb':
            return `gem install ${packageName(model, 'gem')}`;
        case 'lua':
            return `luarocks install ${packageName(model, 'luarocks')}`;
        case 'go':
            return `go get ${packageName(model, 'go')}`;
        case 'go-cli':
            return `go install ${packageName(model, 'go-cli')}/cmd/${model.name}@latest`;
        default:
            return '';
    }
}
// The standard one-line package description (with the generic non-affiliation
// statement inline) used in every manifest.
function pkgDescription(model, target) {
    return `Unofficial generated ${langLabel(target)} SDK for the ${apiName(model)} public API.` +
        ` Not affiliated with or endorsed by the upstream API provider.`;
}
// Longer non-affiliation / generated-code disclosure for READMEs, LICENSE and
// SECURITY.md. Generic on the upstream owner (owner names are only ~45%
// reliably known across the fleet).
function nonAffiliation(model) {
    return `This is an unofficial SDK for the ${apiName(model)} public API, generated by ` +
        `${PUBLISHER} with [\`@voxgig/sdkgen\`](${GENERATOR_URL}). ` +
        `It is not affiliated with, endorsed by, or sponsored by the upstream API provider.`;
}
function keywords(model) {
    return ['voxgig', 'sdk', 'generated-sdk', 'openapi', 'api-client', model.name];
}
// A VALID uppercase env-var base derived from the slug: 'unsolicited-advice' ->
// 'UNSOLICITED_ADVICE'. Use for <NAME>_APIKEY / <NAME>_TEST_LIVE so examples are
// valid identifiers (model.NAME left a hyphen in, breaking process.env.X).
function envName(model) {
    return String(model.name || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
//# sourceMappingURL=packageMeta.js.map