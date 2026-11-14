// How the js runtime writes things: class methods in the Main, EntityBase and
// Entity fragments, the operations as async methods; any parameter may be
// left out.
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/js/fragment/Entity${o}Op.fragment.js`)

const forms: Forms = {
  files: {
    client: ['src/cmp/js/fragment/Main.fragment.js', 'src/cmp/js/MainEntity_js.ts'],
    entity: ['src/cmp/js/fragment/EntityBase.fragment.js', 'src/cmp/js/fragment/Entity.fragment.js'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]+(?:static\\s+|async\\s+\\*?\\s*)*${name}(?=\\()`, 'm'),
  param: (p) => ({ name: (/^(?:\.\.\.)?(\w+)/.exec(p.trim()) || ['', ''])[1], type: '' }),
  optional: () => true,
  returns: () => '',
  entityCtor: 'constructor',
  public: {
    client: /^  (?:static |async \*?)?((?!constructor\b)[a-z]\w*)\(/gm,
    entity: /^  (?:static |async \*?)?((?!constructor\b)[a-z]\w*)\(/gm,
  },
  undocumented: {
    graphql: 'a GraphQL request through the pipeline; no reference page documents it',
    toJSON: 'the serialised form JSON.stringify uses',
    toString: 'the printed form',
    markDeleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance',
  },
  members: {
    options: 'options', utility: 'utility', direct: 'direct', prepare: 'prepare', tester: 'tester',
    data: 'data', match: 'match', make: 'make', client: 'client', entopts: 'entopts', stream: 'stream',
  },
  streamKind: (d) => /async\s*\*/.test(d.head) ? 'streamIterator' : 'stream',
  async: (d) => /\basync\b/.test(d.head),
  style: { exception: 'throw', raises: /\bthrow\b/ },
  record: (rec) => ({ name: (/(\w+)\(\)$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'constructor', accessor: '${entity.Name}' },
  types: { column: 'js' },
  uncompared: { paramTypes: 'js declares no parameter types', returns: 'js declares no return types' },
  // The porter's: sigName, sigParams, sigReturns, renames, typeNames, cite and exceptions.
}

export { forms }
