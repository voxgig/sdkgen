// How the rust runtime writes things: pub fns of the client and entity
// structs, an entity's members on the core Entity trait.
import type { Forms } from './forms'

const MAIN = 'src/cmp/rust/fragment/Main.fragment.rs'
const ENTITY = 'src/cmp/rust/fragment/Entity.fragment.rs'
const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/rust/fragment/Entity${o}Op.fragment.rs`)

const forms: Forms = {
  files: {
    client: ['src/cmp/rust/fragment/Main.fragment.rs', 'src/cmp/rust/MainEntity_rust.ts'],
    entity: ['src/cmp/rust/fragment/Entity.fragment.rs', 'tm/rust/core/types.rs#pub trait Entity {#\n}'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]*(?:pub )?fn ${name}(?=\\()`, 'm'),
  receiver: /^(&?self|self\s*:)/,
  param: (p) => {
    const m = /^(?:mut\s+)?(\w+)\s*:\s*(.+)$/.exec(p.trim())
    return null == m ? { name: '', type: '' } : { name: m[1], type: m[2].trim() }
  },
  optional: () => false,
  returns: (after) => (/^\s*->\s*([^;]+?)\s*(?:\s\{.*)?$/.exec(after) || [])[1] || '',
  opName: /^fn ([a-z]\w*)\(self/gm,
  entityCtor: 'new',
  public: {
    client: /^\s*pub fn ([a-z]\w*)\(/gm,
    // The struct's pub fns, and the Entity trait's methods it implements.
    entity: /^    (?:pub fn ([a-z]\w*)\(|fn ((?!fmt\b)[a-z]\w*)\(&self[^)]*\)(?: -> [^{]+)? \{)/gm,
  },
  undocumented: {
    get_root_ctx: 'the pipeline\'s root context, for features; not part of the documented API',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it (old pages neither)',
    mark_deleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance; not documented by the old pages',
    ent_ctx: 'the entity\'s pipeline context, for features (an Entity trait method); not part of the documented API',
  },
  members: {
    options: 'options_map', utility: 'get_utility', direct: 'direct', prepare: 'prepare',
    data: 'data', match: 'matchv', make: 'make', name: 'get_name', stream: 'stream',
  },
  streamKind: (d) => /IntoIter/.test(d.returns) ? 'streamList' : 'unknown',
  style: { exception: 'throw', raises: /$^/, union: (d) => /^Result</.test(d.returns) },
  record: (rec) => {
    const m = /(\w+)\(([^()]*)\)$/.exec(rec)
    return null == m ? { name: rec } : { name: m[1], arity: '' === m[2] ? 0 : m[2].split(',').length }
  },
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'new', accessor: '${method}' },
  // How a call is written: `.` on a value, `::` on the type or a module.
  calls: { on: { instance: ['.'], type: ['::'], module: ['::'] } },
  types: { column: 'rust' },

  // The porter's, from here on.
  typeNames: { 'Rc<crate::entity::${mod}::${cls}>': 'Rc<EntyClass>' },
  cite: {
    'ref.facts.client[0].copy': { value: true, file: "src/cmp/rust/fragment/Main.fragment.rs", quote: "vs::clone(&self.options.borrow())" },
    'ref.facts.direct.okFalse': { file: MAIN, quote: '("ok", Value::Bool(false)),' },
    'ref.facts.entity[0].copy': { value: true, file: "src/cmp/rust/fragment/Entity.fragment.rs", quote: "vs::clone(&self.data.borrow())" },
    'notes.member:direct': { value: "The result map always comes back inside `Ok`, for a non-2xx response and\nfor a request that could not be made alike; its `ok` key reports the failure.", file: "src/cmp/rust/fragment/Main.fragment.rs", quote: ["        self.raw_request(fetchargs)", "            Err(err) => {\n                return Ok(jo(vec![", "        Ok(jo(vec![\n            (\"ok\", Value::Bool(false)),"] },
    'facts.ok': { file: OPS[0], quote: 'Ok(self.clone())' },
    'facts.err': { file: ENTITY, quote: 'Err(err) => return utility.make_error(ctx, Some(err)),' },
    'ref.facts.none': { file: MAIN, quote: 'options: RefCell::new(Value::Noval),' },
    'ref.facts.setArg': {
      file: ENTITY, quote: 'fn data(&self, args: Option<&Value>) -> Value {\n        if let Some(arg) = args {',
      unquoted: { 'Some(&map)': 'an Option<&Value> argument, written for a map value named map' },
    },
    'ref.facts.container': { file: MAIN, quote: 'pub fn new(options: Value) -> Rc<ProjectNameSDK> {' },
    'ref.facts.ctor[0]': {
      file: 'src/cmp/rust/Main_rust.ts',
      quote: ['call_json, call_vfn, getp, ja, jo, json_thunk, to_map, unsupported_op, vfn,', '    Entity, Feature, FeatureRef, FetcherFn, OutVal, ${model.const.Name}EntityBase,',
        'pub use crate::core::sdk::{test_sdk, ${model.const.Name}SDK};', 'pub use crate::utility::voxgigstruct::Value;'],
      unquoted: {
        ProjectNameEntityBase: 'the generator spells it ${model.const.Name}EntityBase',
        ProjectNameSDK: 'the generator spells it ${model.const.Name}SDK',
      },
    },
    'ref.facts.client[1].kind': { value: "utility", file: MAIN, quote: 'pub fn get_utility(&self) -> Rc<Utility> {\n        Utility::copy(&self.utility)' },
    'ref.facts.prepare.fails': { value: "style", file: MAIN, quote: 'pub fn prepare(&self, fetchargs: Value) -> Result<Value, ProjectNameError> {' },
    'ref.facts.body.values': { value: "a string, or bytes as `bytes_value(&[u8])`",
      file: 'tm/rust/utility/media.rs', quote: ['pub fn bytes_value(bytes: &[u8]) -> Value {', 'Value::Str(s) => Some(s.as_bytes().to_vec()),'],
      unquoted: { 'bytes_value(&[u8])': 'the signature bytes_value(bytes: &[u8]) with its parameter name left out' },
    },
    // Searched over the whole rust runtime: a region it leaves out is quoted, with the reason.
    'ref.facts.cancel': { value: false, absent: { pattern: /\b(cancel\w*|abort(?!\(\))\w*|signal|signalled\??)\b|AbortController|isCancelled|CancellationToken|WithContext|context\.Context/i, except: [
      { file: "tm/rust/feature/cost.rs", quote: ["// figure supersedes it loses precision to catastrophic cancellation."],
        why: "the cost feature's comments: floating-point 'catastrophic cancellation', and 'the signal' as an English word" },
    ] } },
  },
  // What the table states besides names, parameters and returns.
  testDecl: 'test_sdk',
  on: (d) => /^\(\s*(&\s*)?(mut\s+)?self\b/.test(d.rest) ? 'instance' : (/^[ \t]+/.test(d.head) ? 'type' : 'module'),
  fails: (d) => /^Result</.test(d.returns) ? 'Result' : '',
  failure: { shows: 'Result', call: 'unwrap' },
  stream: {
    file: "src/cmp/rust/fragment/Entity.fragment.rs",
    construct: "return Ok(sf().into_iter());", starts: "at call",
    run: "self.utility.feature_hook(&ctx, \"PrePoint\");",
    draw: "return Ok(sf().into_iter());",
    runs: "before it returns", items: "before it returns",
  },
}

export { forms }
