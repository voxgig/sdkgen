// VENDORED: @voxgig/plugin 0.2.0 (typescript/src/Resolve.ts)
// Source: https://github.com/voxgig/plugin @ caa404b2dfa206d77db6c2869e5b31c2a3202b2d  [tag: sdk-20261016-0845-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.

export type Source =
  | { kind: 'module', prefix?: string[] }
  | { kind: 'path', dir: string }

export function resolvecandidates(name: string, sources?: Source[]): string[] {
  const out: string[] = []

  // A SCOPED NAME RESOLVES VERBATIM ONLY (§10.2). `@acme/thing` is
  // already a package id; prefixing it produces
  // `@voxgig/plugin-@acme/thing`, which is not a thing that can exist.
  if (name.startsWith('@')) return [name]

  const list = sources && 0 < sources.length ? sources : DEFAULT_SOURCES

  for (const src of list) {
    if ('module' === src.kind) {
      const prefixes = src.prefix && 0 < src.prefix.length ? src.prefix : ['']
      for (const p of prefixes) {
        const id = p + name
        if (-1 === out.indexOf(id)) out.push(id)
      }
    }
    else if ('path' === src.kind) {
      const id = src.dir.replace(/\/+$/, '') + '/' + name
      if (-1 === out.indexOf(id)) out.push(id)
    }
  }

  return out
}

const DEFAULT_SOURCES: Source[] = [
  { kind: 'module', prefix: ['@voxgig/plugin-', 'voxgig-plugin-', 'plugin-', ''] },
]

export function resolvefrom(from: string): string[] {
  return [from]
}
