// Replacement keys the GENERATOR owns, merged into the project's `ctx$.stdrep`.
//
// `stdrep` itself is built by the consumer's `Root.ts`
// (`names(ctx$.stdrep, model.Name, 'ProjectName')`), which lives outside this
// package and is frozen at project-init time — so a new placeholder cannot be
// added there without every existing project resyncing its root wiring. These
// are added here instead, immediately before the templates that use them are
// copied, so an old project gets them without touching its scaffold.

import { envName, packageVersion } from './packageMeta'


// PROJECTENV — the env-var base for this SDK's `<BASE>_TEST_LIVE`,
// `<BASE>_APIKEY` and friends.
//
// NOT `PROJECTNAME`. That one is the camel-cased class name uppercased, which
// SWALLOWS a hyphen: `voxgig-solardemo` becomes `VOXGIGSOLARDEMO`, while every
// component-generated env var reads `VOXGIG_SOLARDEMO`. Both spellings used to
// reach the same generated SDK — `test/utility.ts` (a template) read one and
// `PlanetEntity.test.ts` (a component) the other — so setting either variable
// sent half the suite live and left the rest mocked, green either way.
function ensureStdrep(ctx$: any): any {
  const stdrep = ctx$.stdrep = (ctx$.stdrep || {})

  if (null == stdrep.PROJECTENV) {
    stdrep.PROJECTENV = envName(ctx$.model)
  }

  return stdrep
}


// The substitutions `target add` applies when it copies a target's TEMPLATE
// tree (tm/<t>).
//
// ONE definition, because two consumers must agree exactly: `target add`
// writes the files, and `doctor` re-applies these to the scaffold before
// comparing, to tell a substitution artefact from a real hand-edit. When
// PROJECTVERSION was added to the writer alone, every project's VERSION file
// immediately read as an edited master.
function templateReplacements(model: any, tname: string): Record<string, string> {
  return {
    ProjectName: model?.const?.Name,

    // The port's release version, read by its Makefile to build the
    // `<target>/v<version>` tag. It comes from the same model field the
    // generated manifest uses, so the tag and the package cannot disagree.
    PROJECTVERSION: packageVersion(model, tname),
  }
}


// PROVENANCE — where a copied target or feature came from.
//
// Every shipped model file carries a `base: 'BASE'` line as an ANCHOR, and
// the add actions rewrite that one line into the block the copy keeps:
//
//   base: 'BASE'   ->   base: 'node_modules/@acme/sdkgen-iot/.sdk'
//                       origname: 'iot-go'
//
// The anchor is why every shipped model needs the line even though most
// installs are unaliased from the bundled scaffold: a `replace` map can only
// rewrite text that is already there, and there is nowhere else to hang the
// keys that do not appear in the source.
//
// ONE definition, for the same reason templateReplacements is one: `target
// add` and `feature add` WRITE with this map and `doctor` re-applies it to
// the scaffold before comparing. A writer and a reader that disagree by a
// single character make every project read as forked.
//
// `origname` and `package` are emitted only when they apply, so an ordinary
// install still records exactly one line and its model file is unchanged
// from what earlier versions wrote — apart from the base value itself.
type Provenance = {
  // The `.sdk` folder the copy came from, project-relative and
  // '/'-normalised (see resolveTarget).
  base: string

  // The name in the SOURCE and the name it was INSTALLED as. Equal for an
  // ordinary add; different for `target add go~go2`.
  origname?: string
  name?: string

  // The sdkgen package that provided it, when the source declared one.
  package?: string
}

// Two spaces, matching every shipped model file's indentation for these keys.
const PROVENANCE_INDENT = '  '


// A value as a single-quoted aontu string. These are PATHS and NAMES from the
// filesystem, so they can legally contain a quote — `/home/o'connor/pkg` is a
// valid directory — and concatenating one between quotes closes the string
// early and leaves the copied model unparsable. Aontu accepts a backslash
// escape, which keeps the quoting style every shipped model already uses.
function aontuString(value: string): string {
  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
}


function provenanceReplace(prov: Provenance): Record<string, string> {
  const lines = ['base: ' + aontuString(prov.base)]

  if (null != prov.origname && null != prov.name &&
    prov.origname !== prov.name) {
    lines.push('origname: ' + aontuString(prov.origname))
  }

  if (null != prov.package && '' !== prov.package) {
    lines.push('package: ' + aontuString(prov.package))
  }

  return { "base: 'BASE'": lines.join('\n' + PROVENANCE_INDENT) }
}


export type {
  Provenance,
}

export {
  ensureStdrep,
  templateReplacements,
  provenanceReplace,
}
