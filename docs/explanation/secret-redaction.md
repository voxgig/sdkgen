# Secret redaction

Every generated SDK masks its credentials in everything it emits: thrown
errors, explain records, log lines, debug traces, audit records, telemetry
spans and the serialised form of its own objects. This page explains how
that works and where its edges are.

## Two layers

**The value registry.** The SDK registers every secret it handles at the
moment it sees it: the `apikey` and `secret` options, any option whose key
name is sensitive (a custom auth header, a feature credential), every value
in `clean.values`, the Basic credential it composes, every value the
`secrets` feature resolves or exchanges, and the userinfo of a proxy URL.
Each value is stored with its base64, percent-encoded and JSON-escaped
forms. Wherever a registered form appears in a string that leaves the SDK,
it is replaced by the mask. The SDK never has to guess what a secret looks
like, because it is the code that received it.

**The key-name layer.** `clean.keys` names fields whose values are masked
wherever they occur in a structure, whether or not the value is registered.
A name matches when the field name, lower-cased with `-` and `_` removed,
contains it: `key` covers `apikey`, `x-api-key` and `idempotency-key`;
`token` covers `private-token`, `access_token` and `refresh_token`; `cookie`
covers `set-cookie`. This is what masks a session token in a response
header the SDK never issued.

## One choke point

The `clean` utility applies both layers, and every egress calls it: the
error's message, stack, result and spec; the `ctrl.explain` record; the
default serialisation of the context, the error and the client; and the
record each diagnostic feature hands to its sink, buffer or logger.

Inside the pipeline data stays raw. A hook must see the real header to add
its own beside it, and a transport wrapper must send the real credential.
The contract is about what leaves, not what exists.

What leaves is a plain-data copy. `err.result` and `err.spec` are masked
copies rather than the live objects, so masking them can never mask the
pipeline's own request. The context stays reachable on the error for a
debugger and is excluded from every serialiser.

## Configuration

The `clean` block of the client options, declared once in the model and
carried into every target by the generated `Schema` module:

| Option | Default | Meaning |
| --- | --- | --- |
| `active` | `true` | The one opt-out. Off means raw diagnostics, for local debugging only. |
| `keys` | `key,secret,token,password,passwd,authorization,cookie,credential,signature` | Field names whose values are masked, by normalised containment. |
| `values` | `''` | Extra literal values to register, comma-separated. |
| `mask` | `[redacted]` | The replacement text. |
| `hint` | `'0'` | Trailing characters of a masked value left visible. |
| `min` | `'4'` | The shortest value the registry accepts. |

The numbers are written as strings, like every value in the option spec,
so each target reads the same schema.

```ts
const sdk = new ProjectSDK({
  apikey: process.env.PROJECT_APIKEY,
  clean: { values: process.env.WEBHOOK_SECRET, hint: '4' },
})
```

The `debug` feature's `redact` option adds header names on top of
`clean.keys`; it is no longer a separate mechanism.

## Edges

- A value shorter than `min` is not registered. Masking three-letter
  strings would blank ordinary prose.
- A user payload value quoted in a message is masked only when it sits
  under a sensitive key or was registered through `clean.values`. The
  registry covers what the SDK handles, not what the caller sends.
- `client.options()` returns the raw credential. It is the documented way
  to read it back, and it is neither a log nor an error.

## The proof

Every generated SDK ships `test/clean.test.<ext>`. It constructs the client
with canary values in every credential slot, switches on every diagnostic
feature the SDK carries with a capturing sink, drives a real operation
through success, a 404, a 500, a transport failure and a body that is not
JSON, and searches every string that leaves for the canaries and their
encoded forms. It then switches `clean` off and confirms the canary shows,
so a sweep that could not see a leak fails rather than passing quietly. The
suite prints one line, `clean: swept N surface(s), 0 leak(s)`, and the
generator's own compile lanes require it.

## See also

- [Operation pipeline](./operation-pipeline.md)
- [Model reference](../reference/model.md)
- [Feature reference](../reference/features.md)
