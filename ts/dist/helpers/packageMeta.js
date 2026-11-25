"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.langLabel = exports.LANG_LABEL = exports.GENERATOR_URL = exports.SECURITY_EMAIL = exports.PUBLISHER_URL = exports.PUBLISHER = void 0;
exports.sdkName = sdkName;
exports.originName = originName;
exports.repoInfo = repoInfo;
exports.apiName = apiName;
exports.packageName = packageName;
exports.hasPackageName = hasPackageName;
exports.installCommand = installCommand;
exports.registryState = registryState;
exports.isPublished = isPublished;
exports.registryName = registryName;
exports.vendorCommand = vendorCommand;
exports.pkgDescription = pkgDescription;
exports.tomlString = tomlString;
exports.nonAffiliation = nonAffiliation;
exports.keywords = keywords;
exports.publisherInfo = publisherInfo;
exports.isDefaultPublisher = isDefaultPublisher;
exports.securityContact = securityContact;
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
const surface_1 = require("./surface");
const facts_1 = require("./facts");
const kindCollection_1 = require("./kindCollection");
const text_1 = require("./text");
const title_1 = require("./title");
Object.defineProperty(exports, "LANG_LABEL", { enumerable: true, get: function () { return title_1.LANG_LABEL; } });
Object.defineProperty(exports, "langLabel", { enumerable: true, get: function () { return title_1.langLabel; } });
const PUBLISHER = 'Voxgig';
exports.PUBLISHER = PUBLISHER;
const PUBLISHER_URL = 'https://voxgig.com';
exports.PUBLISHER_URL = PUBLISHER_URL;
const SECURITY_EMAIL = 'security@voxgig.com';
exports.SECURITY_EMAIL = SECURITY_EMAIL;
const GENERATOR_URL = 'https://github.com/voxgig/sdkgen';
exports.GENERATOR_URL = GENERATOR_URL;
function originName(model, target) {
    const orig = model?.main?.[apidef_1.KIT]?.target?.[target]?.origname;
    return (null != orig && '' !== orig) ? String(orig) : target;
}
function sdkName(slug) {
    return slug.endsWith('-sdk') ? slug : `${slug}-sdk`;
}
function repoInfo(model) {
    const slug = model.name;
    const origin = model.origin || 'voxgig-sdk';
    const declared = (model && model.main && model.main[apidef_1.KIT] && model.main[apidef_1.KIT].repo) || {};
    const host = '' === (declared.host || '') ? 'github.com' : (declared.host || 'github.com');
    const path = '' === (declared.path || '') ? `${origin}/${sdkName(slug)}` : String(declared.path);
    const seg = path.split('/');
    const repo = seg[seg.length - 1];
    const repoUrl = `https://${host}/${path}`;
    const pages = repoPages(host, repoUrl);
    return {
        slug,
        origin,
        host,
        path,
        repo,
        repoUrl,
        hostName: pages.name,
        issuesUrl: pages.issues,
        changelogUrl: pages.changelog,
        releasesUrl: pages.releases,
        tagsUrl: pages.tags,
    };
}
// GitLab keeps a project's pages under `/-/`, and Bitbucket lists its tags
// among its downloads; any other host is laid out as GitHub is.
function repoPages(host, repoUrl) {
    if (host.includes('gitlab')) {
        return {
            name: 'GitLab',
            issues: `${repoUrl}/-/issues`,
            changelog: `${repoUrl}/-/blob/main/CHANGELOG.md`,
            releases: `${repoUrl}/-/releases`,
            tags: `${repoUrl}/-/tags`,
        };
    }
    if ('bitbucket.org' === host) {
        return {
            name: 'Bitbucket',
            issues: `${repoUrl}/issues`,
            changelog: `${repoUrl}/src/main/CHANGELOG.md`,
            releases: `${repoUrl}/downloads/?tab=tags`,
            tags: `${repoUrl}/downloads/?tab=tags`,
        };
    }
    return {
        name: host.includes('github') ? 'GitHub' : host,
        issues: `${repoUrl}/issues`,
        changelog: `${repoUrl}/blob/main/CHANGELOG.md`,
        releases: `${repoUrl}/releases`,
        tags: `${repoUrl}/tags`,
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
// A registry named `none` is no registry: c, cpp and zig declare it.
function registryState(model, target) {
    const reg = model?.main?.[apidef_1.KIT]?.target?.[target]?.publish?.registry;
    if (null == reg || '' === registryName(model, target) || goFamily(model, target))
        return 'tag';
    if (true === reg.active)
        return 'active';
    const s = reg.state;
    if ('active' === s || 'inactive' === s || 'pending' === s)
        return s;
    return 'pending';
}
// Only a package live on its registry gets a registry install command; any
// other installs from the git tag.
function isPublished(model, target) {
    return 'active' === registryState(model, target);
}
// Go installs from its git tag whatever the registry, as does a target built on it.
function goFamily(model, target) {
    if ('go' === originName(model, target))
        return true;
    const wraps = (0, facts_1.fact)(model.main[apidef_1.KIT].target[target], 'consumes');
    return '' !== wraps && 'go' === originName(model, wraps);
}
// The registry a target uploads to (npm | pypi | packagist | ...), or '' for a tag-only port.
function registryName(model, target) {
    const reg = model?.main?.[apidef_1.KIT]?.target?.[target]?.publish?.registry;
    const name = (reg && reg.name) ? String(reg.name) : '';
    return 'none' === name ? '' : name;
}
// The install route for a target not on a registry: `go get <module>@latest`
// for go, resolved by the proxy from the `go/vX.Y.Z` tag. go-cli, go-mcp and a
// port with no registry get '', and their README's build steps are the route.
// A declared registry gets a "not yet on <registry>" pointer to the git tag.
function vendorCommand(model, target) {
    const { tagsUrl } = repoInfo(model);
    switch (originName(model, target)) {
        // `target`, not the literal — the case says WHICH command, the argument
        // says whose module. Writing the literal here reintroduces the same bug
        // the switch above exists to fix, one level down, which is exactly what
        // the first cut of this change did.
        case 'go':
            return `go get ${packageName(model, target)}@latest`;
        // go-cli and go-mcp reach the SDK through `replace => ../go`, and the Go
        // proxy cannot install a module that needs one. There is no command to
        // give, so the caller links to the target README's build steps.
        case 'go-cli':
        case 'go-mcp':
            return '';
        default: {
            const reg = registryName(model, target);
            return '' === reg ? '' : `not yet on ${reg} — install from the git tag: ${tagsUrl}`;
        }
    }
}
function apiName(model) {
    const info = (0, text_1.modelText)(model);
    const raw = (null != info.title ? String(info.title) : '').trim();
    const stripped = raw.replace(/\s*API\s*$/i, '').trim();
    return stripped || (0, apidef_1.nom)(model, 'Name') || model.name;
}
function packageName(model, eco) {
    const slug = model.name;
    const origin = model.origin || 'voxgig-sdk';
    const base = sdkName(slug);
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
// For any other consumer packageName would answer the SDK's own name.
const NAMED_CONSUMERS = ['go-cli', 'go-mcp', 'py-data'];
function hasPackageName(model, target) {
    const declared = model?.main?.[apidef_1.KIT]?.target?.[target];
    if ('sdk' === (0, surface_1.surfaceOf)(declared)) {
        return true;
    }
    const pkg = declared?.publish?.registry?.package;
    return (null != pkg && '' !== pkg) || NAMED_CONSUMERS.includes(originName(model, target));
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
        case 'rust':
            return `cargo add ${packageName(model, target)}`;
        case 'csharp':
            return `dotnet add package ${packageName(model, target)}`;
        case 'perl':
            return `cpanm ${packageName(model, target)}`;
        case 'ocaml':
            return `opam install ${packageName(model, target)}`;
        // No package manager installs these: the release tag is the route.
        case 'c':
        case 'zig':
            return `install from the git tag: ${repoInfo(model).tagsUrl}`;
        default:
            return '';
    }
}
function pkgDescription(model, target) {
    return `Unofficial generated ${(0, title_1.langLabel)(originName(model, target))} SDK` +
        ` for the ${apiName(model)} public API.` +
        ` Not affiliated with or endorsed by the upstream API provider.`;
}
// JSON's string escapes are all TOML's; TOML also refuses a raw DEL.
function tomlString(s) {
    return JSON.stringify(String(s)).replace(/\x7f/g, '\\u007F');
}
// Longer non-affiliation / generated-code disclosure for READMEs, LICENSE and
// SECURITY.md. Generic on the upstream owner (owner names are only ~45%
// reliably known across the fleet).
function nonAffiliation(model) {
    return `This is an unofficial SDK for the ${apiName(model)} public API, generated by ` +
        `${publisherInfo(model).name} with [\`@voxgig/sdkgen\`](${GENERATOR_URL}). ` +
        `It is not affiliated with, endorsed by, or sponsored by the upstream API provider.`;
}
function keywords(model) {
    return [...(isDefaultPublisher(model) ? ['voxgig'] : []),
        'sdk', 'generated-sdk', 'openapi', 'api-client', model.name];
}
function declaredText(value) {
    return null != value && '' !== value ? String(value) : '';
}
// Voxgig's url and security contact apply only while Voxgig is the publisher.
function publisherInfo(model) {
    const declared = model?.main?.[apidef_1.KIT]?.publisher || {};
    const name = declaredText(declared.name) || PUBLISHER;
    const own = PUBLISHER === name;
    return {
        name,
        url: declaredText(declared.url) || (own ? PUBLISHER_URL : ''),
        security: declaredText(declared.security) || (own ? SECURITY_EMAIL : ''),
    };
}
function isDefaultPublisher(model) {
    return PUBLISHER === publisherInfo(model).name;
}
// Completes "Please report security issues ...".
function securityContact(model) {
    const { name, url, security } = publisherInfo(model);
    return '' !== security ? `to ${security}` :
        `privately to ${name}` + ('' !== url ? ` (${url})` : '');
}
function authorInfo(model, target) {
    const perTarget = null == target ? null :
        model?.main?.[apidef_1.KIT]?.target?.[target]?.author;
    const declared = (null != perTarget && '' !== (perTarget.name || '')) ?
        perTarget : (model?.main?.[apidef_1.KIT]?.author || {});
    const publisher = publisherInfo(model);
    const name = declaredText(declared.name) || publisher.name;
    const url = declaredText(declared.url) ||
        (publisher.name === name ? publisher.url : '');
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