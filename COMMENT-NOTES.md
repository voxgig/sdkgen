# Implementation rationale

Generator components and templates have different roles. Components render model-dependent structure; templates provide source shared across APIs. Slot and insertion comments are generator inputs, so they must survive comment cleanup.

Entity operations return entity instances. Generated flow tests and typed accessors read record data through the instance's data accessor. A compiled generated test tree checks this boundary more effectively than text assertions alone.

Raw request helpers remain private behind the operation-specific permission checks. GraphQL error arrays must be interpreted even when the transport status is unsuccessful, so the server's diagnostic is retained.

Feature ordering determines transport composition: the mock transport is installed before wrappers that delegate to the current transport. Preserve that order when adding or adopting feature instances.

Vendored dependency sources are pinned snapshots. Their comment policy is enforced in their upstream repositories; update the snapshots through the vendoring workflow rather than editing them independently.

Sources: [agent guide](AGENTS.md), [SDK template](ts/project/.sdk/src/cmp/ts/fragment/Main.fragment.ts), [generated compilation tests](ts/test/generatedcompile.test.ts).

Target model files describe supported capabilities and retired output paths. Project-specific publication values belong in the project overlay, which survives target replacement. Concrete model values do not override conflicting concrete values; leave project-owned keys unset in target fragments and use schema defaults.

An operation context builds its own control. A context created with an operation name does not inherit the control of the context it was created from; one created without a name still does, so an entity context continues to share the client's. That single condition is what keeps paging cursors, actors and explain records from leaking between independent calls, and it is the reason a caller who wants continuation must pass the same control object again. The condition is spelled the same way in every target, and the reference implementations carry the comment; the rest read as an ordinary guard beside it.

Paging parity is read per port, not per file. Most targets carry a paging file of their own, but clojure and ocaml hold their whole feature set in one aggregate file, so a sweep across per-feature template paths never reached them and both drifted unnoticed: neither read the underscore spellings, neither preferred the next page over the current one when building the request, and neither wrote the record back into the call's control object. The parity suite therefore enumerates the PORTS and has each one declare where its paging lives, so a new target fails until it does the same. Two of its checks need care for the same reason. A next-page name proves nothing on its own, because it is also a key of the record the result stage builds, so the check matches it beside the write of the page query parameter and reads a short window rather than one line, since the selection wraps in the wordier ports. And the write-back check matches the control and paging on one line, because every port spells its control differently.

A removal compares the source of the item it is removing, whatever the model says about it. The drift check writes off an inactive feature's copied source as stale, which is correct for a project that deactivated a feature and left the files behind — but it made `feature remove` refuse its own removal, because every file the removal was about to delete came back as drift. Naming the feature the caller is acting on compares those files against what the add wrote instead, so a project EDIT still refuses and a merely deactivated feature removes cleanly.
