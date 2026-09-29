# How to check a generated SDK against its API definition

A generated suite mocks each operation from the model, and the model is where
an inferred defect starts. A wrong unwrap in the model becomes a wrong unwrap
in the SDK and a matching assertion in its test, so the suite stays green. The
definition suite reads the API definition instead.

## What it checks

`test/definition.test.ts` (`test/definition.test.js` in the js target) holds
one test per HTTP operation. Each test builds the client with an `apikey`
alone, answers the one request it sends from a mock transport, and checks
four things against the definition:

| Check | Fails when |
| --- | --- |
| Route and method | the request goes to a path or method the definition does not declare for the operation |
| Query | a query parameter is not one the definition declares, such as a path parameter sent twice, or a model name sent in place of the definition's (`resource_id` for Lob's `resource_ids`) |
| Credential | the request lacks the credential the security scheme names: an HTTP Basic pair with the key as the user, a bearer token, or an API key in its header, query or cookie |
| Response | the SDK reads a different number of records, or a different record, than the definition's response example holds |

The mock answers with the definition's own response example. Where the
definition gives none, it answers with data built from the response schema:
every property, and one item per list.

## Run it

It runs with the rest of the offline suite:

```bash
cd ts && npm test
```

A failure names the operation and the check, for example `list read 0
records where the definition example holds 2`.

## Skip one operation, with a reason

A definition can be wrong, and you may know better. List the operation under
`test.skip.definition.entityOp` in your `test/sdk-test-control.json`, with
the reason:

```json
{ "entity": "address", "op": "load", "reason": "the vendor example lacks an id" }
```

The reason prints with the skip, so the exception stays visible.

## Where the checks come from

The generator reads the resolved API definition that apidef publishes during
the model build, never the model (`definitionPlan`, pinned by
`ts/test/definition.test.ts`). Only the ts and js targets generate the suite,
the same two that carry the live suite described in
[Run a generated SDK's live suite](./run-a-live-suite.md).
