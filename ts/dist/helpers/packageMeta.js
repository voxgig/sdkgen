"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LANG_LABEL = exports.GENERATOR_URL = exports.SECURITY_EMAIL = exports.PUBLISHER_URL = exports.PUBLISHER = void 0;
exports.langLabel = langLabel;
exports.originName = originName;
exports.repoInfo = repoInfo;
exports.apiName = apiName;
exports.packageName = packageName;
exports.installCommand = installCommand;
exports.registryState = registryState;
exports.isPublished = isPublished;
exports.registryName = registryName;
exports.vendorCommand = vendorCommand;
exports.pkgDescription = pkgDescription;
exports.nonAffiliation = nonAffiliation;
exports.keywords = keywords;
exports.authorInfo = authorInfo;
exports.contributorList = contributorList;
exports.envName = envName;
exports.envToken = envToken;
exports.goModule = goModule;
exports.goVersion = goVersion;
exports.goPackageIdent = goPackageIdent;
exports.packageVersion = packageVersion;
exports.docsSiteUrl = docsSiteUrl;
const jostraca_1 = require("jostraca");
const apidef_1 = require("@voxgig/apidef");
const kindCollection_1 = require("./kindCollection");
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
    'py-data': 'Python Data',
};
exports.LANG_LABEL = LANG_LABEL;
function langLabel(target) {
    return LANG_LABEL[target] || target;
}
function originName(model, target) {
    const orig = model?.main?.[apidef_1.KIT]?.target?.[target]?.origname;
    return (null != orig && '' !== orig) ? String(orig) : target;
}
function repoInfo(model) {
    const slug = model.name;
    const origin = model.origin || 'voxgig-sdk';
    const declared = (model && model.main && model.main[apidef_1.KIT] && model.main[apidef_1.KIT].repo) || {};
    const host = '' === (declared.host || '') ? 'github.com' : (declared.host || 'github.com');
    const path = '' === (declared.path || '') ? `${origin}/${slug}-sdk` : String(declared.path);
    const seg = path.split('/');
    const repo = seg[seg.length - 1];
    const repoUrl = `https://${host}/${path}`;
    return {
        slug,
        origin,
        host,
        path,
        repo,
        repoUrl,
        issuesUrl: `${repoUrl}/issues`,
        changelogUrl: `${repoUrl}/blob/main/CHANGELOG.md`,
        releasesUrl: `${repoUrl}/releases`,
        tagsUrl: `${repoUrl}/tags`,
    };
}
function docsSiteUrl(model) {
    const { host, path } = repoInfo(model);
    if ('github.com' !== host) {
        return '';
    }
    const editions = (0, kindCollection_1.kindCollection)(model, 'edition');
    // published, not active: serving is per-repository state, not generation.
    const pages = Object.values(editions || {})
        .find((e) => 'github-pages' === e?.kind && false !== e?.active && true === e?.published);
    if (null == pages) {
        return '';
    }
    const seg = path.split('/');
    const org = seg[0];
    const repo = seg[seg.length - 1];
    return org && repo ? `https://${org}.github.io/${repo}/` : '';
}
function goModule(model, target) {
    const declared = model?.main?.[apidef_1.KIT]?.target?.[target]?.module?.path;
    if (null != declared && '' !== declared) {
        return String(declared);
    }
    const { host, path } = repoInfo(model);
    return `${host}/${path}/${target}`;
}
function packageVersion(model, target) {
    const declared = model?.main?.[apidef_1.KIT]?.target?.[target]?.publish?.version;
    return null != declared && '' !== declared ? String(declared) : '0.0.1';
}
function goVersion(model, target, fallback) {
    const declared = model?.main?.[apidef_1.KIT]?.target?.[target]?.module?.goversion;
    if (null != declared && '' !== declared) {
        return String(declared);
    }
    return fallback || '1.21';
}
function goPackageIdent(model, target) {
    const declared = model?.main?.[apidef_1.KIT]?.target?.[target]?.module?.package;
    if (null != declared && '' !== declared) {
        return String(declared);
    }
    const ident = (s) => String(s || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const org = ident((model.origin || 'voxgig-sdk').replace(/-sdk$/, ''));
    let slug = ident(model.name);
    if ('' !== org && slug.startsWith(org)) {
        slug = slug.slice(org.length);
    }
    return org + slug + 'sdk';
}
function registryState(model, target) {
    const eco = originName(model, target);
    if ('go' === eco || 'go-cli' === eco || 'go-mcp' === eco)
        return 'tag';
    const reg = model?.main?.[apidef_1.KIT]?.target?.[target]?.publish?.registry;
    if (null == reg || '' === (reg.name || ''))
        return 'tag';
    if (true === reg.active)
        return 'active';
    const s = reg.state;
    if ('active' === s || 'inactive' === s || 'pending' === s)
        return s;
    return 'pending';
}
// True only when the package is actually live on its registry (so a README
// may print the real `npm install`/`pip install`/... command). Everything
// else — pending, inactive, tag-only — installs from the git tag instead.
function isPublished(model, target) {
    return 'active' === registryState(model, target);
}
// The registry a target uploads to (npm | pypi | packagist | ...), or ''
// for tag-only ports. Used in the "not yet on <registry>" pending message.
function registryName(model, target) {
    const reg = model?.main?.[apidef_1.KIT]?.target?.[target]?.publish?.registry;
    return (reg && reg.name) ? String(reg.name) : '';
}
// The vendor / git-tag install pointer for a NOT-yet-published target. For
// the go family this is the canonical install (`go get <module>@latest`,
// which the Go proxy resolves from the `<subdir>/vX.Y.Z` tag). For registry
// ports it is a short "not yet on <registry> — install from the git tag"
// pointer carrying the tags URL.
function vendorCommand(model, target) {
    const { tagsUrl } = repoInfo(model);
    switch (originName(model, target)) {
        // `target`, not the literal — the case says WHICH command, the argument
        // says whose module. Writing the literal here reintroduces the same bug
        // the switch above exists to fix, one level down, which is exactly what
        // the first cut of this change did.
        case 'go':
        case 'go-mcp':
            return `go get ${packageName(model, target)}@latest`;
        case 'go-cli':
            return `go install ${packageName(model, target)}/cmd/${model.name}@latest`;
        default: {
            const reg = registryName(model, target);
            return `not yet on ${reg || 'the registry'} — install from the git tag: ${tagsUrl}`;
        }
    }
}
function apiName(model) {
    const info = (model.main && model.main[apidef_1.KIT] && model.main[apidef_1.KIT].info) || {};
    const raw = (null != info.title ? String(info.title) : '').trim();
    const stripped = raw.replace(/\s*API\s*$/i, '').trim();
    return stripped || (0, apidef_1.nom)(model, 'Name') || model.name;
}
function packageName(model, eco) {
    const slug = model.name;
    const origin = model.origin || 'voxgig-sdk';
    const base = slug.endsWith('-sdk') ? slug : `${slug}-sdk`;
    const npmScoped = `@${origin}/${base}`;
    const ECO_TARGET = {
        npm: 'ts', pypi: 'py', gem: 'rb', luarocks: 'lua', composer: 'php',
    };
    const declared = model?.main?.[apidef_1.KIT]?.target?.[ECO_TARGET[eco] || eco]
        ?.publish?.registry?.package;
    if (null != declared && '' !== declared) {
        return String(declared);
    }
    // The lookup above is keyed by the target's OWN name, so an alias reads its
    // own declared package. The switch below is about FORM — npm scoping,
    // slash-separated composer names — which belongs to the language, so it
    // follows the origin. Passing `ts2` here without this would miss every case
    // and fall to `default`, silently publishing under a non-npm name.
    switch (originName(model, eco)) {
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
        // `eco`, not the literal: the case is chosen by the LANGUAGE but the
        // module belongs to the target that asked. `packageName(model, 'go2')`
        // returning go's module was the same conflation one level down.
        case 'go':
        case 'go-cli':
        case 'go-mcp':
            return goModule(model, eco);
        case 'py-data':
            return `${origin}-${base}-data`;
        default:
            return `${origin}-${base}`;
    }
}
// Copy-paste install command for a target, using the REAL package name.
// Only a package that is actually live on its registry (isPublished) gets a
// registry install command; everything else (pending / inactive / tag-only,
// including the whole go family) returns the git-tag vendor command instead,
// so a README never prints a `npm install ...` that 404s.
function installCommand(model, target) {
    if (!isPublished(model, target)) {
        return vendorCommand(model, target);
    }
    switch (originName(model, target)) {
        case 'ts':
        case 'js':
            return `npm install ${packageName(model, target)}`;
        case 'py':
        case 'py-data':
            return `pip install ${packageName(model, target)}`;
        case 'php':
            return `composer require ${packageName(model, target)}`;
        case 'rb':
            return `gem install ${packageName(model, target)}`;
        case 'lua':
            return `luarocks install ${packageName(model, target)}`;
        case 'go':
            return `go get ${packageName(model, target)}`;
        case 'go-cli':
            return `go install ${packageName(model, target)}/cmd/${model.name}@latest`;
        default:
            return '';
    }
}
function pkgDescription(model, target) {
    return `Unofficial generated ${langLabel(originName(model, target))} SDK` +
        ` for the ${apiName(model)} public API.` +
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
function authorInfo(model, target) {
    const perTarget = null == target ? null :
        model?.main?.[apidef_1.KIT]?.target?.[target]?.author;
    const declared = (null != perTarget && '' !== (perTarget.name || '')) ?
        perTarget : (model?.main?.[apidef_1.KIT]?.author || {});
    const name = null != declared.name && '' !== declared.name ?
        String(declared.name) : PUBLISHER;
    const url = null != declared.url && '' !== declared.url ? String(declared.url) :
        (PUBLISHER === name ? PUBLISHER_URL : '');
    return { name, url };
}
function contributorList(model) {
    return (0, jostraca_1.each)(model?.main?.[apidef_1.KIT]?.contributor || {})
        .filter((c) => null != c && null != c.name && '' !== c.name)
        .map((c) => ({
        name: String(c.name),
        url: null != c.url && '' !== c.url ? String(c.url) : '',
    }));
}
function envToken(name) {
    return String(name || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function envName(model) {
    return envToken(model.name);
}
//# sourceMappingURL=packageMeta.js.map