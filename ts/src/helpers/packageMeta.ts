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

import { each } from 'jostraca'

import { KIT, nom } from '@voxgig/apidef'

const PUBLISHER = 'Voxgig'
const PUBLISHER_URL = 'https://voxgig.com'
const SECURITY_EMAIL = 'security@voxgig.com'
const GENERATOR_URL = 'https://github.com/voxgig/sdkgen'

const LANG_LABEL: Record<string, string> = {
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
}

function langLabel(target: string): string {
  return LANG_LABEL[target] || target
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
function repoInfo(model: any) {
  const slug = model.name
  const origin = model.origin || 'voxgig-sdk'

  const declared = (model && model.main && model.main[KIT] && model.main[KIT].repo) || {}

  const host = '' === (declared.host || '') ? 'github.com' : (declared.host || 'github.com')
  const path = '' === (declared.path || '') ? `${origin}/${slug}-sdk` : String(declared.path)

  // Last segment is the repo; everything before it is the org (which may
  // itself contain slashes on hosts that allow subgroups, e.g. GitLab).
  const seg = path.split('/')
  const repo = seg[seg.length - 1]

  const repoUrl = `https://${host}/${path}`

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
  }
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
function goModule(model: any, target: string): string {
  const declared = model?.main?.[KIT]?.target?.[target]?.module?.path
  if (null != declared && '' !== declared) {
    return String(declared)
  }

  const { host, path } = repoInfo(model)
  return `${host}/${path}/${target}`
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
function packageVersion(model: any, target: string): string {
  const declared = model?.main?.[KIT]?.target?.[target]?.publish?.version
  return null != declared && '' !== declared ? String(declared) : '0.0.1'
}


// The Go language version for a go-family target's go.mod.
//
//   main: kit: target: go: module: goversion: '1.23'
//
// Defaults to 1.21, the release that introduced `log/slog` — which sdkgen's
// own `log` feature template imports. The previous hardcoded `go 1.20` meant a
// generated SDK could not compile the feature source sdkgen had just written
// into it.
function goVersion(model: any, target: string, fallback?: string): string {
  const declared = model?.main?.[KIT]?.target?.[target]?.module?.goversion
  if (null != declared && '' !== declared) {
    return String(declared)
  }
  return fallback || '1.21'
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
// model/sdkgen.aontu.
function goPackageIdent(model: any, target: string): string {
  const declared = model?.main?.[KIT]?.target?.[target]?.module?.package
  if (null != declared && '' !== declared) {
    return String(declared)
  }

  const ident = (s: string) => String(s || '').replace(/[^a-z0-9]/gi, '').toLowerCase()

  const org = ident((model.origin || 'voxgig-sdk').replace(/-sdk$/, ''))
  let slug = ident(model.name)

  if ('' !== org && slug.startsWith(org)) {
    slug = slug.slice(org.length)
  }

  return org + slug + 'sdk'
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
function registryState(model: any, target: string): 'tag' | 'pending' | 'active' | 'inactive' {
  if ('go' === target || 'go-cli' === target || 'go-mcp' === target) return 'tag'
  const reg = model?.main?.[KIT]?.target?.[target]?.publish?.registry
  if (null == reg || '' === (reg.name || '')) return 'tag'
  if (true === reg.active) return 'active' // legacy alias
  const s = reg.state
  if ('active' === s || 'inactive' === s || 'pending' === s) return s
  return 'pending'
}

// True only when the package is actually live on its registry (so a README
// may print the real `npm install`/`pip install`/... command). Everything
// else — pending, inactive, tag-only — installs from the git tag instead.
function isPublished(model: any, target: string): boolean {
  return 'active' === registryState(model, target)
}

// The registry a target uploads to (npm | pypi | packagist | ...), or ''
// for tag-only ports. Used in the "not yet on <registry>" pending message.
function registryName(model: any, target: string): string {
  const reg = model?.main?.[KIT]?.target?.[target]?.publish?.registry
  return (reg && reg.name) ? String(reg.name) : ''
}

// The vendor / git-tag install pointer for a NOT-yet-published target. For
// the go family this is the canonical install (`go get <module>@latest`,
// which the Go proxy resolves from the `<subdir>/vX.Y.Z` tag). For registry
// ports it is a short "not yet on <registry> — install from the git tag"
// pointer carrying the releases URL.
function vendorCommand(model: any, target: string): string {
  const { releasesUrl } = repoInfo(model)
  switch (target) {
    case 'go':
      return `go get ${packageName(model, 'go')}@latest`
    case 'go-mcp':
      return `go get ${packageName(model, 'go-mcp')}@latest`
    case 'go-cli':
      return `go install ${packageName(model, 'go-cli')}/cmd/${model.name}@latest`
    default: {
      const reg = registryName(model, target)
      return `not yet on ${reg || 'the registry'} — install from the git tag: ${releasesUrl}`
    }
  }
}

// API display name for descriptions, e.g. "Aare.guru". Uses the OpenAPI
// info.title (present for ~98% of the fleet), stripping a trailing " API" so
// we don't render "... Aare.guru API public API". Falls back to the normalised
// SDK Name, then the slug.
function apiName(model: any): string {
  const info = (model.main && model.main[KIT] && model.main[KIT].info) || {}
  const raw = (null != info.title ? String(info.title) : '').trim()
  const stripped = raw.replace(/\s*API\s*$/i, '').trim()
  return stripped || nom(model, 'Name') || model.name
}

// The REAL published package name per ecosystem — mirrors the exact formula in
// each Package_<lang>.ts. This is the one canonical implementation.
function packageName(model: any, eco: string): string {
  const slug = model.name
  const origin = model.origin || 'voxgig-sdk'
  const base = origin.endsWith('-sdk') ? slug : `${slug}-sdk`
  const npmScoped = `@${origin}/${slug}${origin.endsWith('-sdk') ? '' : '-sdk'}`

  // A target may name its published package outright — the escape hatch for a
  // project whose registry name is not what the slug derives, and which cannot
  // rename the slug without renaming its SDK classes:
  //
  //   main: kit: target: ts: publish: registry: package: '@acme/legacy-client'
  //
  // The key already existed in the schema ("registry package name ('' ->
  // derived)") and was simply never read. Keyed by TARGET, so the ecosystem
  // aliases ('npm', 'pypi', ...) resolve to the target that publishes to them.
  const ECO_TARGET: Record<string, string> = {
    npm: 'ts', pypi: 'py', gem: 'rb', luarocks: 'lua', composer: 'php',
  }
  const declared = model?.main?.[KIT]?.target?.[ECO_TARGET[eco] || eco]
    ?.publish?.registry?.package
  if (null != declared && '' !== declared) {
    return String(declared)
  }

  switch (eco) {
    case 'npm':
    case 'ts':
      return npmScoped
    case 'js':
      return `${npmScoped}-js`
    case 'pypi':
    case 'py':
    case 'gem':
    case 'rb':
    case 'luarocks':
    case 'lua':
      return `${origin}-${base}`
    case 'composer':
    case 'php':
      return `${origin}/${base}`
    case 'go':
      return goModule(model, 'go')
    case 'go-cli':
      return goModule(model, 'go-cli')
    case 'go-mcp':
      return goModule(model, 'go-mcp')
    // The notebook/analyst package layered on `py`. Distinct PyPI name so it
    // can version and publish independently of the SDK it wraps.
    case 'py-data':
      return `${origin}-${base}-data`
    default:
      return `${origin}-${base}`
  }
}

// Copy-paste install command for a target, using the REAL package name.
// Only a package that is actually live on its registry (isPublished) gets a
// registry install command; everything else (pending / inactive / tag-only,
// including the whole go family) returns the git-tag vendor command instead,
// so a README never prints a `npm install ...` that 404s.
function installCommand(model: any, target: string): string {
  if (!isPublished(model, target)) {
    return vendorCommand(model, target)
  }
  switch (target) {
    case 'ts':
      return `npm install ${packageName(model, 'npm')}`
    case 'js':
      return `npm install ${packageName(model, 'js')}`
    case 'py':
      return `pip install ${packageName(model, 'pypi')}`
    case 'py-data':
      return `pip install ${packageName(model, 'py-data')}`
    case 'php':
      return `composer require ${packageName(model, 'composer')}`
    case 'rb':
      return `gem install ${packageName(model, 'gem')}`
    case 'lua':
      return `luarocks install ${packageName(model, 'luarocks')}`
    case 'go':
      return `go get ${packageName(model, 'go')}`
    case 'go-cli':
      return `go install ${packageName(model, 'go-cli')}/cmd/${model.name}@latest`
    default:
      return ''
  }
}

// The standard one-line package description (with the generic non-affiliation
// statement inline) used in every manifest.
function pkgDescription(model: any, target: string): string {
  return `Unofficial generated ${langLabel(target)} SDK for the ${apiName(model)} public API.` +
    ` Not affiliated with or endorsed by the upstream API provider.`
}

// Longer non-affiliation / generated-code disclosure for READMEs, LICENSE and
// SECURITY.md. Generic on the upstream owner (owner names are only ~45%
// reliably known across the fleet).
function nonAffiliation(model: any): string {
  return `This is an unofficial SDK for the ${apiName(model)} public API, generated by ` +
    `${PUBLISHER} with [\`@voxgig/sdkgen\`](${GENERATOR_URL}). ` +
    `It is not affiliated with, endorsed by, or sponsored by the upstream API provider.`
}

function keywords(model: any): string[] {
  return ['voxgig', 'sdk', 'generated-sdk', 'openapi', 'api-client', model.name]
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
function authorInfo(model: any): { name: string, url: string } {
  const declared = model?.main?.[KIT]?.author || {}

  const name = null != declared.name && '' !== declared.name ?
    String(declared.name) : PUBLISHER

  // A declared author with no url gets none — inventing PUBLISHER_URL for a
  // named human would credit them to Voxgig's homepage.
  const url = null != declared.url && '' !== declared.url ? String(declared.url) :
    (PUBLISHER === name ? PUBLISHER_URL : '')

  return { name, url }
}


// Contributors, in sorted-key order so the manifest is byte-stable. `each`
// rather than Object.keys: the model is an aontu map and carries metadata
// keys alongside its entries.
//
// An entry with no name is DROPPED rather than rendered as `{}` — the schema
// makes `name` required, but a partially-unified model can still reach here
// during a dry run.
function contributorList(model: any): { name: string, url: string }[] {
  return each(model?.main?.[KIT]?.contributor || {})
    .filter((c: any) => null != c && null != c.name && '' !== c.name)
    .map((c: any) => ({
      name: String(c.name),
      url: null != c.url && '' !== c.url ? String(c.url) : '',
    }))
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
function envToken(name: any): string {
  return String(name || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}


// The env-var base for this SDK: <NAME>_APIKEY, <NAME>_TEST_LIVE, ...
function envName(model: any): string {
  return envToken(model.name)
}

export {
  PUBLISHER,
  PUBLISHER_URL,
  SECURITY_EMAIL,
  GENERATOR_URL,
  LANG_LABEL,
  langLabel,
  repoInfo,
  apiName,
  packageName,
  installCommand,
  registryState,
  isPublished,
  registryName,
  vendorCommand,
  pkgDescription,
  nonAffiliation,
  keywords,
  authorInfo,
  contributorList,
  envName,
  envToken,
  goModule,
  goVersion,
  goPackageIdent,
  packageVersion,
}
