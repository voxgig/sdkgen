# k-survey notes: ts + js (complete)
js runtime is a line-for-line port of ts (Main/EntityBase/ops/utilities diffed: types and comments only).
Key findings:
- utility() returns the LIVE Utility instance: struct.clone passes class instances by reference (verified with node on tm/js StructUtility clone). Old page says "Deep copy".
- options()/data()/match() deep JSON copies (functions, class instances shared); entopts() merge into {} - nested also copied (verified).
- accessor: new entity every call; arg is entopts, not data (old page says data / "Initial entity data").
- no-test: test() -> constructor -> config.makeFeature('test') -> FEATURE_CLASS['test'] undefined -> `new fc()` TypeError "fc is not a constructor". Old no-test page documents test().
- explain: object filled; `true` -> strict-mode TypeError in ts (all steps), js plain-function steps sloppy (silent) but class methods (EntityBase._unexpected, TestFeature.buildArgs) strict -> TypeError. Old REFERENCE gives `{ explain: true }` as example.
- direct never throws (except prepare outside try).
- stream: async generator, runs on first next().
