# Implementation rationale

Generator components and templates have different roles. Components render model-dependent structure; templates provide source shared across APIs. Slot and insertion comments are generator inputs, so they must survive comment cleanup.

Entity operations return entity instances. Generated flow tests and typed accessors read record data through the instance's data accessor. A compiled generated test tree checks this boundary more effectively than text assertions alone.

Raw request helpers remain private behind the operation-specific permission checks. GraphQL error arrays must be interpreted even when the transport status is unsuccessful, so the server's diagnostic is retained.

Feature ordering determines transport composition: the mock transport is installed before wrappers that delegate to the current transport. Preserve that order when adding or adopting feature instances.

Vendored dependency sources are pinned snapshots. Their comment policy is enforced in their upstream repositories; update the snapshots through the vendoring workflow rather than editing them independently.

Sources: [agent guide](AGENTS.md), [SDK template](ts/project/.sdk/src/cmp/ts/fragment/Main.fragment.ts), [generated compilation tests](ts/test/generatedcompile.test.ts).

Target model files describe supported capabilities and retired output paths. Project-specific publication values belong in the project overlay, which survives target replacement. Concrete model values do not override conflicting concrete values; leave project-owned keys unset in target fragments and use schema defaults.
