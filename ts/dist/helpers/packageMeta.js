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
const jostraca_1 = require("jostraca");
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
    'py-data': 'Python Data',
};
exports.LANG_LABEL = LANG_LABEL;
function langLabel(target) {
    return LANG_LABEL[target] || target;
}
// THE NAME WHOSE LANGUAGE RULES APPLY.
//
// A target name does two unrelated jobs in this file, and conflating them is
// the defect this exists to end. `go~go2` installs a SECOND Go SDK: its
// CONFIG lives under `main.kit.target.go2` (its own module path, its own
// registry state), but it is still Go — the same go.mod shape, the same
// `go get` install line, the same "Go" label.
//
// So: look config up by the target's OWN name, and select behaviour by this.
// `origname` is stamped at add time precisely for aliased installs and is
// empty when a target was installed under its own name, which makes the
// unaliased case identical to what it was.
//
// Ecosystem keys ('npm', 'gem', 'composer') pass through untouched: there is
// no target node under those names, so they answer for themselves.
function originName(model, target) {
    const orig = model?.main?.[apidef_1.KIT]?.target?.[target]?.origname;
    return (null != orig && '' !== orig) ? String(orig) : target;
}
// Git host, org/repo path, and the canonical repo URLs.
//
// `<origin>/<slug>-sdk` is a DERIVATION, not a law. A project whose repo is
// named anything else — `voxgig-sdk/voxgig-solardemo-sdk`, say, where the slug
// is `solardemo` — used to have no way to say so, and got a `go.mod` module
// path that 404s on `go get` plus `homepage`/`repository`/`bugs` URLs pointing
// at a repo that does not exist. The only escape was renaming the slug, which
// also renames the SDK classes: a public-API break, and no help at all to a
// project that has already published.
//
//   main: kit: repo: {
//     path: 'voxgig-sdk/voxgig-solardemo-sdk'   # overrides <origin>/<slug>-sdk
//     host: 'github.com'                        # default
//   }
function repoInfo(model) {
    const slug = model.name;
    const origin = model.origin || 'voxgig-sdk';
    const declared = (model && model.main && model.main[apidef_1.KIT] && model.main[apidef_1.KIT].repo) || {};
    const host = '' === (declared.host || '') ? 'github.com' : (declared.host || 'github.com');
    const path = '' === (declared.path || '') ? `${origin}/${slug}-sdk` : String(declared.path);
    // Last segment is the repo; everything before it is the org (which may
    // itself contain slashes on hosts that allow subgroups, e.g. GitLab).
    const seg = path.split('/');
    const repo = seg[seg.length - 1];
    const repoUrl = `https://${host}/${path}`;
    return {
        slug,
        origin,
        host,
        // 'org/repo' — the path under the host, and the base of a go module path.
        path,
        repo,
        repoUrl,
        issuesUrl: `${repoUrl}/issues`,
        changelogUrl: `${repoUrl}/blob/main/CHANGELOG.md`,
        // Version-agnostic releases page: where the `<target>/vX.Y.Z` git tags
        // that a pending (not-yet-on-registry) package is installed from live.
        releasesUrl: `${repoUrl}/releases`,
    };
}
// The go module path for a go-family target: the declared override, else the
// repo path plus the target's subdirectory.
//
//   main: kit: target: go: module: path: 'github.com/acme/legacy-sdk/go'
//
// THE ONLY implementation. Twelve go components used to re-derive
// `github.com/${origin}/${name}-sdk/go` inline, so fixing the path in one
// place fixed nothing — and `ReadmeTop`, which prints the module in the root
// README's package table, lives inside node_modules where a consumer cannot
// patch it at all.
function goModule(model, target) {
    const declared = model?.main?.[apidef_1.KIT]?.target?.[target]?.module?.path;
    if (null != declared && '' !== declared) {
        return String(declared);
    }
    const { host, path } = repoInfo(model);
    return `${host}/${path}/${target}`;
}
// The SDK's OWN release version, for this target's manifest and release tag.
//
//   main: kit: target: ts: publish: version: '0.0.2'
//
// Defaults to '0.0.1' (the schema default), which is what every manifest
// emitter used to HARDCODE. That is why regeneration reset a published
// version: the value lived only in the generated output, so overwriting the
// output threw it away, and a project that had shipped 0.0.2 silently got a
// 0.0.1 manifest back. Declaring it in the model makes the manifest, the
// install docs and the port's VERSION file agree, and survive.
function packageVersion(model, target) {
    const declared = model?.main?.[apidef_1.KIT]?.target?.[target]?.publish?.version;
    return null != declared && '' !== declared ? String(declared) : '0.0.1';
}
// The Go language version for a go-family target's go.mod.
//
//   main: kit: target: go: module: goversion: '1.23'
//
// Defaults to 1.21, the release that introduced `log/slog` — which sdkgen's
// own `log` feature template imports. The previous hardcoded `go 1.20` meant a
// generated SDK could not compile the feature source sdkgen had just written
// into it.
function goVersion(model, target, fallback) {
    const declared = model?.main?.[apidef_1.KIT]?.target?.[target]?.module?.goversion;
    if (null != declared && '' !== declared) {
        return String(declared);
    }
    return fallback || '1.21';
}
// The root Go package IDENTIFIER — `package voxgigsolardemosdk`. Go requires
// a plain identifier here, so unlike the module path it must be concatenated
// from the slug rather than taken from the repo.
//
//   main: kit: target: go: module: package: 'acmesdk'
//
// The default concatenates `<origin><slug>sdk`, which DOUBLES the org prefix
// whenever the slug already carries it: slug `voxgig-solardemo` under origin
// `voxgig-sdk` produced `package voxgigvoxgigsolardemosdk`. A slug repeating
// its org is the natural shape for a repo named `<org>-<product>`, so the
// default now drops a leading origin prefix instead of restating it.
//
// This was the last of the four things the slug derives that had no override,
// and the only one that came out wrong — see the identity note at the top of
// model/sdkgen.aon.
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
// Publication state of a target's package registry, tri-state + tag-only:
//   'tag'      — no registry (the go family); resolved from the git tag.
//   'pending'  — registry declared but the package is not uploaded yet
//                (the fleet default): install from the git tag.
//   'active'   — package is live on the registry: show the real install cmd.
//   'inactive' — registry deliberately disabled (tag-only, like pending).
// Reads main.kit.target.<t>.publish.registry.state (default 'pending').
// The legacy boolean `registry.active: true` is honoured as a back-compat
// alias for state === 'active'.
function registryState(model, target) {
    // Tag-only is a property of the Go toolchain, not of one target name, so
    // an aliased `go~go2` must be tag-only too.
    const eco = originName(model, target);
    if ('go' === eco || 'go-cli' === eco || 'go-mcp' === eco)
        return 'tag';
    const reg = model?.main?.[apidef_1.KIT]?.target?.[target]?.publish?.registry;
    if (null == reg || '' === (reg.name || ''))
        return 'tag';
    if (true === reg.active)
        return 'active'; // legacy alias
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
// pointer carrying the releases URL.
function vendorCommand(model, target) {
    const { releasesUrl } = repoInfo(model);
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
            return `not yet on ${reg || 'the registry'} — install from the git tag: ${releasesUrl}`;
        }
    }
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
    // A target may name its published package outright — the escape hatch for a
    // project whose registry name is not what the slug derives, and which cannot
    // rename the slug without renaming its SDK classes:
    //
    //   main: kit: target: ts: publish: registry: package: '@acme/legacy-client'
    //
    // The key already existed in the schema ("registry package name ('' ->
    // derived)") and was simply never read. Keyed by TARGET, so the ecosystem
    // aliases ('npm', 'pypi', ...) resolve to the target that publishes to them.
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
        // The notebook/analyst package layered on `py`. Distinct PyPI name so it
        // can version and publish independently of the SDK it wraps.
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
    // WHICH package manager is the language's business, so the switch follows
    // the origin; WHICH package name is this target's own, so every arm passes
    // `target` rather than a hardcoded ecosystem key. Before, an aliased
    // `ts~ts2` matched no case and returned '' — a README with an empty install
    // line — and even had it matched, `packageName(model, 'npm')` would have
    // printed the ORIGIN's package.
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
// The standard one-line package description (with the generic non-affiliation
// statement inline) used in every manifest.
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
// WHO WROTE THE PACKAGE — `main: kit: author` / `main: kit: contributor`.
//
// Attribution cannot be derived: it is not a function of the slug, the repo or
// the API. And because generated output is OVERWRITTEN, a name hand-edited
// into a manifest is deleted by the next regeneration — silently, because no
// build step can tell that a person is missing. The seneca-provider target
// dropped a hand-written provider's author and both its named contributors
// exactly that way. So attribution is declared in the model and read here.
//
// An unset author is the PUBLISHER, which is what every generated SDK manifest
// has always carried (Package_ts hardcoded it); a project that has never
// thought about authorship keeps the previous behaviour.
//
// PER TARGET, falling back to the model-wide value. One model can produce
// packages with different authors: the SDK is a generated artefact of the
// publisher, while a Seneca provider is an independently released package with
// its own human maintainers. A single model-wide name cannot be right for
// both — and it was not: the solardemo model named a person, the target that
// read it credited them, and the SDK's own manifest went on saying Voxgig
// because it read nothing at all.
//
//   main: kit: author: { ... }                    # every package from this model
//   main: kit: target: ts: author: { ... }        # ...except this one
function authorInfo(model, target) {
    const perTarget = null == target ? null :
        model?.main?.[apidef_1.KIT]?.target?.[target]?.author;
    const declared = (null != perTarget && '' !== (perTarget.name || '')) ?
        perTarget : (model?.main?.[apidef_1.KIT]?.author || {});
    const name = null != declared.name && '' !== declared.name ?
        String(declared.name) : PUBLISHER;
    // A declared author with no url gets none — inventing PUBLISHER_URL for a
    // named human would credit them to Voxgig's homepage.
    const url = null != declared.url && '' !== declared.url ? String(declared.url) :
        (PUBLISHER === name ? PUBLISHER_URL : '');
    return { name, url };
}
// Contributors, in sorted-key order so the manifest is byte-stable. `each`
// rather than Object.keys: the model is an aontu map and carries metadata
// keys alongside its entries.
//
// An entry with no name is DROPPED rather than rendered as `{}` — the schema
// makes `name` required, but a partially-unified model can still reach here
// during a dry run.
function contributorList(model) {
    return (0, jostraca_1.each)(model?.main?.[apidef_1.KIT]?.contributor || {})
        .filter((c) => null != c && null != c.name && '' !== c.name)
        .map((c) => ({
        name: String(c.name),
        url: null != c.url && '' !== c.url ? String(c.url) : '',
    }));
}
// A VALID uppercase env-var token: 'unsolicited-advice' -> 'UNSOLICITED_ADVICE'.
//
// THE ONLY WAY to build an env-var name segment. There used to be three
// spellings of this in the components — `envToken(name)`,
// `nom(x, 'NAME')` (the camel form uppercased, which SWALLOWS the hyphen) and
// `x.name.toUpperCase().replace(...)` — and they agree only while the name has
// no hyphen in it. A slug like `voxgig-solardemo` produced both
// `VOXGIG_SOLARDEMO_TEST_LIVE` and `VOXGIGSOLARDEMO_TEST_LIVE` in the SAME
// generated SDK: `test/utility.ts` read one, `PlanetEntity.test.ts` the other,
// so setting either sent half the suite live and left the rest mocked — with
// the suite reporting green either way.
function envToken(name) {
    return String(name || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
// The env-var base for this SDK: <NAME>_APIKEY, <NAME>_TEST_LIVE, ...
function envName(model) {
    return envToken(model.name);
}
//# sourceMappingURL=packageMeta.js.map