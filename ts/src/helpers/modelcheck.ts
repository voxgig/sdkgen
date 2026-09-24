
import { Aontu } from 'aontu'
import { createRequire } from 'node:module'
import Path from 'node:path'

import { schemaFile } from './shipped'


// The provenance anchor. The literal line a shipped definition carries so the
// stamp has somewhere to hang (helpers/stdrep), and therefore the one thing
// a package's definition must not lose.
const ANCHOR = "base: 'BASE'"


const ANCHOR_RE = /^[ \t]*base: 'BASE'[ \t]*$/m


// An aontu map key that is safe unquoted. Everything else — a hyphen
// (`go-cli`), a dot (`go.v2`), a leading digit (`2go`) — has to be quoted or
// the file does not parse, and the ITEM name grammar admits all three.
const BARE_KEY_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/


function aontuKey(name: string): string {
  return BARE_KEY_RE.test(name) ? name : "'" + name + "'"
}


function unquoted(line: string): string {
  return line.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '')
}


function code(line: string): string {
  return unquoted(line).split('#')[0]
}


function slashComments(text: string): { line: number, text: string }[] {
  const found: { line: number, text: string }[] = []

  String(text).split('\n').forEach((line: string, i: number) => {
    if (/(^|\s)(\/\/|\/\*)/.test(code(line))) {
      found.push({ line: i + 1, text: line.trim() })
    }
  })

  return found
}


function strictAontu(options?: any): any {
  const aontu: any = new Aontu(options)
  aontu.lang.jsonic.options({ comment: { def: { slash: null, multi: null } } })
  return aontu
}


// An `@` include line for a path, quoted so a path containing a quote or a
// backslash — a Windows path, or the pathological ones the provenance tests
// exercise — cannot end the string early.
function includeLine(file: string): string {
  return "@'" + String(file).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
}


type CompileResult = {
  model?: any
  errors: string[]

  // aontu's code for each error that carries one, such as
  // `multisource_not_found` for an include that did not resolve.
  why: string[]
}


function tidy(msg: string): string {
  const lines = String(msg)
    .replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", 'g'), '')
    .split('\n')

  const cut = lines.findIndex((l: string) => /^\s*-->/.test(l))

  return (cut < 0 ? lines : lines.slice(0, cut))
    .map((l: string) => l.trim())
    .filter((l: string) => '' !== l)
    .join(' ')
}


function compileModel(
  src: string,
  path: string,
  opts?: { strict?: boolean, schema?: boolean },
): CompileResult {
  const errs: any[] = []

  const text = true === opts?.schema ?
    includeLine(schemaFile()) + '\n' + src : src

  try {
    const localRequire = Object.assign(createRequire(Path.resolve(path)), { main: require.main })
    const options: any = { require: localRequire }
    const aontu = false === opts?.strict ? new Aontu(options) : strictAontu(options)
    const model = aontu.generate(text, { path, errs })

    return {
      model,
      errors: errs.map((e: any) =>
        tidy((null == e.why ? '' : '[' + e.why + '] ') + (e.msg ?? String(e)))),
      why: whyOf(errs),
    }
  }
  catch (err: any) {
    return {
      errors: [tidy(err.message ?? String(err))],
      why: whyOf('function' === typeof err?.errs ? err.errs() : []),
    }
  }
}


function whyOf(errs: any[]): string[] {
  return errs.map((e: any) => e?.why).filter((w: any) => 'string' === typeof w)
}


const PUBLISH_OVERRIDES: [string, string, string][] = [
  ['publish: version', "'9.9.9'", "'8.8.8'"],
  ['publish: tag: active', 'false', 'true'],
  ['publish: registry: state', "'active'", "'inactive'"],
  ['publish: registry: active', 'true', 'false'],
  ['publish: registry: package', "'@acme/pinned'", "'@acme/other'"],
]


// The probe: unify the target model with a project that sets each of them,
// once per sentinel set. EITHER conflicting means the key is pinned.
function publishOverrideProbe(
  src: string, path: string, tname: string,
): CompileResult {
  const key = aontuKey(tname)

  const run = (pick: (o: [string, string, string]) => string): CompileResult =>
    compileModel(
      [src, ...PUBLISH_OVERRIDES.map(
        (o) => 'main: kit: target: ' + key + ': ' + o[0] + ': ' + pick(o))]
        .join('\n'),
      path)

  const first = run((o) => o[1])
  const second = run((o) => o[2])

  return {
    model: first.model ?? second.model,
    errors: [...first.errors, ...second.errors],
    why: [...first.why, ...second.why],
  }
}


export type {
  CompileResult,
}

export {
  ANCHOR,
  ANCHOR_RE,
  PUBLISH_OVERRIDES,
  aontuKey,
  compileModel,
  includeLine,
  publishOverrideProbe,
  slashComments,
  strictAontu,
  unquoted,
}
