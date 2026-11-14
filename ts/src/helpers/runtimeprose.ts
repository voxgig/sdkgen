// The sentences that state a runtime fact, written once per result style.
// A provider declares its facts (RuntimeFacts); it supplies code tokens and a
// collection noun, never a sentence.

import type { RuntimeFacts } from './example'


const code = (s: string): string => '`' + s + '`'

const article = (s: string): string => /^`?[aeiou]/i.test(s) ? 'an' : 'a'

const a = (s: string): string => article(s) + ' ' + s

function opName(f: RuntimeFacts, op: string): string {
  const m = (f.method as any)[op] || op
  return code('call' === f.named ? m + '()' : m)
}

function recordClause(f: RuntimeFacts, of: string): string {
  return `${code(f.record)} reads ${of} record` + (f.recordType ? ` (${a(code(f.recordType))})` : '')
}


// What a list returns, and how it fails: one sentence (two for `pair`).
function listSentence(f: RuntimeFacts): string {
  const op = opName(f, 'list')
  const many = `${a(f.collection)} of entities, one per record`
  const rec = recordClause(f, 'an entity\'s')
  switch (f.result) {
    case 'throw':
    case 'raise':
      return `${op} ${f.async ? 'resolves to' : 'returns'} ${many}, and ${f.result}s on failure; ${rec}.`
    case 'pair':
      return `${op} returns ${code('(value, error)')}: the value is ${many}, and a non-nil ${code(f.errVar as string)} ` +
        `reports failure. There is no ${code('{ok, data}')} wrapper; ${rec}.`
    case 'errslot':
      return `${op} returns ${many}, or ${code(f.nullValue as string)} with ${code(f.errSlot as string)} set on failure, ` +
        `so check ${code(f.errVar as string)} after the call; ${rec}.`
    case 'union':
      return `${op} returns a result whose ${code(f.ok as string)} is ${many}, and whose ${code(f.err as string)} ` +
        `reports failure; ${rec}.`
  }
}


// What a load returns, and how it fails.
function loadSentence(f: RuntimeFacts): string {
  const op = opName(f, 'load')
  const rec = recordClause(f, 'its')
  switch (f.result) {
    case 'throw':
    case 'raise':
      return `${op} ${f.async ? 'resolves to' : 'returns'} the entity and ${f.result}s on failure; ${rec}.`
    case 'pair':
      return `${op} returns ${code('(value, error)')}: the value is the entity, and a non-nil ` +
        `${code(f.errVar as string)} reports failure; ${rec}.`
    case 'errslot':
      return `${op} returns the entity, or ${code(f.nullValue as string)} with ${code(f.errSlot as string)} ` +
        `set on failure; ${rec}.`
    case 'union':
      return `${op} returns a result whose ${code(f.ok as string)} is the entity and whose ` +
        `${code(f.err as string)} reports failure; ${rec}.`
  }
}


// The write comments, where a runtime fact changes what a create returns.
function createComment(f: RuntimeFacts): string {
  return 'Create — returns the created entity' +
    ('errslot' === f.result ? `, or ${f.nullValue} with ${f.errSlot} set` : '')
}


// A short form for a code comment: how failure is reported.
function failsShort(f: RuntimeFacts): string {
  switch (f.result) {
    case 'throw': return 'throws on failure'
    case 'raise': return 'raises on failure'
    case 'pair': return f.errVar + ' is non-nil on failure'
    case 'errslot': return f.errSlot + ' is set on failure'
    case 'union': return f.err + ' on failure'
  }
}

function listComment(f: RuntimeFacts, title: string): string {
  const many = `${a(f.collection.replace(/`/g, ''))} of entities, one per record`
  return `${title}: ${'union' === f.result ? f.ok + ' is ' : ''}${many}; ${failsShort(f)}`
}

function loadComment(f: RuntimeFacts, title: string): string {
  return `${title}: ${'union' === f.result ? f.ok + ' is ' : ''}the entity; ${failsShort(f)}`
}


export {
  createComment,
  listComment,
  listSentence,
  loadComment,
  loadSentence,
}
