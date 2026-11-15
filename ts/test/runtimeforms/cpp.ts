// How the cpp runtime writes things: the members declared in the SdkClient
// and EntityBase classes of core/types.hpp (the type ahead of the name, a
// default after `=`), the generated client and entity classes, and each
// operation overriding SdkEntity's pure virtual.
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/cpp/fragment/Entity${o}Op.fragment.cpp`)
const TYPES = 'tm/cpp/core/types.hpp'

const forms: Forms = {
  files: {
    client: [`${TYPES}#class SdkClient {#\n};`, 'src/cmp/cpp/fragment/Main.fragment.cpp', 'src/cmp/cpp/MainEntity_cpp.ts#Content(`#`)'],
    entity: ['src/cmp/cpp/fragment/Entity.fragment.cpp', `${TYPES}#class EntityBase : public SdkEntity,#\n};`],
    // types.hpp holds the out-of-line definitions, where the runtime throws.
    ops: [...OPS, TYPES],
  },
  decl: (name) => new RegExp(`^[ \\t]*(?:virtual |static |explicit |inline )*(?:(?!return\\b|class\\b|struct\\b)[\\w:<>,]+(?:<[^;(]*>)?[\\s*&]+)?${name}(?=[(\\s=;])`, 'm'),
  bare: true,
  param: (p) => {
    const m = /^(.*?[\s*&])(\w+)\s*(?:=.*)?$/.exec(p.trim())
    return null == m ? { name: '', type: p.trim() } : { name: m[2], type: m[1].trim() }
  },
  optional: (p) => /=/.test(p),
  // A constructor's head carries modifiers and no return type.
  returns: (_after, _before, head) => ((/^[ \t]*(?:virtual |static |explicit |inline )*(.*?)\s+[\w$\{\}]+$/.exec(head) || [])[1]?.trim() || '')
    .replace(/^(virtual|static|explicit|inline)$/, ''),
  entityCtor: 'EntyClass',
  opName: /^  [\w:<>]+ ([a-z]\w*)\(const Value& req\w+, const Value& ctrl\) override/gm,
  public: {
    client: /^  (?:virtual |static |explicit |inline )*(?:const )?[\w:<>,]+(?:<[^;(]*>)?[\s*&]+([a-z]\w*)\s*(?:\(|=[^=]|;)/gm,
    entity: /^  (?:virtual |static |explicit |inline )*(?:const )?[\w:<>,]+(?:<[^;(]*>)?[\s*&]+([a-z]\w*)\s*(?:\(|=[^=]|;)/gm,
  },
  undocumented: {
    mode: 'a public field holding "live" or "test"',
    features: 'a public field holding the installed features, for the pipeline',
    options: 'the public field optionsMap() copies',
    utility: 'the public field getUtility() returns',
    rootctx: 'the public field getRootCtx() returns',
    to_string: 'the printed form (operator<<)',
    getRootCtx: 'the pipeline\'s root context, for features',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it',
    opAllowed: 'private: the allow.op check direct and graphql share',
    opDenied: 'private: the refusal direct and graphql return',
    rawRequest: 'private: the request path direct and graphql share',
    testOptions: 'the helper testSDK uses to build test-mode options',
    create: 'the static constructor with no options (ProjectNameSDK::create)',
    name_: 'public field: the entity name getName() returns',
    deleted_: 'public field behind deleted()',
    client: 'public field: the client the entity belongs to',
    entopts: 'public field: the entity options',
    data_: 'public field behind data()',
    match_: 'public field behind match()',
    entctx: 'public field: the entity\'s pipeline context',
    self: 'the shared handle the operations return',
    runOp: 'protected: drives one operation through the pipeline (the reader does not see C++ access sections)',
    markDeleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance',
  },
  members: {
    options: 'optionsMap', utility: 'getUtility', direct: 'direct', prepare: 'prepare',
    data: 'data', match: 'match', make: 'make', name: 'getName', stream: 'stream',
  },
  streamKind: (d) => /^std::vector<Value>/.test(d.returns) ? 'streamList' : 'stream',
  style: { exception: 'throw', raises: /\bthrow\b/ },
  record: (rec) => ({ name: (/(\w+)\(\)$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'ProjectNameSDK', accessor: '${accessor}' },
  types: { column: 'cpp' },
  // The porter's: sigName, sigParams, sigReturns, renames, typeNames, uncompared, cite and exceptions.
  // What the table states besides names, parameters and returns.
  testDecl: 'testSDK',
  expect: { testSDK: { on: 'type' } },
  stream: {
    file: "tm/cpp/core/types.hpp",
    construct: "return res->stream();", starts: "at call",
    run: "  try {\n    u->featureHook(ctx, \"PrePoint\");\n    Value point = u->makePoint(ctx);\n    ctx->out.has_point = true;\n    ctx->out.point = point;\n\n    u->featureHook(ctx, \"PreSpec\");\n    SpecPtr spec = u->makeSpec(ctx);\n    ctx->out.spec = spec;\n\n    u->featureHook(ctx, \"PreRequest\");\n    ResponsePtr request = u->makeRequest(ctx);\n    ctx->out.request = request;\n\n    u->featureHook(ctx, \"PreResponse\");\n    ResponsePtr response = u->makeResponse(ctx);\n    ctx->out.response = response;\n\n    u->featureHook(ctx, \"PreResult\");\n    ResultPtr result = u->makeResult(ctx);\n    ctx->out.result = result;\n\n    u->featureHook(ctx, \"PreDone\");\n\n    // Inbound",
    draw: "return res->stream();",
    runs: "before it returns", items: "before it returns",
  },
  // direct's `ok` on a failure, cited ahead of the provider: a port declares ref.facts.direct.okFalse as this value.
  cite: {
    // The stream reads no signal: searched over the whole cpp runtime, ahead of a provider.
    'ref.facts.streamSignal': { value: false, absent: { pattern: /\bsignal\b/i, except: [
      { file: 'tm/cpp/feature/secrets/plugins/Httpjson.cpp', quote: ['#include <signal.h>'],
        why: "the secrets feature's own HTTP client, which ignores SIGPIPE; no operation or stream reads it" },
    ] } },
    'ref.facts.direct.okFalse': { value: "false", file: "tm/cpp/core/types.hpp", quote: "map_put(out, \"ok\", Value(false));" },
    // The test client's mock without the test feature, cited ahead: the factory's fallback.
    'ref.facts.testMock': { value: "generated", file: "src/cmp/cpp/Config_cpp.ts", quote: "return std::make_shared<BaseFeature>();" },
  },
}

export { forms }
