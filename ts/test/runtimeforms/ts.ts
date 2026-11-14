// How the ts runtime writes things: class methods in the Main, EntityBase
// and Entity fragments, the operations as async methods.
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/ts/fragment/Entity${o}Op.fragment.ts`)

const forms: Forms = {
  files: {
    client: ['src/cmp/ts/fragment/Main.fragment.ts'],
    entity: ['src/cmp/ts/fragment/EntityBase.fragment.ts', 'src/cmp/ts/fragment/Entity.fragment.ts'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]+(?:static\\s+|async\\s+\\*?\\s*)*${name}(?=\\()`, 'm'),
  receiver: /^this\s*:/,
  optional: (p) => /^\w+\?/.test(p) || /=/.test(p),
  returns: (after) => (/^\s*:\s*([^{]+)/.exec(after) || [])[1] || '',
  public: {
    client: /^  (?:static |async \*?)?((?!constructor\b)[a-z]\w*)\(/gm,
    entity: /^  (?:static |async \*?)?((?!constructor\b)[a-z]\w*)\(/gm,
  },
  undocumented: {
    graphql: 'a GraphQL request through the pipeline; no reference page documents it (old pages neither)',
  },
  members: {
    options: 'options', utility: 'utility', direct: 'direct', prepare: 'prepare', tester: 'tester',
    data: 'data', match: 'match', make: 'make', client: 'client', entopts: 'entopts', stream: 'stream',
  },
  streamKind: (d) => /async\s*\*/.test(d.head) ? 'streamIterator' : 'stream',
  async: (d) => /\basync\b/.test(d.head),
  style: { exception: 'throw', raises: /\bthrow\b/ },
  record: (rec) => ({ name: (/(\w+)\(\)$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'constructor' },
  types: { column: 'ts' },
}

export { forms }
