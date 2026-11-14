// How the c runtime writes things: the client's functions in Main.fragment.c,
// an entity's members as the EntityVT function pointers of core/sdk.h.
import type { Forms, Src } from './forms'

const OPFILES = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/c/fragment/Entity${o}Op.fragment.c`)
const MAIN = 'src/cmp/c/fragment/Main.fragment.c'
const OPS = ['src/cmp/c/fragment/Entity.fragment.c', 'tm/c/core/sdk.h', ...OPFILES]

// An operation's fragment defines entyvar_<op>; the vtable initializer in
// Entity.fragment.c puts it at the position of an EntityVT field in sdk.h,
// and that field is the method.
const vtMethod = (src: Src[], all: (files: string[]) => Src[]): string | null => {
  const fn = (/^static Entity\**\s*(entyvar_\w+)\(Entity\* e/m.exec(src[0].text) || [])[1]
  const [ent, hdr] = all(['src/cmp/c/fragment/Entity.fragment.c', 'tm/c/core/sdk.h'])
  const init = (/static const EntityVT entyvar_VT = \{([^}]*)\}/.exec(ent.text) || [])[1]
  const struct = (/typedef struct EntityVT \{([^}]*)\}/.exec(hdr.text) || [])[1]
  if (null == fn || null == init || null == struct) return null
  const at = init.split(',').map((s) => s.trim()).filter((s) => '' !== s).indexOf(fn)
  const fields = [...struct.matchAll(/\(\*(\w+)\)\(/g)].map((m) => m[1])
  return at < 0 ? null : fields[at] || null
}

const forms: Forms = {
  files: {
    client: ['src/cmp/c/fragment/Main.fragment.c', 'src/cmp/c/MainEntity_c.ts'],
    entity: ['tm/c/core/sdk.h#typedef struct EntityVT {#}', 'src/cmp/c/fragment/Entity.fragment.c'],
    ops: OPS,
  },
  opMethod: (_op, src, all) => vtMethod(src, all),
  // A function pointer of the vtable, or a function at the start of a line.
  decl: (name) => new RegExp(`(?:\\(\\*${name}\\)|^(?!static\\b)[A-Za-z_][\\w *]*?[\\s*]${name})(?=\\()`, 'm'),
  param: (p) => {
    const m = /^(.*?[\s*])(\w+)$/.exec(p.trim())
    return null == m ? { name: '', type: p.trim() } : { name: m[2], type: m[1].trim() }
  },
  optional: () => false,
  // The return type is written ahead of the name.
  returns: (_after, before, head) =>
    (/^\s*(?:static\s+)?(.*?)\s*(?:\(\*\w+\)|\b\w+)$/.exec((before + head).split('\n').pop() as string) || [])[1] || '',
  entityCtor: 'entyvar_entity_new',
  public: {
    client: /^(?!static\b)[A-Za-z_][\w ]*?\**\s*\**([a-z_]\w*)\(/gm,
    entity: /\(\*([a-z_]+)\)\(Entity\*|^(?!static\b)[A-Za-z_]\w*\**\s+\**(entyvar_\w+)\(/gm,
  },
  undocumented: {
    sdk_graphql: 'a GraphQL request through the pipeline; no reference page documents it (old pages neither)',
    mark_deleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance; not documented by the old pages',
    entyvar_entity_new: 'the entity constructor each client accessor calls; the page documents the accessor',
  },
  members: {
    direct: 'sdk_direct', prepare: 'sdk_prepare',
    data: 'data', match: 'matchv', make: 'make', name: 'get_name', stream: 'entyvar_stream',
  },
  streamKind: (d) => /^voxgig_value\*$/.test(d.returns) ? 'streamList' : 'unknown',
  sigName: (sig) => (/([\w{}]+)\s*\(/.exec(sig.replace(/vt->/, '')) || [])[1] || '',
  sigReturns: (sig) => (/^\s*((?:const\s+)?[A-Za-z_{}][\w{}]*\s*\**)\s*(?:vt->)?[\w{}]+\s*\(/.exec(sig) || [])[1] || '',
  style: {
    exception: 'throw', raises: /$^/,
    errslot: (d) => /PNError\*\*\s*\w*$/.test(d.params[d.params.length - 1] || ''),
  },
  record: (rec) => ({ name: rec.replace(/^vt->/, '') }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'projectname_sdk_new', var: 'entyvar', accessor: '${cAccessorName(model, entity.name)}' },
  types: { column: 'c' },

  // The porter's, from here on.
  renames: { sdk: 'client' },
  typeNames: { '${Name}SDK*': 'ProjectNameSDK*' },
  namesWhy: 'C passes by position; the page names the client parameter client, and the generator component spells its type through the model',
  uncompared: {
    returns: 'the accessor is declared in MainEntity_c.ts under a name the generator spells (${cAccessorName(...)}), past which the return reader cannot see',
    paramNames: 'the EntityVT function pointers in core/sdk.h leave their receiver parameter unnamed (Entity*)',
  },
  cite: {
    'ref.facts.entity[0].copy': { value: true, file: "src/cmp/c/fragment/Entity.fragment.c", quote: "return voxgig_clone(self->data);" },
    'facts.collection': { value: "`NULL`-terminated array", file: OPFILES[1], quote: ['// array is NULL-terminated.', 'items[n] = NULL;'] },
    'facts.errSlot': { file: MAIN, quote: '*err = context_make_error(ctx, "spec_method_allow", buf);' },
    'facts.nullValue': { file: OPFILES[0], quote: 'if (*err) return NULL;' },
    'ref.facts.container': { file: MAIN, quote: 'ProjectNameSDK* projectname_sdk_new(voxgig_value* options) {' },
    'ref.facts.ctor[0]': { file: MAIN, quote: '#include "api.h"' },
    'ref.facts.prepare.fails': { value: "style", file: MAIN, quote: 'voxgig_value* sdk_prepare(ProjectNameSDK* sdk, voxgig_value* fetchargs, PNError** err) {' },
    'ref.facts.body.values': { value: "a string value holding the bytes, such as `voxgig_new_string_n`",
      file: 'tm/c/utility/http.c',
      quote: ['if (voxgig_is_string(body)) {\n    bytes = voxgig_as_string(body);\n    blen = voxgig_string_len(body);', '"body", voxgig_new_string_n(text, len),'],
    },
    'ref.facts.cancel': { value: false, file: 'tm/c/utility/http.c', quote: '// The default live transport: HTTP/1.1 over a socket, one request per\n// connection.' },
  },
  exceptions: {
    'types:ARRAY': 'the code generator\'s map gives voxgig_value* for arrays and maps alike; the page says which, as the old page did',
    'types:OBJECT': 'the code generator\'s map gives voxgig_value* for arrays and maps alike; the page says which, as the old page did',
  },
}

export { forms }
