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
  // How a call is written: `->` on a shared handle (the client, an entity),
  // `::` on the class for its static members.
  calls: { on: { instance: ['->'], type: ['::'] } },
  // The porter's: sigName, sigParams, sigReturns, renames, typeNames, uncompared, cite and exceptions.
  typeNames: { 'std::shared_ptr<${cls}>': 'std::shared_ptr<EntyClass>' },
  namesWhy: 'MainEntity_cpp.ts writes the accessor\'s return through the generator\'s class name (${cls}, entityClassName), which is the EntyClass of Entity.fragment.cpp',
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
    // The porter's citations.
    'facts.recordType': { value: 'Value', file: TYPES, quote: 'Value data(const Value& arg = Value::undef()) override;' },
    // No options: the default every optional Value parameter takes.
    'ref.facts.none': { file: 'src/cmp/cpp/fragment/Main.fragment.cpp', quote: 'explicit ProjectNameSDK(Value options = Value::undef()) : SdkClient(options) {}' },
    'ref.facts.container': { file: 'src/cmp/cpp/fragment/Main.fragment.cpp', quote: 'explicit ProjectNameSDK(Value options = Value::undef()) : SdkClient(options) {}' },
    'ref.facts.ctor[0]': { file: 'src/cmp/cpp/Config_cpp.ts', quote: '#include "../../core/sdk.hpp"',
      also: [{ file: 'tm/cpp/core/sdk.hpp', quote: '// ProjectName SDK — umbrella include. A test or consumer includes this one' }] },
    'ref.facts.ctor[2]': { file: 'src/cmp/cpp/fragment/Main.fragment.cpp', quote: 'namespace sdk {',
      unquoted: { using: 'a C++ keyword: the line brings the namespace the templates open into scope' } },
    // The client is held by a shared handle, made as the runtime makes its own (testSDK, create).
    'ref.facts.ctor[4]': { file: 'src/cmp/cpp/fragment/Main.fragment.cpp',
      quote: ['explicit ProjectNameSDK(Value options = Value::undef()) : SdkClient(options) {}', 'auto sdk = std::make_shared<ProjectNameSDK>(SdkClient::testOptions(testopts, sdkopts));'],
      unquoted: { client: 'the name the page binds the client to, as every other example does' } },
    'ref.facts.ctorAlts[0].kind': { value: 'defaults', file: 'src/cmp/cpp/fragment/Main.fragment.cpp',
      quote: '// Convenience no-arg constructor.\n  static std::shared_ptr<ProjectNameSDK> create() {\n    return std::make_shared<ProjectNameSDK>(Value::undef());' },
    'ref.facts.client[0].copy': { value: true, file: TYPES, quote: 'Value out = Struct::clone(options);' },
    // Decision 13: the getter returns what the copy function builds, a new object.
    'ref.facts.client[1].copy': { value: true, file: TYPES, quote: 'inline UtilityPtr SdkClient::getUtility() { return utility->copy(); }',
      also: [{ file: TYPES, quote: ['UtilityPtr copy() const {\n    auto u = std::shared_ptr<Utility>(new Utility(NoRegister{}));'] }] },
    'ref.facts.client[1].kind': { value: 'utility', file: TYPES, quote: 'inline UtilityPtr SdkClient::getUtility() { return utility->copy(); }' },
    'ref.facts.entity[0].copy': { value: true, file: TYPES, quote: 'return Struct::clone(data_);' },
    'ref.facts.entity[1].copy': { value: true, file: TYPES, quote: 'return Struct::clone(match_);' },
    'ref.facts.prepare.fails': { value: 'style', file: TYPES, quote: 'throw ctx->makeError("spec_method_allow",' },
    'ref.facts.body.values': { value: 'a string `Value` holding the bytes, which is sent as given', file: 'tm/cpp/utility/pipeline.hpp',
      quote: ['const Value& body = spec->body;\n    bool scalar = body.is_string() || body.is_number() || body.is_bool();', 'map_put(fetchdef, "body", body);'] },
    // Searched over the whole cpp runtime: a region it leaves out is quoted, with the reason.
    'ref.facts.cancel': { value: false, absent: { pattern: /\b(cancel\w*|abort(?!\(\))\w*|signal|signalled\??)\b|AbortController|isCancelled|CancellationToken|WithContext|context\.Context/i, except: [
      { file: 'tm/cpp/feature/cost.hpp', quote: ['// supersedes it loses precision to catastrophic cancellation.'],
        why: "the cost feature's comment: floating-point 'catastrophic cancellation'" },
      { file: 'tm/cpp/feature/secrets/plugins/Httpjson.cpp', quote: ['#include <signal.h>'],
        why: "the secrets feature's own HTTP client, which ignores SIGPIPE; no operation or stream reads it" },
      { file: 'tm/cpp/feature/secrets/plugins/Tls.cpp', quote: ['// callback means a verification error ABORTS the handshake rather than', '// Belt and braces. SSL_VERIFY_PEER already aborts on a bad chain, but'],
        why: "the secrets feature's own client for fetching a secret (its HTTP, TLS or process calls), which no operation's request goes through" },
      { file: 'tm/cpp/feature/secrets/sekreto/Provider.cpp', quote: ['// 500 chains each aborted every run with'],
        why: "the secrets feature's own provider library, a comment on its resolution limit" },
    ] } },
  },
}

export { forms }
