// THE MODEL RULES A PACKAGE'S `.aon` FILES MUST SATISFY.
//
// See docs/design/sdkgen-packages.md §10 (the rules) and §14 (the battery).
//
// WHY THIS IS A MODULE AND NOT A TEST
//
// Every rule below was already enforced — on the BUNDLED scaffold only, and
// from inside `ts/test/model-compile.test.ts`, where nothing else can call
// it. `package check` has to apply the same rules to a package this
// generator has never seen, and a rule written twice diverges: this
// workstream has produced that exact defect five times (path refs, replace
// maps, provenance reconstruction, the tilde parse, the installed-registry
// call). So the rules move here and BOTH callers read them — the guard suite
// over `ts/project`, which is itself an sdkgen package, and the verb.
//
// WHAT MAKES A MODEL FILE WRONG
//
// Three failure modes, and they surface at three different times, which is
// why all three are checked:
//
//   1. It does not PARSE under the parser a consumer actually uses. Aontu
//      takes `#` comments; the npm engine's jsonic enables `//` and `/* */`
//      by default and `@voxgig/model` switches them back off, so a `//` line
//      compiles here and fails in the consumer's build. Seven shipped
//      targets went out broken that way.
//   2. It parses but does not UNIFY with the base schema — a missing
//      non-defaulted key (`ext`, `comment.line`, `module.name`, a feature's
//      `title`). The file alone is fine, so nothing at add time notices; the
//      consumer's whole model compile is what fails.
//   3. It unifies but PINS a key the project owns (`publish.version`,
//      `publish.registry.package`). Concrete-vs-concrete is a conflict in
//      aontu, so the project cannot override it — and the failure names the
//      project's own file, not the package's.

import { Aontu } from 'aontu'

import { schemaFile } from './shipped'


// The provenance anchor. The literal line a shipped definition carries so the
// stamp has somewhere to hang (helpers/stdrep), and therefore the one thing
// a package's definition must not lose.
const ANCHOR = "base: 'BASE'"


// Matched as a WHOLE LINE, never as a substring — the same rule doctor
// learned the hard way (see AGENTS.md, "Provenance is matched by EXACT LINE").
//
// `database: 'BASE'` contains the anchor text, and so does a comment
// mentioning it. Either would satisfy a substring test while leaving the
// definition with no anchor of its own: the stamp then rewrites that
// unrelated occurrence, the item records no usable `base`, and `doctor` and
// `package update` can never locate its source — with `package check` having
// reported the file as fine.
const ANCHOR_RE = /^[ \t]*base: 'BASE'[ \t]*$/m


// An aontu map key that is safe unquoted. Everything else — a hyphen
// (`go-cli`), a dot (`go.v2`), a leading digit (`2go`) — has to be quoted or
// the file does not parse, and the ITEM name grammar admits all three.
const BARE_KEY_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/


// The key as it must be WRITTEN in a model file.
function aontuKey(name: string): string {
  return BARE_KEY_RE.test(name) ? name : "'" + name + "'"
}


// Blank out quoted spans before looking for comment markers, so a `//` inside
// a string — a url, or the `comment: line: '//'` every C-family target model
// legitimately declares — is not mistaken for a comment.
function unquoted(line: string): string {
  return line.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '')
}


// What the PARSER sees on this line: quoted spans blanked, then everything
// from the first `#` dropped.
//
// Both steps, in that order. Without the second, a perfectly valid comment
// that happens to mention the token — `# some languages use // comments` —
// is reported as a parse error and the CLI exits non-zero on a correct
// package. Without the first, a `#` inside a string would truncate the line
// early and hide a real `//` after it.
function code(line: string): string {
  return unquoted(line).split('#')[0]
}


// Every line carrying a slash comment, 1-based, as a consumer's parser would
// see it.
function slashComments(text: string): { line: number, text: string }[] {
  const found: { line: number, text: string }[] = []

  String(text).split('\n').forEach((line: string, i: number) => {
    if (/(^|\s)(\/\/|\/\*)/.test(code(line))) {
      found.push({ line: i + 1, text: line.trim() })
    }
  })

  return found
}


// An Aontu configured the way `@voxgig/model` configures it — which is what
// actually compiles a consumer's models. A plain `new Aontu()` accepts `//`
// and `/* */`; the Go engine has no such extension, so the npm build switches
// them off to match, and this must too or the check is checking a parser
// nobody runs.
//
// A FRESH INSTANCE each time: the option call mutates the instance's jsonic,
// so a cached one would leak its configuration into the bare compile that is
// deliberately paired with it.
function strictAontu(): any {
  const aontu: any = new Aontu()
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
}


// aontu reports a resolution problem through the `errs` collector and THROWS
// a parse problem, so both routes have to be handled or the interesting
// failure escapes as an opaque AontuError. Its message carries a source
// excerpt with ANSI colouring and line numbers that refer to the text
// COMPILED, which is not the file on disk once a schema include is prepended
// — so the excerpt is cut and only the diagnosis is kept.
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


// Compile one model file's TEXT.
//
//   strict: under the parser @voxgig/model configures (the consumer's
//           reality) rather than a bare Aontu().
//   schema: unified with the base schema, which is what makes a missing
//           non-defaulted key a failure instead of an absent key nobody
//           notices until the consumer compiles.
//
// `path` must be the file's real path even when the text is synthesised:
// aontu resolves includes relative to it, and stats it.
function compileModel(
  src: string,
  path: string,
  opts?: { strict?: boolean, schema?: boolean },
): CompileResult {
  // `errs`, NOT `err`. They are different options with opposite behaviour:
  //
  //   errs — aontu THROWS on the first problem it cannot resolve.
  //   err  — aontu COLLECTS problems and returns no model, which sounds
  //          better and is not: a PARSE problem is then swallowed entirely.
  //          `// nope` under the strict parser yields a model and an EMPTY
  //          collector, and a slash comment is the single most common thing
  //          this check exists to catch.
  //
  // So the throw is the signal, and it is caught below. The collector is
  // still passed and still read: it costs nothing, and an aontu that one day
  // collects instead of throwing must not report "no errors" here.
  const errs: any[] = []

  const text = true === opts?.schema ?
    includeLine(schemaFile()) + '\n' + src : src

  try {
    const aontu = false === opts?.strict ? new Aontu() : strictAontu()
    const model = aontu.generate(text, { path, errs })

    return {
      model,
      errors: errs.map((e: any) =>
        tidy((null == e.why ? '' : '[' + e.why + '] ') + (e.msg ?? String(e)))),
    }
  }
  catch (err: any) {
    return { errors: [tidy(err.message ?? String(err))] }
  }
}


// Every key the schema DEFAULTS and a project therefore expects to set, with
// TWO values to try setting it to. A target model that declares any of them
// makes the project's own declaration a concrete-vs-concrete conflict — which
// fails the consumer's entire model compile, naming the consumer's file.
//
// Two values because aontu unifies two EQUAL concrete scalars happily: a
// target pinning `publish: tag: active: false` — which is one of only two
// values that key can take — passed a single-sentinel probe while still
// making `true` impossible for the consumer. One alternative value per key is
// enough: a pin can equal one sentinel or the other, never both.
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
