// makePoint is a TEMPLATE: it ships to users verbatim, outside sdkgen's own
// tsconfig, so nothing here compiled or ran it before. This suite transpiles
// the real shipped file and drives it directly.

import { test, describe } from 'node:test'
import { ok, strictEqual } from 'node:assert'

import { readFileSync } from 'node:fs'
import Path from 'node:path'

import { transform } from 'sucrase'


const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')


function loadTemplate(rel: string, shims: Record<string, any> = {}): any {
  const file = Path.join(TM, rel)
  const js = transform(readFileSync(file, 'utf8'), {
    transforms: ['typescript', 'imports'],
    filePath: file,
  }).code

  const req = (p: string) => {
    for (const key of Object.keys(shims)) {
      if (p === key || p.endsWith(key)) {
        return shims[key]
      }
    }
    return require(p)
  }

  const mod: any = { exports: {} }
  const fn = new Function('exports', 'require', 'module', '__dirname', '__filename', js)
  fn(mod.exports, req, mod, Path.dirname(file), file)
  return mod.exports
}


const { makePoint } = loadTemplate('ts/src/utility/MakePointUtility.ts', {
  '../types': {},
})


// A context shaped the way the generated pipeline builds one, for an op
// with several points and an id-only match argument.
function makeCtx(points: any[], match: any = { id: 'x' }) {
  return {
    out: {},
    op: { name: 'load', input: 'match', points },
    options: { allow: { op: 'load' } },
    match,
    reqmatch: match,
    utility: { struct: { getprop: (o: any, k: string) => (o ? o[k] : undefined) } },
    error: (code: string, msg: string) => ({ code, message: msg }),
  }
}


describe('makePoint', () => {

  // Trello's board load: /boards/{id} (2 parts) vs cross-references like
  // /notifications/{id}/board (3 parts) — neither's select.exist matches a
  // plain {id}, so the shortest, canonical path must win.
  test('falls back to the shortest path when no select.exist matches', () => {
    const short = { parts: ['boards', '{id}'], select: { exist: ['not_a_real_key'] } }
    const long = { parts: ['notifications', '{id}', 'board'], select: { exist: ['notification_id'] } }

    const point = makePoint(makeCtx([long, short]))

    strictEqual(point, short, 'did not prefer the shortest, canonical path')
  })


  // The existing, correct case: a point whose select.exist IS satisfied by
  // the match argument still wins outright, unaffected by the fallback.
  test('a point whose select.exist matches is still preferred', () => {
    const generic = { parts: ['thing', '{id}'], select: { exist: ['not_a_real_key'] } }
    const specific = { parts: ['other', '{id}', 'thing'], select: { exist: ['id'] } }

    const point = makePoint(makeCtx([generic, specific]))

    strictEqual(point, specific, 'a real select.exist match was not preferred')
  })


  test('a single point needs no selection at all', () => {
    const only = { parts: ['thing', '{id}'], select: {} }
    const point = makePoint(makeCtx([only]))
    strictEqual(point, only)
  })

})
