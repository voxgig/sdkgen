import { cmp, each, Content } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'


// Fields whose type could not be narrowed because the API definition describes
// them with an UNTAGGED union: `oneOf`/`anyOf` branches carrying no
// `discriminator`, so the specification never states which variant a given
// value is. apidef records the widest such union it finds beneath each field
// (see ModelField.union); this section reports them.
//
// Without this, those fields read as a modelling failure — a `groups` field
// typed as a bare array looks like the generator gave up, when in fact the
// definition offers nothing to narrow it to. Saying so is the difference
// between an SDK that looks unfinished and one that documents the API it was
// given.
//
// Two-branch unions are NOT reported: `oneOf: [string, number]` is a routine
// either/or, an open type for it surprises nobody, and listing every one would
// bury the cases that matter.
const MIN_REPORTED_BRANCHES = 3


const ReadmeUnions = cmp(function ReadmeUnions(props: any) {
  const { ctx$ } = props
  const { model } = ctx$

  const entity = getModelPath(model, `main.${KIT}.entity`)

  const rows: { entity: string, field: string, branches: number, depth: number }[] = []

  each(entity, (ent: any) => {
    if (false === ent.active) {
      return
    }
    each(ent.fields, (field: any) => {
      const union = field?.union
      if (null == union || union.branches < MIN_REPORTED_BRANCHES) {
        return
      }
      rows.push({
        entity: ent.name,
        field: field.name,
        branches: union.branches,
        depth: union.depth,
      })
    })
  })

  if (0 === rows.length) {
    return
  }

  // Widest first: the worst offender is the one a reader needs to see.
  rows.sort((a, b) => b.branches - a.branches || a.entity.localeCompare(b.entity) ||
    a.field.localeCompare(b.field))

  const plural = 1 === rows.length ? 'field is' : 'fields are'

  Content(`
## Open types

${rows.length} ${plural} carried as open values rather than typed structures.
This follows from the API definition, not from a gap in this SDK: the
definition describes ${1 === rows.length ? 'it' : 'them'} with untagged unions —
\`oneOf\`/\`anyOf\` branches with no \`discriminator\` — so it never states which
variant a given value is. Nothing can select a branch reliably, so the SDK
passes the value through unchanged rather than assert a shape the API does not
guarantee.

| Entity | Field | Variants | Nesting |
| --- | --- | --- | --- |
${rows.map((r) =>
    `| \`${r.entity}\` | \`${r.field}\` | ${r.branches} | ` +
    `${r.depth} ${1 === r.depth ? 'level' : 'levels'} |`).join('\n')}

These values round-trip unchanged — read them, modify them, send them back. If
the API adds a \`discriminator\` to the definition, regenerating will type them.
Every other field is typed normally.
`)
})


export {
  ReadmeUnions,
  MIN_REPORTED_BRANCHES,
}
