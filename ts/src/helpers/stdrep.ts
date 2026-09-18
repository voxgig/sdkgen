
import { envName, packageVersion } from './packageMeta'


function ensureStdrep(ctx$: any): any {
  const stdrep = ctx$.stdrep = (ctx$.stdrep || {})

  if (null == stdrep.PROJECTENV) {
    stdrep.PROJECTENV = envName(ctx$.model)
  }

  return stdrep
}


function templateReplacements(model: any, tname: string): Record<string, string> {
  return {
    ProjectName: model?.const?.Name,

    // The port's release version, read by its Makefile to build the
    // `<target>/v<version>` tag. It comes from the same model field the
    // generated manifest uses, so the tag and the package cannot disagree.
    PROJECTVERSION: packageVersion(model, tname),
  }
}


type Provenance = {
  base: string

  origname?: string
  name?: string

  package?: string
}

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
