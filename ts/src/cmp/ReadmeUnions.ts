import { each, Content } from 'jostraca'
import { cmp } from '../helpers/component'

import {
  KIT,
  getModelPath
} from '../types'

import { CANON_UNION_JOIN } from '../helpers/canonType'
import { originName } from '../helpers/packageMeta'


const MIN_REPORTED_BRANCHES = 3


const ReadmeUnions = cmp(function ReadmeUnions(props: any) {
  const { ctx$, target } = props
  const { model } = ctx$

  // Where a language cannot join a union's branches, a two-variant field is
  // an open value too, though it is below the table's threshold.
  const joins = null != (CANON_UNION_JOIN as any)[originName(model, target?.name)]

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
        field: field.n,
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
${joins ? 'Every other field is typed normally.' :
    'A field with two variants is an open value here too; every other field is\ntyped normally.'}
`)
})


export {
  ReadmeUnions,
  MIN_REPORTED_BRANCHES,
}
