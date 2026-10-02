# How to check a generated SDK against its API definition

A generated suite mocks each operation from the model, and the model is where
an inferred defect starts. A wrong unwrap in the model becomes a wrong unwrap
in the SDK and a matching assertion in its test, so the suite stays green. The
definition suite reads the API definition instead.

## What it checks

`test/definition.test.ts` (`test/definition.test.js` in the js target) holds
one test per HTTP operation that the SDK has a method for, so a model's
`patch` beside an `update` has none. Each test builds the client with an
`apikey` alone, answers the one request it sends from a mock transport, and
checks these against the definition:

| Check | Fails when |
| --- | --- |
| Route and method | the request goes to a path or method the definition does not declare for the operation, including a path that drops the trailing slash a Django REST server's routes carry. The path is compared as the URL parser reads it, so a backslash in the definition, as in GitLab's `Packages\(\)`, is the slash every client sends |
| Query | a query parameter is not one the definition declares, such as a path parameter sent twice, a header parameter sent as a query parameter, or a model name sent in place of the definition's (`resource_id` for Lob's `resource_ids`), or a declared query parameter that the test passes to a list, load or remove does not arrive. A create or update sends its input as the body, so it is not checked for one |
| Headers | a header parameter the test passes does not arrive as a header under the definition's name. The credential check owns the header the security scheme names and the header the SDK's own credential goes in, and the SDK sets the content type from the body it sends |
| Credential | the request lacks the credential the security scheme names: an HTTP Basic pair with the key as the user, a bearer token, or an API key in its header, query or cookie. A generated SDK sends one credential, under the scheme its model chose, so an operation secured only by another scheme is not checked for one |
| Response | the SDK reads a different number of records, or a different record, than the definition's response example holds |

The response check compares only what the example proves. A list compares
the body when it is an array, or the one list of objects in a page, whose
other properties are paging or status, each known by its whole name, so a
record's `homepage` or `preview` is data of its own. A body with data of its
own beside a list is a record that happens to hold one, and proves nothing
about a list. A single record is the body, or the one object with the
identity field that an envelope carries, under the entity's name or beside
paging and status alone. Any other body is the record itself, such as
GitHub's check suite preferences beside the repository they belong to.

The mock answers with the definition's own response example. Where the
definition gives none, it answers with data built from the response schema:
every property, one item per list, and the object parts of an `allOf` merged
into one. An `allOf` with no object part takes the value one of its parts
declares, in any order: an `example` or the first of its `examples`, then the
first value of an `enum`, then a `default`. Only when no part declares one
does it take the value of its first part that has one, such as a placeholder
for its type. OpenAPI 3.0 ignores the siblings of a `$ref`, so a definition
gives a `$ref` a `description` by wrapping both in an `allOf`, and a `$ref`
to a string wrapped that way is still a string. An example whose top level
contradicts its own schema, such as a list where the schema is an object,
proves nothing, and the test checks the request alone.

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
