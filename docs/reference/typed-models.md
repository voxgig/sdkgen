# Reference: typed models (entity data typing)

How sdkgen turns the API model's type information into per-language typed
models, which helpers own each policy, and how strongly each target enforces
the result.

## The pipeline

1. **apidef** normalizes every OpenAPI field/param type to a canonical
   **sentinel** stored on `fields[].type` and op
   `points[].args.params[].type`. The vocabulary is exported by
   `@voxgig/apidef` as `VALID_CANON` (name → sentinel) plus `CANON_ONE`:

   | Sentinel | Meaning |
   | --- | --- |
   | `` `$STRING` `` `` `$NUMBER` `` `` `$INTEGER` `` `` `$BOOLEAN` `` | scalars |
   | `` `$NULL` `` | null type |
   | `` `$ARRAY` `` `` `$OBJECT` `` | untyped list / open map (no element or nested schema in the model) |
   | `` `$ANY` `` | unknown / unconstrained |
   | `['`$ONE`', [member, …]]` | union (OpenAPI multi-type); members are themselves sentinels |

2. **`canonToType(sentinel, lang)`** (`ts/src/helpers/canonType.ts`) maps a
   sentinel to a concrete type name per language. The `CANON_TYPE` table has
   one column for **every language with an `EntityTypes_<lang>` emitter** —
   it is the *single* mapping per language; components must not keep local
   copies (the README generators `ReadmeRef_<lang>` / `ReadmeEntity_<lang>`
   read the same table). Unknown/missing sentinels fall back to the
   language's "any" (`CANON_ANY`), never throw. `$ONE` unions render as a
   joined member list where the language has union syntax
   (`CANON_UNION_JOIN`: ts, js/JSDoc, py, lua/LuaLS, elixir) and degrade to
   "any" elsewhere. `ts/test/canontype.test.ts` pins the full table;
   `ts/test/canonsync.test.ts` asserts the table covers apidef's exported
   vocabulary whenever an exporting apidef version is installed.

3. **`opShape.ts`** owns the language-neutral policy:
   - **Type names** — `opTypeName(Name, op)`: `<Name>LoadMatch`,
     `<Name>ListMatch`, `<Name>RemoveMatch`, `<Name>CreateData`,
     `<Name>UpdateData` (`OP_SUFFIX`). The entity data type is plain
     `<Name>`. Elixir renders the same scheme snake_cased
     (`<ename>_load_match`, …) derived from the shared `OP_SUFFIX`.
   - **Partiality** — `opRequestShape(ent, op)` decides an op's request
     members and their optionality: op-declared params win (required =
     intersection across alternative points; `$action` points excluded);
     otherwise entity fields with per-op policy (create respects `req`,
     update/list all-optional, load/remove require the `id` field).
   - **Collision handling** — `entityClassName` keeps entity *class* names
     unique. Data/op *type* names cannot be renamed (fragments reference
     them by token), so `entityTypeCollisions` /
     `warnEntityTypeCollisions` detect duplicates (two entities whose
     PascalCase `Name` coincides) and every emitter warns loudly
     (`point: entity-types-name-collision`). Fix collisions in the model
     (rename/alias an entity).

4. **`EntityTypes_<lang>.ts`** (scaffold, `ts/project/.sdk/src/cmp/<lang>/`)
   renders the typed model file per target. Emitters fetch the entity
   collection with `only_active: false` and filter on `name` only: the
   consumer scaffold generates entity code for **every** entity (active or
   not), so the typed model must cover them all or the generated project
   does not compile. Fields whose names have no legal identifier form in
   the language are omitted **with a warning**
   (`point: entity-types-skip-field`); ts/js quote such keys instead.
   `ts/test/entitytypes.test.ts` renders each emitter against a fixture
   model (inactive entity, fieldless entity, non-identifier field, `$NULL`
   field, `$ONE` union) and asserts on the output.

## Per-target enforcement tiers

The same policy renders with different strength per target — a deliberate,
per-language decision:

| Tier | Targets | What you get |
| --- | --- | --- |
| Enforced | ts, py | Types on real op signatures (`load(reqmatch?: <Name>LoadMatch): Promise<<Name>>`; TypedDict annotations). ts also binds the generic base `<Sdk>EntityBase<D>`. |
| Additive wrappers | go | Untyped `Load(map[string]any)` kept (go-cli/go-mcp dispatch through it); typed `LoadTyped`/`DataTyped` wrappers convert at the boundary. |
| Annotations | js (JSDoc + shipped `jsconfig.json`), php (PHPDoc), rb (YARD), lua (LuaLS; the types module is `require`d by the main module), elixir (`@spec` on ops referencing the Types aliases) | Tooling-visible types; permissive native signatures. |
| Documentary | csharp, java, kotlin, scala, swift, dart, rust, c, cpp | Compilable reference records/structs mirroring the shapes; ops stay on the loose runtime type. dart additionally generates `fromMap`/`toMap`. |
| Dynamic (no typed model) | clojure, haskell, ocaml, perl, zig, go-cli, go-mcp | Single dynamic value type throughout; README type columns are documentary. |

## Known gaps

- No array element types, nested object schemas, enums, or formats in the
  model — `$ARRAY`/`$OBJECT` cap at untyped list / open map everywhere.
  Extending this starts in apidef's model, not in the emitters.
- `list` ops return `T[]` via op-kind inference in the op fragments, not
  via a sentinel.
- Optionality fidelity varies by tier: type-level (`?`/`Option<T>`) in
  ts/py/csharp/swift/rust; inherent nullability on the JVM; comment-only in
  c/cpp; dart renders all fields nullable and notes requiredness in docs.

## Porting checklist (new language)

See the PORT RECIPE header in `EntityTypes_ts.ts` and
[author-a-new-language](../how-to/author-a-new-language.md): add a
`CANON_TYPE`/`CANON_ANY` column (plus `CANON_UNION_JOIN` if the language
has unions), copy an emitter of the matching tier, keep the shared
`opTypeName`/`opRequestShape` policy, wire it into `Main_<lang>.ts`, and
extend `canontype.test.ts`/`entitytypes.test.ts`.
