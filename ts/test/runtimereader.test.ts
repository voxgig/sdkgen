// Every forms file, ported or not, reads its runtime: the operations, the load
// declaration and its result style, the record accessor, the public client and
// entity members, and the field types. SDKGEN_RUNTIME_TABLE=<path> writes what
// it read, one section per language, for a porter to write facts from.

import { describe, test } from 'node:test'
import { ok, deepStrictEqual } from 'node:assert'
import * as Fs from 'node:fs'
import * as Path from 'node:path'

import type { Forms, View } from './runtimeforms/forms'
import { OPS, esc, findDecls, read, view } from './runtimeforms/forms'
import { FORMS_SRC, FRAMEWORK } from './runtimeforms/guard'

const { CANON_TYPE } = require('../dist/helpers/canonType.js')
const { canonToType } = require('../dist/sdkgen.js')

const LANGS: string[] = Fs.readdirSync(FORMS_SRC)
  .filter((f: string) => f.endsWith('.ts') && !FRAMEWORK.includes(f.slice(0, -3)))
  .map((f: string) => f.slice(0, -3)).sort()

const formsOf = (t: string): Forms => require(Path.resolve(__dirname, 'runtimeforms', t + '.js')).forms
const CANON = Object.keys(CANON_TYPE)


function problems(forms: Forms, v: View): string[] {
  const out: string[] = []
  const absent = forms.absentOps || {}
  for (const op of OPS) {
    const m = v.methods[op]
    if (null != absent[op]) {
      if (null != m.method) out.push(`${op} is listed as absent, and the reader finds ${m.method}`)
      continue
    }
    if (null == m.method) out.push(`${op}: ${m.why}`)
    else if (null == m.decl) out.push(`${op}: ${m.method} has no declaration the forms read`)
  }
  if (null == v.load) out.push('no load declaration')
  if ('none' === v.style) out.push('no result style in the load declaration')
  if (null == v.record) out.push('no record accessor (members.dataGet or members.data)')
  if (0 === v.client.length) out.push('no public client member')
  if (0 === v.entity.length) out.push('no public entity member')
  const client = read(forms.files.client)
  const entity = read(forms.files.entity)
  for (const [fam, name] of Object.entries(forms.members)) {
    if (null == name) continue
    const side = ['options', 'utility', 'direct', 'prepare', 'tester'].includes(fam) ? 'client' : 'entity'
    if (0 === findDecls(forms, 'client' === side ? client : entity, esc(name)).length) {
      out.push(`members.${fam} ${name} is not declared in the ${side} files`)
    }
    if (!(v as any)[side].includes(name)) out.push(`members.${fam} ${name} is not among the public ${side} members`)
  }
  if (null == forms.types.column) {
    if (null == forms.types.reason) out.push('types: no column and no reason')
  }
  else for (const k of CANON) if ('' === String(canonToType('`$' + k + '`', forms.types.column) ?? '')) out.push(`types: ${k} has no ${forms.types.column} type`)
  return out
}


// The entity accessor, and what its argument becomes in the entity constructor.
function accessorLine(forms: Forms, client: any[], entity: any[]): string {
  const acc = null == forms.tokens.accessor ? null : findDecls(forms, client, esc(forms.tokens.accessor))[0]
  const ctor = null == forms.entityCtor ? null : findDecls(forms, entity, esc(forms.entityCtor))[0]
  return '\nEntity accessor: ' + (null == acc ? '(not read)' : '`' + acc.name.replace(/\\(.)/g, '$1') + '(' + acc.params.join(', ') + ')`' + ('' === acc.returns ? '' : ' -> `' + acc.returns + '`')) +
    '; the entity constructor: ' + (null == ctor ? '(not read)' : '`' + ctor.name + '(' + ctor.params.join(', ') + ')`') + '.'
}


function section(t: string, forms: Forms, v: View): string {
  const client = read(forms.files.client)
  const entity = read(forms.files.entity)
  const shape = (name: string) => v.shapes.find((s) => new RegExp('[(, ]' + esc(name) + '[,)]').test(s.shape))?.shape.replace(/ \(.*$/, '') || ''
  const memberRow = (name: string, files: any[]) => {
    const ds = findDecls(forms, files, esc(name))
    const fam = Object.entries(forms.members).find(([, n]) => n === name)?.[0] || ''
    const params = 0 === ds.length ? '(not read)' : [...new Set(ds.map((d) => d.bare ? 'property or field' : '(' + d.params.join(', ') + ')'))].join(' or ')
    return `| ${name} | ${params} | ${[...new Set(ds.map((d) => d.returns))].join(' or ')} | ${fam} | ${shape(name)} |`
  }
  const lines = [
    `## ${t}`, '',
    `Result style: **${v.style}**; operations ${v.async ? 'resolve asynchronously' : 'return'}. ` +
    `Record accessor: ${null == v.record ? '(none)' : '`' + v.record.name + '`, ' + v.record.params + ' parameter(s)'}.`, '',
    '| operation | method | parameters | returns | source |', '| --- | --- | --- | --- | --- |',
    ...OPS.map((op) => {
      const m = v.methods[op]
      if (null != forms.absentOps?.[op]) return `| ${op} | (absent: ${forms.absentOps[op]}) | | | |`
      return `| ${op} | ${m.method ?? '(' + m.why + ')'} | ${null == m.decl ? '' : m.decl.params.join(', ')} | ${m.decl?.returns ?? ''} | ${(m.decl?.file ?? '').split('#')[0]} |`
    }),
    accessorLine(forms, client, entity),
    '', '| client member | parameters | returns | family | shape |', '| --- | --- | --- | --- | --- |',
    ...v.client.map((n) => memberRow(n, client)),
    '', '| entity member | parameters | returns | family | shape |', '| --- | --- | --- | --- | --- |',
    ...v.entity.map((n) => memberRow(n, entity)),
    '',
    null == forms.types.column
      ? `Field types: no code generator column (${forms.types.reason}).`
      : 'Field types (`canonToType`, column `' + forms.types.column + '`): ' +
        CANON.map((k) => `${k} \`${canonToType('`$' + k + '`', forms.types.column)}\``).join(', ') + '.',
    '',
  ]
  return lines.join('\n')
}


describe('runtimereader', () => {
  test('forms files for every language', () => {
    ok(LANGS.length >= 20, 'forms files: ' + LANGS.join(' '))
  })

  const sections: string[] = []
  for (const t of LANGS) {
    test(t + ': the forms read the runtime', () => {
      const forms = formsOf(t)
      const v = view(forms)
      sections.push(section(t, forms, v))
      deepStrictEqual(problems(forms, v), [], t + ': what the forms cannot read')
    })
  }

  test('the table (SDKGEN_RUNTIME_TABLE=<path>)', () => {
    const out = process.env.SDKGEN_RUNTIME_TABLE
    if (null != out && '' !== out) {
      Fs.writeFileSync(out, '# What each runtime defines, read through its forms\n\n' + sections.join('\n'))
    }
    ok(0 < sections.length)
  })
})
