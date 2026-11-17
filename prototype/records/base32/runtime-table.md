# What each runtime defines, read through its forms

## c

Result style: **errslot**; operations return. Record accessor: `data`, 2 parameter(s).

A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; `form` says whether it is called or is a field. A return read from a comment says so.

| operation | method | parameters | returns | fails | on | form | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list | list | Entity*, voxgig_value* reqmatch, voxgig_value* ctrl, PNError** err | Entity** | error parameter PNError** | instance | callable | tm/c/core/sdk.h |
| load | load | Entity*, voxgig_value* reqmatch, voxgig_value* ctrl, PNError** err | Entity* | error parameter PNError** | instance | callable | tm/c/core/sdk.h |
| create | create | Entity*, voxgig_value* reqdata, voxgig_value* ctrl, PNError** err | Entity* | error parameter PNError** | instance | callable | tm/c/core/sdk.h |
| update | update | Entity*, voxgig_value* reqdata, voxgig_value* ctrl, PNError** err | Entity* | error parameter PNError** | instance | callable | tm/c/core/sdk.h |
| patch | patch | Entity*, voxgig_value* reqdata, voxgig_value* ctrl, PNError** err | Entity* | error parameter PNError** | instance | callable | tm/c/core/sdk.h |
| remove | remove | Entity*, voxgig_value* reqmatch, voxgig_value* ctrl, PNError** err | Entity* | error parameter PNError** | instance | callable | tm/c/core/sdk.h |

Every operation's declaration shows its failure as `PNError**`; a call to one is written with `&err`.

Entity accessor: `${cAccessorName(model, entity.name)}(${Name}SDK* client, voxgig_value* entopts)`; the entity constructor: `entyvar_entity_new(ProjectNameSDK* client, voxgig_value* entopts)`.

| constructor | declaration | parameters | returns | fails | on | form |
| --- | --- | --- | --- | --- | --- | --- |
| client | projectname_sdk_new | (voxgig_value* options) | ProjectNameSDK* |  | module | callable |
| test | test_sdk | (voxgig_value* testopts, voxgig_value* sdkopts) | ProjectNameSDK* |  | module | callable |

| client member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| projectname_sdk_new | (voxgig_value* options) | ProjectNameSDK* |  | module | callable |  |  |
| sdk_direct | (ProjectNameSDK* sdk, voxgig_value* fetchargs, PNError** err) | voxgig_value* | error parameter PNError** | module | callable | direct |  |
| sdk_get_utility | (ProjectNameSDK* sdk) | Utility* |  | module | callable | utility |  |
| sdk_graphql | (ProjectNameSDK* sdk, const char* query, voxgig_value* variables, voxgig_value* ctrl, PNError** err) | voxgig_value* | error parameter PNError** | module | callable |  |  |
| sdk_options_map | (ProjectNameSDK* sdk) | voxgig_value* |  | module | callable | options |  |
| sdk_prepare | (ProjectNameSDK* sdk, voxgig_value* fetchargs, PNError** err) | voxgig_value* | error parameter PNError** | module | callable | prepare |  |
| test_sdk | (voxgig_value* testopts, voxgig_value* sdkopts) | ProjectNameSDK* |  | module | callable |  |  |

| entity member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| create | (Entity*, voxgig_value* reqdata, voxgig_value* ctrl, PNError** err) | Entity* | error parameter PNError** | instance | callable |  |  |
| data | (Entity*, voxgig_value* args) | voxgig_value* |  | instance | callable | data | dataArg |
| deleted | (Entity*) | bool |  | instance | callable |  |  |
| entyvar_entity_new | (ProjectNameSDK* client, voxgig_value* entopts) | Entity* |  | module | callable |  |  |
| entyvar_stream | (Entity* e, const char* action, voxgig_value* args, voxgig_value* callopts, PNError** err) | voxgig_value* | error parameter PNError** | module | callable | stream | streamList |
| get_name | (Entity*) | const char* |  | instance | callable | name |  |
| list | (Entity*, voxgig_value* reqmatch, voxgig_value* ctrl, PNError** err) | Entity** | error parameter PNError** | instance | callable |  |  |
| load | (Entity*, voxgig_value* reqmatch, voxgig_value* ctrl, PNError** err) | Entity* | error parameter PNError** | instance | callable |  |  |
| make | (Entity*) | Entity* |  | instance | callable | make |  |
| mark_deleted | (Entity*) | void |  | instance | callable |  |  |
| matchv | (Entity*, voxgig_value* args) | voxgig_value* |  | instance | callable | match | matchArg |
| patch | (Entity*, voxgig_value* reqdata, voxgig_value* ctrl, PNError** err) | Entity* | error parameter PNError** | instance | callable |  |  |
| remove | (Entity*, voxgig_value* reqmatch, voxgig_value* ctrl, PNError** err) | Entity* | error parameter PNError** | instance | callable |  |  |
| update | (Entity*, voxgig_value* reqdata, voxgig_value* ctrl, PNError** err) | Entity* | error parameter PNError** | instance | callable |  |  |

Members the runtime does not have: none.

Stream (src/cmp/c/fragment/Entity.fragment.c): the operation runs **before it returns** (a provider declares `runs: 'call'`); the streaming feature's items are read **before it returns**; without the feature the items are the whole result, read before the first one is handed over.

Field types (`canonToType`, column `c`): STRING `char*`, INTEGER `int64_t`, NUMBER `double`, BOOLEAN `bool`, NULL `voxgig_value*`, ARRAY `voxgig_value*`, OBJECT `voxgig_value*`, ANY `voxgig_value*`.

## clojure

Result style: **raise**; operations return. Record accessor: `data-get`, 0 parameter(s).

A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; `form` says whether it is called or is a field. A return read from a comment says so.

| operation | method | parameters | returns | fails | on | form | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list | list | ent, reqmatch, ctrl |  |  | module | callable | src/cmp/clojure/fragment/EntityListOp.fragment.clj |
| load | load | ent, reqmatch, ctrl |  |  | module | callable | src/cmp/clojure/fragment/EntityLoadOp.fragment.clj |
| create | create | ent, reqdata, ctrl |  |  | module | callable | src/cmp/clojure/fragment/EntityCreateOp.fragment.clj |
| update | update | ent, reqdata, ctrl |  |  | module | callable | src/cmp/clojure/fragment/EntityUpdateOp.fragment.clj |
| patch | patch | ent, reqdata, ctrl |  |  | module | callable | src/cmp/clojure/fragment/EntityPatchOp.fragment.clj |
| remove | remove | ent, reqmatch, ctrl |  |  | module | callable | src/cmp/clojure/fragment/EntityRemoveOp.fragment.clj |

Entity accessor: `${cljAccessor(entity)}(client, data)`; the entity constructor: `new-entity(client, entopts)`.

| constructor | declaration | parameters | returns | fails | on | form |
| --- | --- | --- | --- | --- | --- | --- |
| client | make-sdk | (options) |  |  | module | callable |
| test | test-sdk | (testopts, sdkopts) |  |  | module | callable |

| client member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| direct | (client, fetchargs) |  |  | module | callable | direct |  |
| graphql | (not read) |  |  | |  |  |  |
| make-sdk | (options) |  |  | module | callable |  |  |
| options-map | (client) |  |  | module | callable | options |  |
| prepare | (client, fetchargs) |  |  | module | callable | prepare |  |
| test-sdk | (testopts, sdkopts) |  |  | module | callable |  |  |

| entity member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data-get | () |  |  | instance | callable | dataGet | dataGet + dataSet |
| data-set | (args) |  |  | instance | callable | dataSet | dataGet + dataSet |
| deleted | (ent) |  |  | module | callable |  |  |
| get-name | () |  |  | instance | callable | name |  |
| make | () or (client, data) |  |  | instance | callable or  | module | callable | make |  |
| mark-deleted | (ent) |  |  | module | callable |  |  |
| match-get | () |  |  | instance | callable | matchGet | matchGet + matchSet |
| match-set | (args) |  |  | instance | callable | matchSet | matchGet + matchSet |
| stream | (ent, action, args, callopts) |  |  | module | callable | stream | streamLazy |

Members the runtime does not have: utility.

Stream (src/cmp/clojure/fragment/Entity.fragment.clj): the operation runs **before it returns** (a provider declares `runs: 'call'`); the streaming feature's items are read **before it returns**; without the feature the items are the whole result, read before the first one is handed over.

Field types: no code generator column (the code generator has no clojure column in canonToType; the page's type words are the provider's own).

## cpp

Result style: **throw**; operations return. Record accessor: `data`, 1 parameter(s).

A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; `form` says whether it is called or is a field. A return read from a comment says so.

| operation | method | parameters | returns | fails | on | form | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list | list | const Value& reqmatch, const Value& ctrl | std::vector<SdkEntityPtr> |  | instance | callable | src/cmp/cpp/fragment/EntityListOp.fragment.cpp |
| load | load | const Value& reqmatch, const Value& ctrl | SdkEntityPtr |  | instance | callable | src/cmp/cpp/fragment/EntityLoadOp.fragment.cpp |
| create | create | const Value& reqdata, const Value& ctrl | SdkEntityPtr |  | instance | callable | src/cmp/cpp/fragment/EntityCreateOp.fragment.cpp |
| update | update | const Value& reqdata, const Value& ctrl | SdkEntityPtr |  | instance | callable | src/cmp/cpp/fragment/EntityUpdateOp.fragment.cpp |
| patch | patch | const Value& reqdata, const Value& ctrl | SdkEntityPtr |  | instance | callable | src/cmp/cpp/fragment/EntityPatchOp.fragment.cpp |
| remove | remove | const Value& reqmatch, const Value& ctrl | SdkEntityPtr |  | instance | callable | src/cmp/cpp/fragment/EntityRemoveOp.fragment.cpp |

Entity accessor: `${accessor}(Value entopts = Value::undef())` -> `std::shared_ptr<${cls}>`; the entity constructor: `EntyClass(SdkClient* client, Value entopts = Value::undef())`.

| constructor | declaration | parameters | returns | fails | on | form |
| --- | --- | --- | --- | --- | --- | --- |
| client | ProjectNameSDK | (Value options = Value::undef() [optional]) |  |  | type | callable |
| test | testSDK | () or (Value testopts, Value sdkopts) | std::shared_ptr<ProjectNameSDK> |  | type | callable |

| client member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| create | () | std::shared_ptr<ProjectNameSDK> |  | type | callable |  |  |
| direct | (const Value& fetchargs) | Value |  | instance | callable | direct |  |
| features | property or field | std::vector<FeaturePtr> |  | instance | field |  |  |
| getRootCtx | () | CtxPtr |  | instance | callable |  |  |
| getUtility | () | UtilityPtr |  | instance | callable | utility |  |
| graphql | (const std::string& query, const Value& variables = Value::undef() [optional], const Value& ctrl = Value::undef() [optional]) | Value |  | instance | callable |  |  |
| mode | property or field | std::string |  | instance | field |  |  |
| opAllowed | (const std::string& op) | bool |  | instance | callable |  |  |
| opDenied | (const std::string& op) | Value |  | instance | callable |  |  |
| options | property or field | Value |  | instance | field |  |  |
| optionsMap | () | Value |  | instance | callable | options |  |
| prepare | (const Value& fetchargs) | Value |  | instance | callable | prepare |  |
| rawRequest | (const Value& fetchargs) | Value |  | instance | callable |  |  |
| rootctx | property or field | CtxPtr |  | instance | field |  |  |
| testOptions | (const Value& testopts, const Value& sdkopts) | Value |  | type | callable |  |  |
| testSDK | () or (Value testopts, Value sdkopts) | std::shared_ptr<ProjectNameSDK> |  | type | callable |  |  |
| to_string | () | std::string |  | instance | callable |  |  |
| utility | property or field | UtilityPtr |  | instance | field |  |  |

| entity member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| client | property or field | SdkClient* |  | instance | field |  |  |
| data | (const Value& arg = Value::undef() [optional]) | Value |  | instance | callable | data | data |
| data_ | property or field | Value |  | instance | field |  |  |
| deleted | () | bool |  | instance | callable |  |  |
| deleted_ | property or field | bool |  | instance | field |  |  |
| entctx | property or field | CtxPtr |  | instance | field |  |  |
| entopts | property or field | Value |  | instance | field |  |  |
| getName | () | std::string |  | instance | callable | name |  |
| make | () | EntityPtr |  | instance | callable | make |  |
| markDeleted | () | void |  | instance | callable |  |  |
| match | (const Value& arg = Value::undef() [optional]) | Value |  | instance | callable | match | match |
| match_ | property or field | Value |  | instance | field |  |  |
| name_ | property or field | std::string |  | instance | field |  |  |
| runOp | (CtxPtr ctx, const std::function<void()>& postDone) | Value |  | instance | callable |  |  |
| self | () | SdkEntityPtr |  | instance | callable |  |  |
| stream | (const std::string& action, const Value& args = Value::undef() [optional], const Value& callopts = Value::undef() [optional]) | std::vector<Value> |  | instance | callable | stream | streamList |
| utility | property or field | UtilityPtr |  | instance | field |  |  |

Members the runtime does not have: none.

Stream (tm/cpp/core/types.hpp): the operation runs **before it returns** (a provider declares `runs: 'call'`); the streaming feature's items are read **before it returns**; without the feature the items are the whole result, read before the first one is handed over.
- `ref.facts.direct.okFalse`, cited ahead of a provider: `false` (tm/cpp/core/types.hpp: `map_put(out, "ok", Value(false));`)

Field types (`canonToType`, column `cpp`): STRING `std::string`, INTEGER `int64_t`, NUMBER `double`, BOOLEAN `bool`, NULL `Value`, ARRAY `std::vector<Value>`, OBJECT `std::map<std::string, Value>`, ANY `Value`.

## csharp

Result style: **throw**; operations return. Record accessor: `Data`, 1 parameter(s).

A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; `form` says whether it is called or is a field. A return read from a comment says so.

| operation | method | parameters | returns | fails | on | form | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list | List | Dictionary<string, object?>? reqmatch, Dictionary<string, object?>? ctrl = null [optional] | object? |  | instance | callable | src/cmp/csharp/fragment/EntityListOp.fragment.cs |
| load | Load | Dictionary<string, object?>? reqmatch, Dictionary<string, object?>? ctrl = null [optional] | object? |  | instance | callable | src/cmp/csharp/fragment/EntityLoadOp.fragment.cs |
| create | Create | Dictionary<string, object?>? reqdata, Dictionary<string, object?>? ctrl = null [optional] | object? |  | instance | callable | src/cmp/csharp/fragment/EntityCreateOp.fragment.cs |
| update | Update | Dictionary<string, object?>? reqdata, Dictionary<string, object?>? ctrl = null [optional] | object? |  | instance | callable | src/cmp/csharp/fragment/EntityUpdateOp.fragment.cs |
| patch | Patch | Dictionary<string, object?>? reqdata, Dictionary<string, object?>? ctrl = null [optional] | object? |  | instance | callable | src/cmp/csharp/fragment/EntityPatchOp.fragment.cs |
| remove | Remove | Dictionary<string, object?>? reqmatch, Dictionary<string, object?>? ctrl = null [optional] | object? |  | instance | callable | src/cmp/csharp/fragment/EntityRemoveOp.fragment.cs |

Entity accessor: `${entity.Name}(Dictionary<string, object?>? entopts = null)` -> `${model.const.Name}EntityBase`; the entity constructor: `EntyClass(ProjectNameSDK client, Dictionary<string, object?>? entopts = null)`.

| constructor | declaration | parameters | returns | fails | on | form |
| --- | --- | --- | --- | --- | --- | --- |
| client | ProjectNameSDK | (Dictionary<string, object?>? options = null [optional]) |  |  | type | callable |
| test | TestSDK | (Dictionary<string, object?>? testopts, Dictionary<string, object?>? sdkopts) | ProjectNameSDK |  | type | callable |

| client member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Direct | (Dictionary<string, object?>? fetchargs) | Dictionary<string, object?> |  | instance | callable | direct |  |
| GetRootCtx | () | Context |  | instance | callable |  |  |
| GetUtility | () | Utility |  | instance | callable | utility |  |
| Graphql | (string query, Dictionary<string, object?>? variables = null [optional], Dictionary<string, object?>? ctrl = null [optional]) | Dictionary<string, object?> |  | instance | callable |  |  |
| OptionsMap | () | Dictionary<string, object?> |  | instance | callable | options |  |
| Prepare | (Dictionary<string, object?>? fetchargs) | Dictionary<string, object?> |  | instance | callable | prepare |  |
| TestSDK | (Dictionary<string, object?>? testopts, Dictionary<string, object?>? sdkopts) | ProjectNameSDK |  | type | callable |  |  |

| entity member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Create | (Dictionary<string, object?>? reqdata, Dictionary<string, object?>? ctrl = null [optional]) | object? |  | instance | callable |  |  |
| Data | (object? newdata = null [optional]) | object? |  | instance | callable | data | data |
| Deleted | () | bool |  | instance | callable |  |  |
| GetName | () | string |  | instance | callable | name |  |
| List | (Dictionary<string, object?>? reqmatch, Dictionary<string, object?>? ctrl = null [optional]) | object? |  | instance | callable |  |  |
| Load | (Dictionary<string, object?>? reqmatch, Dictionary<string, object?>? ctrl = null [optional]) | object? |  | instance | callable |  |  |
| Make | () | IEntity |  | instance | callable | make |  |
| MarkDeleted | () | void |  | instance | callable |  |  |
| Match | (object? newmatch = null [optional]) | object? |  | instance | callable | match | match |
| Patch | (Dictionary<string, object?>? reqdata, Dictionary<string, object?>? ctrl = null [optional]) | object? |  | instance | callable |  |  |
| Remove | (Dictionary<string, object?>? reqmatch, Dictionary<string, object?>? ctrl = null [optional]) | object? |  | instance | callable |  |  |
| Stream | (string action, Dictionary<string, object?>? args = null [optional], Dictionary<string, object?>? callopts = null [optional], [EnumeratorCancellation] CancellationToken cancel = default [optional]) | IAsyncEnumerable<object?> |  | instance | callable | stream | streamIterator |
| Update | (Dictionary<string, object?>? reqdata, Dictionary<string, object?>? ctrl = null [optional]) | object? |  | instance | callable |  |  |

Members the runtime does not have: none.

Stream (src/cmp/csharp/fragment/EntityBase.fragment.cs): the operation runs **as the caller iterates** (a provider declares `runs: 'iterate'`); the streaming feature's items are read **as the caller iterates**; without the feature the items are the whole result, read before the first one is handed over.
- `ref.facts.direct.okFalse`, cited ahead of a provider: `false` (src/cmp/csharp/fragment/Main.fragment.cs: `["ok"] = false,`)

Field types (`canonToType`, column `csharp`): STRING `string`, INTEGER `long`, NUMBER `double`, BOOLEAN `bool`, NULL `object?`, ARRAY `List<object?>`, OBJECT `Dictionary<string, object?>`, ANY `object?`.

## elixir

Result style: **raise**; operations return. Record accessor: `data_get`, 1 parameter(s).

A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; `form` says whether it is called or is a field. A return read from a comment says so.

| operation | method | parameters | returns | fails | on | form | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list | list | ent, reqmatch \\ nil [optional], ctrl \\ nil [optional] | term() |  | module | callable | src/cmp/elixir/fragment/EntityListOp.fragment.ex |
| load | load | ent, reqmatch \\ nil [optional], ctrl \\ nil [optional] | term() |  | module | callable | src/cmp/elixir/fragment/EntityLoadOp.fragment.ex |
| create | create | ent, reqdata, ctrl \\ nil [optional] | term() |  | module | callable | src/cmp/elixir/fragment/EntityCreateOp.fragment.ex |
| update | update | ent, reqdata, ctrl \\ nil [optional] | term() |  | module | callable | src/cmp/elixir/fragment/EntityUpdateOp.fragment.ex |
| patch | patch | ent, reqdata, ctrl \\ nil [optional] | term() |  | module | callable | src/cmp/elixir/fragment/EntityPatchOp.fragment.ex |
| remove | remove | ent, reqmatch \\ nil [optional], ctrl \\ nil [optional] | term() |  | module | callable | src/cmp/elixir/fragment/EntityRemoveOp.fragment.ex |

Entity accessor: `${accessor}(client, entopts \\\\ nil)`; the entity constructor: `new(client, entopts \\ nil)`.

| constructor | declaration | parameters | returns | fails | on | form |
| --- | --- | --- | --- | --- | --- | --- |
| client | new | (options \\ nil [optional]) |  |  | module | callable |
| test | test | (testopts \\ nil [optional], sdkopts \\ nil [optional]) |  |  | module | callable |

| client member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| direct | (client, fetchargs \\ nil [optional]) |  |  | module | callable | direct |  |
| get_root_ctx | (client) |  |  | module | callable |  |  |
| get_utility | (client) |  |  | module | callable | utility |  |
| graphql | (client, query, variables \\ nil [optional], ctrl \\ nil [optional]) |  |  | module | callable |  |  |
| mode | (client) |  |  | module | callable |  |  |
| new | (options \\ nil [optional]) |  |  | module | callable |  |  |
| options_map | (client) |  |  | module | callable | options |  |
| prepare | (client, fetchargs \\ nil [optional]) |  |  | module | callable | prepare |  |
| test | (testopts \\ nil [optional], sdkopts \\ nil [optional]) |  |  | module | callable |  |  |

| entity member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| construct | (module, client, name, entopts \\ nil [optional]) |  |  | module | callable |  |  |
| data_get | (ent) |  |  | module | callable | dataGet | dataGet + dataSet |
| data_set | (ent, args) or (ent, args \\ nil [optional]) |  |  | module | callable | dataSet | dataGet + dataSet |
| deleted | (ent) |  |  | module | callable |  |  |
| get_name | (ent) |  |  | module | callable | name |  |
| make | (ent) |  |  | module | callable | make |  |
| mark_deleted | (ent) |  |  | module | callable |  |  |
| match_get | (ent) |  |  | module | callable | matchGet | matchGet + matchSet |
| match_set | (ent, args) or (ent, args \\ nil [optional]) |  |  | module | callable | matchSet | matchGet + matchSet |
| new | (client, entopts \\ nil [optional]) |  |  | module | callable |  |  |
| op_return | (ent, ctx, out) |  |  | module | callable |  |  |
| stream | (ent, action, args \\ nil [optional], callopts \\ nil [optional]) |  |  | module | callable | stream | streamLazy |

Members the runtime does not have: none.

Stream (tm/elixir/lib/projectname/entity_base.ex): the operation runs **before it returns** (a provider declares `runs: 'call'`); the streaming feature's items are read **before it returns**; without the feature the items are the whole result, read before the first one is handed over.

Field types (`canonToType`, column `elixir`): STRING `String.t()`, INTEGER `integer()`, NUMBER `float()`, BOOLEAN `boolean()`, NULL `nil`, ARRAY `list()`, OBJECT `map()`, ANY `any()`.

## go

Result style: **pair**; operations return. Record accessor: `Data`, 1 parameter(s).

A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; `form` says whether it is called or is a field. A return read from a comment says so.

| operation | method | parameters | returns | fails | on | form | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list | List | reqmatch map[string]any, ctrl map[string]any | (any, error) | second value error | instance | callable | src/cmp/go/fragment/EntityListOp.fragment.go |
| load | Load | reqmatch map[string]any, ctrl map[string]any | (any, error) | second value error | instance | callable | src/cmp/go/fragment/EntityLoadOp.fragment.go |
| create | Create | reqdata map[string]any, ctrl map[string]any | (any, error) | second value error | instance | callable | src/cmp/go/fragment/EntityCreateOp.fragment.go |
| update | Update | reqdata map[string]any, ctrl map[string]any | (any, error) | second value error | instance | callable | src/cmp/go/fragment/EntityUpdateOp.fragment.go |
| patch | Patch | reqdata map[string]any, ctrl map[string]any | (any, error) | second value error | instance | callable | src/cmp/go/fragment/EntityPatchOp.fragment.go |
| remove | Remove | reqmatch map[string]any, ctrl map[string]any | (any, error) | second value error | instance | callable | src/cmp/go/fragment/EntityRemoveOp.fragment.go |

Every operation's declaration shows its failure as `error`; a call to one is written with `err`.

Entity accessor: `${entity.Name}(data map[string]any)` -> `ProjectNameEntityBase`; the entity constructor: `NewEntyClass(client *core.ProjectNameSDK, entopts map[string]any)`.

| constructor | declaration | parameters | returns | fails | on | form |
| --- | --- | --- | --- | --- | --- | --- |
| client | NewProjectNameSDK | (options map[string]any) | *ProjectNameSDK |  | module | callable |
| test | TestSDK | (testopts map[string]any, sdkopts map[string]any) | *ProjectNameSDK |  | module | callable |

| client member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Direct | (fetchargs map[string]any) | (map[string]any, error) | second value error | instance | callable | direct |  |
| GetRootCtx | () | *Context |  | instance | callable |  |  |
| GetUtility | () | *Utility |  | instance | callable | utility |  |
| Graphql | (query string, variables map[string]any, ctrl map[string]any) | (map[string]any, error) | second value error | instance | callable |  |  |
| New | () | *ProjectNameSDK |  | module | callable |  |  |
| NewProjectNameSDK | (options map[string]any) | *ProjectNameSDK |  | module | callable |  |  |
| OptionsMap | () | map[string]any |  | instance | callable | options |  |
| Prepare | (fetchargs map[string]any) | (map[string]any, error) | second value error | instance | callable | prepare |  |
| Test | () | *ProjectNameSDK |  | module | callable |  |  |
| TestSDK | (testopts map[string]any, sdkopts map[string]any) | *ProjectNameSDK |  | module | callable |  |  |

| entity member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Data | (args ...any [optional]) | any |  | instance | callable | data | data |
| DataTyped | (data ...EntityName [optional]) | EntityName |  | instance | callable |  |  |
| Deleted | () | bool |  | instance | callable |  |  |
| GetName | () | string |  | instance | callable | name |  |
| GoString | () | string |  | instance | callable |  |  |
| Make | () | Entity |  | instance | callable | make |  |
| MarkDeleted | () |  |  | instance | callable |  |  |
| MarshalJSON | () | ([]byte, error) | second value error | instance | callable |  |  |
| Match | (args ...any [optional]) | any |  | instance | callable | match | match |
| MatchTyped | (match ...EntityName [optional]) | EntityName |  | instance | callable |  |  |
| Stream | (action string, args map[string]any, callopts map[string]any) | <-chan StreamItem |  | instance | callable | stream | stream |
| String | () | string |  | instance | callable |  |  |

Members the runtime does not have: none.

Stream (src/cmp/go/fragment/Entity.fragment.go): the operation runs **from the call, beside the caller** (a provider declares `runs: 'background'`); the streaming feature's items are read **from the call, beside the caller**; without the feature the items are the whole result, read before the first one is handed over.

Field types (`canonToType`, column `go`): STRING `string`, INTEGER `int`, NUMBER `float64`, BOOLEAN `bool`, NULL `any`, ARRAY `[]any`, OBJECT `map[string]any`, ANY `any`.

## java

Result style: **throw**; operations return. Record accessor: `data`, 1 parameter(s).

A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; `form` says whether it is called or is a field. A return read from a comment says so.

| operation | method | parameters | returns | fails | on | form | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list | list | Map<String, Object> reqmatch, Map<String, Object> ctrl | Object |  | instance | callable | src/cmp/java/fragment/EntityListOp.fragment.java |
| load | load | Map<String, Object> reqmatch, Map<String, Object> ctrl | Object |  | instance | callable | src/cmp/java/fragment/EntityLoadOp.fragment.java |
| create | create | Map<String, Object> reqdata, Map<String, Object> ctrl | Object |  | instance | callable | src/cmp/java/fragment/EntityCreateOp.fragment.java |
| update | update | Map<String, Object> reqdata, Map<String, Object> ctrl | Object |  | instance | callable | src/cmp/java/fragment/EntityUpdateOp.fragment.java |
| patch | patch | Map<String, Object> reqdata, Map<String, Object> ctrl | Object |  | instance | callable | src/cmp/java/fragment/EntityPatchOp.fragment.java |
| remove | remove | Map<String, Object> reqmatch, Map<String, Object> ctrl | Object |  | instance | callable | src/cmp/java/fragment/EntityRemoveOp.fragment.java |

Entity accessor: `${accessor}(Map<String, Object> entopts)` -> `SdkEntity`; the entity constructor: `EntyClass(SdkClient client, Map<String, Object> entopts)`.

| constructor | declaration | parameters | returns | fails | on | form |
| --- | --- | --- | --- | --- | --- | --- |
| client | ProjectNameSDK | () or (Map<String, Object> options) |  |  | type | callable |
| test | testSDK | () or (Map<String, Object> testopts, Map<String, Object> sdkopts) | ProjectNameSDK |  | type | callable |

| client member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| direct | (Map<String, Object> fetchargs) | Map<String, Object> |  | instance | callable | direct |  |
| getRootCtx | () | Context |  | instance | callable |  |  |
| getUtility | () | Utility |  | instance | callable | utility |  |
| graphql | (String query, Map<String, Object> variables, Map<String, Object> ctrl) | Map<String, Object> |  | instance | callable |  |  |
| optionsMap | () | Map<String, Object> |  | instance | callable | options |  |
| prepare | (Map<String, Object> fetchargs) | Map<String, Object> |  | instance | callable | prepare |  |
| testSDK | () or (Map<String, Object> testopts, Map<String, Object> sdkopts) | ProjectNameSDK |  | type | callable |  |  |

| entity member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data | (Object... args [optional]) | Object |  | instance | callable | data | data |
| deleted | () | boolean |  | instance | callable |  |  |
| getName | () | String |  | instance | callable | name |  |
| make | () | Entity |  | instance | callable | make |  |
| markDeleted | () | void |  | instance | callable |  |  |
| match | (Object... args [optional]) | Object |  | instance | callable | match | match |
| stream | (String action, Map<String, Object> args, Map<String, Object> callopts) | Stream<Object> |  | instance | callable | stream | streamLazy |

Members the runtime does not have: none.

Stream (src/cmp/java/fragment/EntityBase.fragment.java): the operation runs **before it returns** (a provider declares `runs: 'call'`); the streaming feature's items are read **as the caller iterates**; without the feature the items are the whole result, read before the first one is handed over.
- `ref.facts.direct.okFalse`, cited ahead of a provider: `false` (tm/java/core/SdkClient.java: `out.put("ok", false);`)

Field types (`canonToType`, column `java`): STRING `String`, INTEGER `Long`, NUMBER `Double`, BOOLEAN `Boolean`, NULL `Object`, ARRAY `List<Object>`, OBJECT `Map<String, Object>`, ANY `Object`.

## js

Result style: **throw**; operations resolve asynchronously. Record accessor: `data`, 1 parameter(s).

A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; `form` says whether it is called or is a field. A return read from a comment says so.

| operation | method | parameters | returns | fails | on | form | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list | list | reqmatch [optional], ctrl [optional] |  |  | instance | callable | src/cmp/js/fragment/EntityListOp.fragment.js |
| load | load | reqmatch [optional], ctrl [optional] |  |  | instance | callable | src/cmp/js/fragment/EntityLoadOp.fragment.js |
| create | create | reqdata [optional], ctrl [optional] |  |  | instance | callable | src/cmp/js/fragment/EntityCreateOp.fragment.js |
| update | update | reqdata [optional], ctrl [optional] |  |  | instance | callable | src/cmp/js/fragment/EntityUpdateOp.fragment.js |
| patch | patch | reqdata [optional], ctrl [optional] |  |  | instance | callable | src/cmp/js/fragment/EntityPatchOp.fragment.js |
| remove | remove | reqmatch [optional], ctrl [optional] |  |  | instance | callable | src/cmp/js/fragment/EntityRemoveOp.fragment.js |

Entity accessor: `${entity.Name}(entopts)`; the entity constructor: `constructor(client, entopts)`.

| constructor | declaration | parameters | returns | fails | on | form |
| --- | --- | --- | --- | --- | --- | --- |
| client | constructor | (options [optional]) |  |  | type | callable |
| test | test | (testoptsarg [optional], sdkoptsarg [optional]) |  |  | type | callable |

| client member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| direct | (fetchargs [optional]) |  |  | instance | callable | direct |  |
| graphql | (query [optional], variables [optional], ctrl [optional]) |  |  | instance | callable |  |  |
| options | () |  |  | instance | callable | options |  |
| prepare | (fetchargs [optional]) |  |  | instance | callable | prepare |  |
| test | (testoptsarg [optional], sdkoptsarg [optional]) |  |  | type | callable |  |  |
| tester | (testopts [optional], sdkopts [optional]) |  |  | instance | callable | tester |  |
| toJSON | () |  |  | instance | callable |  |  |
| toString | () |  |  | instance | callable |  |  |
| utility | () |  |  | instance | callable | utility |  |

| entity member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| client | () |  |  | instance | callable | client |  |
| data | (data [optional]) |  |  | instance | callable | data | data |
| deleted | () |  |  | instance | callable |  |  |
| entopts | () |  |  | instance | callable | entopts |  |
| make | () |  |  | instance | callable | make |  |
| markDeleted | () |  |  | instance | callable |  |  |
| match | (match [optional]) |  |  | instance | callable | match | match |
| stream | (action [optional], args [optional], callopts [optional]) |  |  | instance | callable | stream | streamIterator |
| toJSON | () |  |  | instance | callable |  |  |
| toString | () |  |  | instance | callable |  |  |

Members the runtime does not have: name.

Stream (src/cmp/js/fragment/EntityBase.fragment.js): the operation runs **as the caller iterates** (a provider declares `runs: 'iterate'`); the streaming feature's items are read **as the caller iterates**; without the feature the items are the whole result, read before the first one is handed over.
- `ref.facts.direct.okFalse`, cited ahead of a provider: `false` (src/cmp/js/fragment/Main.fragment.js: `return { ok: false, err: utility.clean(this._rootctx, fetchdef) }`)

Field types (`canonToType`, column `js`): STRING `string`, INTEGER `number`, NUMBER `number`, BOOLEAN `boolean`, NULL `null`, ARRAY `Array`, OBJECT `Object`, ANY `*`.

## kotlin

Result style: **throw**; operations return. Record accessor: `data`, 1 parameter(s).

A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; `form` says whether it is called or is a field. A return read from a comment says so.

| operation | method | parameters | returns | fails | on | form | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list | list | reqmatch: MutableMap<String, Any?>?, ctrl: MutableMap<String, Any?>? | Any? |  | instance | callable | src/cmp/kotlin/fragment/EntityListOp.fragment.kt |
| load | load | reqmatch: MutableMap<String, Any?>?, ctrl: MutableMap<String, Any?>? | Any? |  | instance | callable | src/cmp/kotlin/fragment/EntityLoadOp.fragment.kt |
| create | create | reqdata: MutableMap<String, Any?>?, ctrl: MutableMap<String, Any?>? | Any? |  | instance | callable | src/cmp/kotlin/fragment/EntityCreateOp.fragment.kt |
| update | update | reqdata: MutableMap<String, Any?>?, ctrl: MutableMap<String, Any?>? | Any? |  | instance | callable | src/cmp/kotlin/fragment/EntityUpdateOp.fragment.kt |
| patch | patch | reqdata: MutableMap<String, Any?>?, ctrl: MutableMap<String, Any?>? | Any? |  | instance | callable | src/cmp/kotlin/fragment/EntityPatchOp.fragment.kt |
| remove | remove | reqmatch: MutableMap<String, Any?>?, ctrl: MutableMap<String, Any?>? | Any? |  | instance | callable | src/cmp/kotlin/fragment/EntityRemoveOp.fragment.kt |

Entity accessor: `${accessor}(entopts: MutableMap<String, Any?>?)` -> `SdkEntity`; the entity constructor: `EntyClass(clientIn: SdkClient, entoptsIn: MutableMap<String, Any?>?)`.

| constructor | declaration | parameters | returns | fails | on | form |
| --- | --- | --- | --- | --- | --- | --- |
| client | ProjectNameSDK | (options: MutableMap<String, Any?>?) |  |  | type | callable |
| test | testSDK | () or (testopts: MutableMap<String, Any?>?, sdkopts: MutableMap<String, Any?>?) | ProjectNameSDK |  | type | callable |

| client member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| direct | (fetchargsIn: MutableMap<String, Any?>?) | MutableMap<String, Any?> |  | instance | callable | direct |  |
| features | property or field | MutableList<Feature> |  | instance | field |  |  |
| getRootCtx | () | Context |  | instance | callable |  |  |
| getUtility | () | Utility |  | instance | callable | utility |  |
| graphql | (query: String, variables: MutableMap<String, Any?>? = null [optional], ctrl: MutableMap<String, Any?>? = null [optional]) | MutableMap<String, Any?> |  | instance | callable |  |  |
| mode | property or field | String |  | instance | field |  |  |
| optionsMap | () | MutableMap<String, Any?> |  | instance | callable | options |  |
| prepare | (fetchargsIn: MutableMap<String, Any?>?) | MutableMap<String, Any?> |  | instance | callable | prepare |  |
| testOptions | (testopts: MutableMap<String, Any?>?, sdkopts: MutableMap<String, Any?>?) | MutableMap<String, Any?> |  | type | callable |  |  |
| testSDK | () or (testopts: MutableMap<String, Any?>?, sdkopts: MutableMap<String, Any?>?) | ProjectNameSDK |  | type | callable |  |  |
| toString | () | String |  | instance | callable |  |  |

| entity member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data | (vararg args: Any? [optional]) | Any? |  | instance | callable | data | data |
| deleted | () | Boolean |  | instance | callable |  |  |
| make | () | Entity |  | instance | callable | make |  |
| markDeleted | () |  |  | instance | callable |  |  |
| match | (vararg args: Any? [optional]) | Any? |  | instance | callable | match | match |
| name | property or field | String |  | instance | field | name |  |
| stream | (action: String, args: MutableMap<String, Any?>?, callopts: MutableMap<String, Any?>?) | Sequence<Any?> |  | instance | callable | stream | streamLazy |

Members the runtime does not have: none.

Stream (src/cmp/kotlin/fragment/EntityBase.fragment.kt): the operation runs **before it returns** (a provider declares `runs: 'call'`); the streaming feature's items are read **as the caller iterates**; without the feature the items are the whole result, read before the first one is handed over.
- `ref.facts.direct.okFalse`, cited ahead of a provider: `false` (tm/kotlin/core/SdkClient.kt: `out["ok"] = false`)

Field types (`canonToType`, column `kotlin`): STRING `String?`, INTEGER `Long?`, NUMBER `Double?`, BOOLEAN `Boolean?`, NULL `Any?`, ARRAY `List<Any?>?`, OBJECT `Map<String, Any?>?`, ANY `Any?`.

## lua

Result style: **pair**; operations return. Record accessor: `data_get`, 0 parameter(s).

A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; `form` says whether it is called or is a field. A return read from a comment says so.

| operation | method | parameters | returns | fails | on | form | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list | list | reqmatch [optional], ctrl [optional] | EntyClass[], string? (from a comment) | second value string? | instance | callable | src/cmp/lua/fragment/EntityListOp.fragment.lua |
| load | load | reqmatch [optional], ctrl [optional] | EntyClass, string? (from a comment) | second value string? | instance | callable | src/cmp/lua/fragment/EntityLoadOp.fragment.lua |
| create | create | reqdata [optional], ctrl [optional] | EntyClass, string? (from a comment) | second value string? | instance | callable | src/cmp/lua/fragment/EntityCreateOp.fragment.lua |
| update | update | reqdata [optional], ctrl [optional] | EntyClass, string? (from a comment) | second value string? | instance | callable | src/cmp/lua/fragment/EntityUpdateOp.fragment.lua |
| patch | patch | reqdata [optional], ctrl [optional] | EntyClass, string? (from a comment) | second value string? | instance | callable | src/cmp/lua/fragment/EntityPatchOp.fragment.lua |
| remove | remove | reqmatch [optional], ctrl [optional] | EntyClass, string? (from a comment) | second value string? | instance | callable | src/cmp/lua/fragment/EntityRemoveOp.fragment.lua |

Every operation's declaration shows its failure as `second value`; a call to one is written with `err`.

Entity accessor: `${entity.Name}(data)`; the entity constructor: `new(client, entopts)`.

| constructor | declaration | parameters | returns | fails | on | form |
| --- | --- | --- | --- | --- | --- | --- |
| client | new | (options [optional]) |  |  | type | callable |
| test | test | (testopts [optional], sdkopts [optional]) |  |  | type | callable |

| client member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| direct | (fetchargs [optional]) |  |  | instance | callable | direct |  |
| get_root_ctx | () |  |  | instance | callable |  |  |
| get_utility | () |  |  | instance | callable | utility |  |
| graphql | (query [optional], variables [optional], ctrl [optional]) |  |  | instance | callable |  |  |
| options_map | () |  |  | instance | callable | options |  |
| prepare | (fetchargs [optional]) |  |  | instance | callable | prepare |  |
| test | (testopts [optional], sdkopts [optional]) |  |  | type | callable |  |  |
| to_record | () |  |  | instance | callable |  |  |

| entity member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data_get | () |  |  | instance | callable | dataGet | dataGet + dataSet |
| data_set | (args [optional]) |  |  | instance | callable | dataSet | dataGet + dataSet |
| deleted | () |  |  | instance | callable |  |  |
| get_name | () |  |  | instance | callable | name |  |
| make | () |  |  | instance | callable | make |  |
| mark_deleted | () |  |  | instance | callable |  |  |
| match_get | () |  |  | instance | callable | matchGet | matchGet + matchSet |
| match_set | (args [optional]) |  |  | instance | callable | matchSet | matchGet + matchSet |
| stream | (action [optional], args [optional], callopts [optional]) |  |  | instance | callable | stream | streamFunction |
| to_record | () |  |  | instance | callable |  |  |

Members the runtime does not have: none.

Stream (src/cmp/lua/fragment/Entity.fragment.lua): the operation runs **as the caller iterates** (a provider declares `runs: 'iterate'`); the streaming feature's items are read **as the caller iterates**; without the feature the items are the whole result, read before the first one is handed over.
- `ref.facts.direct.okFalse`, cited ahead of a provider: `false` (src/cmp/lua/fragment/Main.fragment.lua: `return { ok = false, err = err }, nil`)
- an operation's second value on failure: "the `sdk_err` table, with `status` and `code`, not a string" (tm/lua/utility/make_error.lua)

Field types (`canonToType`, column `lua`): STRING `string`, INTEGER `number`, NUMBER `number`, BOOLEAN `boolean`, NULL `nil`, ARRAY `table`, OBJECT `table`, ANY `any`.

## ocaml

Result style: **raise**; operations return. Record accessor: `e_data_get`, 0 parameter(s).

A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; `form` says whether it is called or is a field. A return read from a comment says so.

| operation | method | parameters | returns | fails | on | form | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list | e_list | value, value | entity_obj list |  | instance | callable | tm/ocaml/sdk_types.ml |
| load | e_load | value, value | entity_obj |  | instance | callable | tm/ocaml/sdk_types.ml |
| create | e_create | value, value | entity_obj |  | instance | callable | tm/ocaml/sdk_types.ml |
| update | e_update | value, value | entity_obj |  | instance | callable | tm/ocaml/sdk_types.ml |
| patch | e_patch | value, value | entity_obj |  | instance | callable | tm/ocaml/sdk_types.ml |
| remove | e_remove | value, value | entity_obj |  | instance | callable | tm/ocaml/sdk_types.ml |

Entity accessor: `${fn}(client : sdk_client, entopts : value)` -> `entity_obj`; the entity constructor: `make(client : sdk_client, entopts_in : value)`.

| constructor | declaration | parameters | returns | fails | on | form |
| --- | --- | --- | --- | --- | --- | --- |
| client | make | (options : value) | sdk_client |  | module | callable |
| test | test | () | sdk_client |  | module | callable |

| client member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ${fn} | (client : sdk_client, entopts : value) | entity_obj |  | module | callable |  |  |
| direct | (client : sdk_client, fetchargs : value) | value |  | module | callable | direct |  |
| entity | (_client : sdk_client, _name : string, _entopts : value) or (client : sdk_client, name : string, entopts : value) | entity_obj option |  | module | callable |  |  |
| graphql | (client : sdk_client, query : string, variables : value, ctrl : value) | value |  | module | callable |  |  |
| make | (options : value) | sdk_client |  | module | callable |  |  |
| make0 | () | sdk_client |  | module | callable |  |  |
| prepare | (client : sdk_client, fetchargs : value) | value |  | module | callable | prepare |  |
| test | () | sdk_client |  | module | callable |  |  |
| test_with | (testopts : value, sdkopts : value) | sdk_client |  | module | callable |  |  |

| entity member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| e_client | property or field | sdk_client |  | instance | field |  |  |
| e_create | (value, value) | entity_obj |  | instance | callable |  |  |
| e_data | property or field | value |  | instance | field |  |  |
| e_data_get | () | value |  | instance | callable | dataGet | dataGet + dataSet |
| e_data_set | (value) | unit |  | instance | callable | dataSet | dataGet + dataSet |
| e_deleted | property or field | bool |  | instance | field |  |  |
| e_entctx | property or field | ctx |  | instance | field |  |  |
| e_entopts | property or field | value |  | instance | field |  |  |
| e_list | (value, value) | entity_obj list |  | instance | callable |  |  |
| e_load | (value, value) | entity_obj |  | instance | callable |  |  |
| e_make | () | entity_obj |  | instance | callable | make |  |
| e_mark_deleted | () | unit |  | instance | callable |  |  |
| e_match | property or field | value |  | instance | field |  |  |
| e_match_get | () | value |  | instance | callable | matchGet | matchGet + matchSet |
| e_match_set | (value) | unit |  | instance | callable | matchSet | matchGet + matchSet |
| e_name | property or field | string |  | instance | field | name |  |
| e_patch | (value, value) | entity_obj |  | instance | callable |  |  |
| e_remove | (value, value) | entity_obj |  | instance | callable |  |  |
| e_stream | (string, value, value) | value Seq.t |  | instance | callable | stream | streamSync |
| e_update | (value, value) | entity_obj |  | instance | callable |  |  |
| e_utility | property or field | utility |  | instance | field |  |  |

Members the runtime does not have: options, utility.

Stream (src/cmp/ocaml/Entity_ocaml.ts): the operation runs **before it returns** (a provider declares `runs: 'call'`); the streaming feature's items are read **before it returns**; without the feature the items are the whole result, read before the first one is handed over.
- `ref.facts.direct.okFalse`, cited ahead of a provider: `false` (tm/ocaml/sdk_features.ml: `jo [("ok", Bool false);`)

Field types: no code generator column (the code generator has no ocaml column in canonToType (every type maps to any); the page's type words are the provider's own).

## perl

Result style: **die**; operations return. Record accessor: `data_get`, 0 parameter(s).

A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; `form` says whether it is called or is a field. A return read from a comment says so.

| operation | method | parameters | returns | fails | on | form | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list | list | $reqmatch [optional], $ctrl [optional] |  |  | instance | callable | src/cmp/perl/fragment/EntityListOp.fragment.pm |
| load | load | $reqmatch [optional], $ctrl [optional] |  |  | instance | callable | src/cmp/perl/fragment/EntityLoadOp.fragment.pm |
| create | create | $reqdata [optional], $ctrl [optional] |  |  | instance | callable | src/cmp/perl/fragment/EntityCreateOp.fragment.pm |
| update | update | $reqdata [optional], $ctrl [optional] |  |  | instance | callable | src/cmp/perl/fragment/EntityUpdateOp.fragment.pm |
| patch | patch | $reqdata [optional], $ctrl [optional] |  |  | instance | callable | src/cmp/perl/fragment/EntityPatchOp.fragment.pm |
| remove | remove | $reqmatch [optional], $ctrl [optional] |  |  | instance | callable | src/cmp/perl/fragment/EntityRemoveOp.fragment.pm |

Entity accessor: `${entity.Name}($data)`; the entity constructor: `new($client, $entopts)`.

| constructor | declaration | parameters | returns | fails | on | form |
| --- | --- | --- | --- | --- | --- | --- |
| client | new | ($options [optional]) |  |  | type | callable |
| test | test | ($testopts [optional], $sdkopts [optional]) |  |  | type | callable |

| client member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TO_JSON | () |  |  | module | callable |  |  |
| direct | ($fetchargs [optional]) |  |  | instance | callable | direct |  |
| get_root_ctx | () |  |  | instance | callable |  |  |
| get_utility | () |  |  | instance | callable | utility |  |
| graphql | ($query [optional], $variables [optional], $ctrl [optional]) |  |  | instance | callable |  |  |
| options_map | () |  |  | instance | callable | options |  |
| prepare | ($fetchargs [optional]) |  |  | instance | callable | prepare |  |
| test | ($testopts [optional], $sdkopts [optional]) |  |  | type | callable |  |  |
| to_string | () |  |  | instance | callable |  |  |

| entity member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TO_JSON | () |  |  | instance | callable |  |  |
| data_get | () |  |  | instance | callable | dataGet | dataGet + dataSet |
| data_set | ($args [optional]) |  |  | instance | callable | dataSet | dataGet + dataSet |
| deleted | () |  |  | instance | callable |  |  |
| get_name | () |  |  | instance | callable | name |  |
| make | () |  |  | instance | callable | make |  |
| mark_deleted | () |  |  | instance | callable |  |  |
| match_get | () |  |  | instance | callable | matchGet | matchGet + matchSet |
| match_set | ($args [optional]) |  |  | instance | callable | matchSet | matchGet + matchSet |
| stream | ($action [optional], $args [optional], $callopts [optional]) |  |  | instance | callable | stream | streamFunction |
| to_string | () |  |  | instance | callable |  |  |

Members the runtime does not have: none.

Stream (src/cmp/perl/fragment/Entity.fragment.pm): the operation runs **before it returns** (a provider declares `runs: 'call'`); the streaming feature's items are read **as the caller iterates**; without the feature the items are the whole result, read before the first one is handed over.
- `ref.facts.direct.okFalse`, cited ahead of a provider: `0` (src/cmp/perl/fragment/Main.fragment.pm: `'ok' => 0,`)
- direct's `ok`: "`0` or `1`, not a boolean" (src/cmp/perl/fragment/Main.fragment.pm)

Field types: no code generator column (the code generator has no perl column in canonToType (every type maps to any); the page's type words are the provider's own).

## php

Result style: **throw**; operations return. Record accessor: `data_get`, 0 parameter(s).

A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; `form` says whether it is called or is a field. A return read from a comment says so.

| operation | method | parameters | returns | fails | on | form | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list | list | ?array $reqmatch = null [optional], $ctrl = null [optional] | mixed |  | instance | callable | src/cmp/php/fragment/EntityListOp.fragment.php |
| load | load | ?array $reqmatch = null [optional], $ctrl = null [optional] | mixed |  | instance | callable | src/cmp/php/fragment/EntityLoadOp.fragment.php |
| create | create | ?array $reqdata = null [optional], $ctrl = null [optional] | mixed |  | instance | callable | src/cmp/php/fragment/EntityCreateOp.fragment.php |
| update | update | ?array $reqdata = null [optional], $ctrl = null [optional] | mixed |  | instance | callable | src/cmp/php/fragment/EntityUpdateOp.fragment.php |
| patch | patch | ?array $reqdata = null [optional], $ctrl = null [optional] | mixed |  | instance | callable | src/cmp/php/fragment/EntityPatchOp.fragment.php |
| remove | remove | ?array $reqmatch = null [optional], $ctrl = null [optional] | mixed |  | instance | callable | src/cmp/php/fragment/EntityRemoveOp.fragment.php |

Entity accessor: `${accessor}($data = null)`; the entity constructor: `__construct($client, ?array $entopts = null)`.

| constructor | declaration | parameters | returns | fails | on | form |
| --- | --- | --- | --- | --- | --- | --- |
| client | __construct | (array $options = [] [optional]) |  |  | type | callable |
| test | test | (?array $testopts = null [optional], ?array $sdkopts = null [optional]) | self |  | type | callable |

| client member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| direct | (array $fetchargs = [] [optional]) | mixed |  | instance | callable | direct |  |
| get_root_ctx | () |  |  | instance | callable |  |  |
| get_utility | () |  |  | instance | callable | utility |  |
| graphql | (string $query, ?array $variables = null [optional], ?array $ctrl = null [optional]) | mixed |  | instance | callable |  |  |
| jsonSerialize | () | array |  | instance | callable |  |  |
| options_map | () | array |  | instance | callable | options |  |
| prepare | (array $fetchargs = [] [optional]) | mixed |  | instance | callable | prepare |  |
| test | (?array $testopts = null [optional], ?array $sdkopts = null [optional]) | self |  | type | callable |  |  |

| entity member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data_get | () |  |  | instance | callable | dataGet | dataGet + dataSet |
| data_set | ($args) | void |  | instance | callable | dataSet | dataGet + dataSet |
| deleted | () | bool |  | instance | callable |  |  |
| get_name | () | string |  | instance | callable | name |  |
| make | () | self |  | instance | callable | make |  |
| markDeleted | () | void |  | instance | callable |  |  |
| match_get | () |  |  | instance | callable | matchGet | matchGet + matchSet |
| match_set | ($args) | void |  | instance | callable | matchSet | matchGet + matchSet |
| stream | (string $action, ?array $args = null [optional], ?array $callopts = null [optional]) | \Generator |  | instance | callable | stream | streamGenerator |

Members the runtime does not have: none.

Stream (src/cmp/php/fragment/Entity.fragment.php): the operation runs **as the caller iterates** (a provider declares `runs: 'iterate'`); the streaming feature's items are read **as the caller iterates**; without the feature the items are the whole result, read before the first one is handed over.
- `ref.facts.direct.okFalse`, cited ahead of a provider: `false` (src/cmp/php/fragment/Main.fragment.php: `return ["ok" => false, "err" => $err];`)

Field types (`canonToType`, column `php`): STRING `string`, INTEGER `int`, NUMBER `float`, BOOLEAN `bool`, NULL `null`, ARRAY `array`, OBJECT `array`, ANY `mixed`.

## py

Result style: **raise**; operations return. Record accessor: `data_get`, 0 parameter(s).

A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; `form` says whether it is called or is a field. A return read from a comment says so.

| operation | method | parameters | returns | fails | on | form | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list | list | reqmatch=None [optional], ctrl=None [optional] | list[EntyClass] |  | instance | callable | src/cmp/py/fragment/EntityListOp.fragment.py |
| load | load | reqmatch=None [optional], ctrl=None [optional] | EntyClass |  | instance | callable | src/cmp/py/fragment/EntityLoadOp.fragment.py |
| create | create | reqdata: EntityNameCreateData, ctrl=None [optional] | EntyClass |  | instance | callable | src/cmp/py/fragment/EntityCreateOp.fragment.py |
| update | update | reqdata: EntityNameUpdateData, ctrl=None [optional] | EntyClass |  | instance | callable | src/cmp/py/fragment/EntityUpdateOp.fragment.py |
| patch | patch | reqdata: EntityNamePatchData, ctrl=None [optional] | EntyClass |  | instance | callable | src/cmp/py/fragment/EntityPatchOp.fragment.py |
| remove | remove | reqmatch=None [optional], ctrl=None [optional] | EntyClass |  | instance | callable | src/cmp/py/fragment/EntityRemoveOp.fragment.py |

Entity accessor: `${entity.Name}(data=None)` -> `"${cls}"`; the entity constructor: `__init__(client, entopts=None)`.

| constructor | declaration | parameters | returns | fails | on | form |
| --- | --- | --- | --- | --- | --- | --- |
| client | __init__ | (options=None [optional]) |  |  | type | callable |
| test | test | (testopts=None [optional], sdkopts=None [optional]) | "ProjectNameSDK" |  | type | callable |

| client member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| direct | (fetchargs=None [optional]) |  |  | instance | callable | direct |  |
| get_root_ctx | () |  |  | instance | callable |  |  |
| get_utility | () |  |  | instance | callable | utility |  |
| graphql | (query, variables=None [optional], ctrl=None [optional]) |  |  | instance | callable |  |  |
| options | () or (value) |  |  | instance | callable |  |  |
| options_map | () |  |  | instance | callable | options |  |
| prepare | (fetchargs=None [optional]) |  |  | instance | callable | prepare |  |
| test | (testopts=None [optional], sdkopts=None [optional]) | "ProjectNameSDK" |  | type | callable |  |  |

| entity member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data_get | () | EntityName |  | instance | callable | dataGet | dataGet + dataSet |
| data_set | (args=None [optional]) |  |  | instance | callable | dataSet | dataGet + dataSet |
| deleted | () |  |  | instance | callable |  |  |
| get_name | () |  |  | instance | callable | name |  |
| make | () |  |  | instance | callable | make |  |
| mark_deleted | () |  |  | instance | callable |  |  |
| match_get | () | EntityName |  | instance | callable | matchGet | matchGet + matchSet |
| match_set | (args=None [optional]) |  |  | instance | callable | matchSet | matchGet + matchSet |
| stream | (action, args=None [optional], callopts=None [optional]) |  |  | instance | callable | stream | streamGenerator |

Members the runtime does not have: none.

Stream (src/cmp/py/fragment/Entity.fragment.py): the operation runs **as the caller iterates** (a provider declares `runs: 'iterate'`); the streaming feature's items are read **as the caller iterates**; without the feature the items are the whole result, read before the first one is handed over.

Field types (`canonToType`, column `py`): STRING `str`, INTEGER `int`, NUMBER `float`, BOOLEAN `bool`, NULL `None`, ARRAY `list`, OBJECT `dict`, ANY `Any`.

## rb

Result style: **raise**; operations return. Record accessor: `data_get`, 0 parameter(s).

A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; `form` says whether it is called or is a field. A return read from a comment says so.

| operation | method | parameters | returns | fails | on | form | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list | list | reqmatch = nil [optional], ctrl = nil [optional] | Array<EntyClass> (from a comment) |  | instance | callable | src/cmp/rb/fragment/EntityListOp.fragment.rb |
| load | load | reqmatch = nil [optional], ctrl = nil [optional] | EntyClass (from a comment) |  | instance | callable | src/cmp/rb/fragment/EntityLoadOp.fragment.rb |
| create | create | reqdata, ctrl = nil [optional] | EntyClass (from a comment) |  | instance | callable | src/cmp/rb/fragment/EntityCreateOp.fragment.rb |
| update | update | reqdata, ctrl = nil [optional] | EntyClass (from a comment) |  | instance | callable | src/cmp/rb/fragment/EntityUpdateOp.fragment.rb |
| patch | patch | reqdata, ctrl = nil [optional] | EntyClass (from a comment) |  | instance | callable | src/cmp/rb/fragment/EntityPatchOp.fragment.rb |
| remove | remove | reqmatch = nil [optional], ctrl = nil [optional] | EntyClass (from a comment) |  | instance | callable | src/cmp/rb/fragment/EntityRemoveOp.fragment.rb |

Entity accessor: `${entity.Name}(data = nil)`; the entity constructor: `initialize(client, entopts = nil)`.

| constructor | declaration | parameters | returns | fails | on | form |
| --- | --- | --- | --- | --- | --- | --- |
| client | initialize | (options = {} [optional]) |  |  | type | callable |
| test | test | (testopts = nil [optional], sdkopts = nil [optional]) |  |  | type | callable |

| client member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| direct | (fetchargs = {} [optional]) |  |  | instance | callable | direct |  |
| features | (not read) |  |  | |  |  |  |
| get_root_ctx | no parameter list |  |  | instance | callable |  |  |
| get_utility | no parameter list |  |  | instance | callable | utility |  |
| graphql | (query, variables = nil [optional], ctrl = nil [optional]) |  |  | instance | callable |  |  |
| inspect | no parameter list |  |  | instance | callable |  |  |
| mode | (not read) |  |  | |  |  |  |
| op_allowed? | (op) |  |  | instance | callable |  |  |
| op_denied | (op) |  |  | instance | callable |  |  |
| options | (not read) |  |  | |  |  |  |
| options_map | no parameter list |  |  | instance | callable | options |  |
| prepare | (fetchargs = {} [optional]) |  |  | instance | callable | prepare |  |
| raw_request | (fetchargs = {} [optional]) |  |  | instance | callable |  |  |
| test | (testopts = nil [optional], sdkopts = nil [optional]) |  |  | type | callable |  |  |
| to_s | no parameter list |  |  | instance | callable |  |  |

| entity member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data_get | no parameter list | EntityName, Hash (from a comment) |  | instance | callable | dataGet | dataGet + dataSet |
| data_set | (args) |  |  | instance | callable | dataSet | dataGet + dataSet |
| deleted | no parameter list |  |  | instance | callable |  |  |
| get_name | no parameter list |  |  | instance | callable | name |  |
| inspect | no parameter list |  |  | instance | callable |  |  |
| make | no parameter list |  |  | instance | callable | make |  |
| mark_deleted | no parameter list |  |  | instance | callable |  |  |
| match_get | no parameter list | Hash (from a comment) |  | instance | callable | matchGet | matchGet + matchSet |
| match_set | (args) |  |  | instance | callable | matchSet | matchGet + matchSet |
| stream | (action, args = nil [optional], callopts = nil [optional]) |  |  | instance | callable | stream | streamSync |
| to_h | no parameter list |  |  | instance | callable |  |  |
| to_s | no parameter list |  |  | instance | callable |  |  |

Members the runtime does not have: none.

Stream (src/cmp/rb/fragment/Entity.fragment.rb): the operation runs **as the caller iterates** (a provider declares `runs: 'iterate'`); the streaming feature's items are read **as the caller iterates**; without the feature the items are the whole result, read before the first one is handed over.

Field types (`canonToType`, column `rb`): STRING `String`, INTEGER `Integer`, NUMBER `Float`, BOOLEAN `Boolean`, NULL `NilClass`, ARRAY `Array`, OBJECT `Hash`, ANY `Object`.

## rust

Result style: **union**; operations return. Record accessor: `data`, 1 parameter(s).

A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; `form` says whether it is called or is a field. A return read from a comment says so.

| operation | method | parameters | returns | fails | on | form | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list | list | reqmatch: Value, ctrl: Value | Result<Vec<Rc<Self>>, ProjectNameError> | Result | instance | callable | src/cmp/rust/fragment/EntityListOp.fragment.rs |
| load | load | reqmatch: Value, ctrl: Value | Result<Rc<Self>, ProjectNameError> | Result | instance | callable | src/cmp/rust/fragment/EntityLoadOp.fragment.rs |
| create | create | reqdata: Value, ctrl: Value | Result<Rc<Self>, ProjectNameError> | Result | instance | callable | src/cmp/rust/fragment/EntityCreateOp.fragment.rs |
| update | update | reqdata: Value, ctrl: Value | Result<Rc<Self>, ProjectNameError> | Result | instance | callable | src/cmp/rust/fragment/EntityUpdateOp.fragment.rs |
| patch | patch | reqdata: Value, ctrl: Value | Result<Rc<Self>, ProjectNameError> | Result | instance | callable | src/cmp/rust/fragment/EntityPatchOp.fragment.rs |
| remove | remove | reqmatch: Value, ctrl: Value | Result<Rc<Self>, ProjectNameError> | Result | instance | callable | src/cmp/rust/fragment/EntityRemoveOp.fragment.rs |

Every operation's declaration shows its failure as `Result`; a call to one is written with `unwrap`.

Entity accessor: `${method}(entopts: Value)` -> `Rc<crate::entity::${mod}::${cls}>`; the entity constructor: `new(client: &Rc<ProjectNameSDK>, entopts: Value)`.

| constructor | declaration | parameters | returns | fails | on | form |
| --- | --- | --- | --- | --- | --- | --- |
| client | new | (options: Value) | Rc<ProjectNameSDK> |  | type | callable |
| test | test_sdk | (testopts: Value, sdkopts: Value) | Rc<ProjectNameSDK> |  | module | callable |

| client member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| direct | (fetchargs: Value) | Result<Value, ProjectNameError> | Result | instance | callable | direct |  |
| get_root_ctx | () | Rc<Context> |  | instance | callable |  |  |
| get_utility | () | Rc<Utility> |  | instance | callable | utility |  |
| graphql | (query: &str, variables: Value, ctrl: Value) | Result<Value, ProjectNameError> | Result | instance | callable |  |  |
| new | (options: Value) | Rc<ProjectNameSDK> |  | type | callable |  |  |
| options_map | () | Value |  | instance | callable | options |  |
| prepare | (fetchargs: Value) | Result<Value, ProjectNameError> | Result | instance | callable | prepare |  |
| test_sdk | (testopts: Value, sdkopts: Value) | Rc<ProjectNameSDK> |  | module | callable |  |  |

| entity member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data | (args: Option<&Value>) | Value or  |  | instance | callable | data | dataArg |
| deleted | () | bool or  |  | instance | callable |  |  |
| ent_ctx | () | Rc<Context> |  | instance | callable |  |  |
| get_name | () | String or  |  | instance | callable | name |  |
| make | () | Rc<dyn Entity> or  |  | instance | callable | make |  |
| mark_deleted | () |  |  | instance | callable |  |  |
| matchv | (args: Option<&Value>) | Value or  |  | instance | callable | match | matchArg |
| new | (client: &Rc<ProjectNameSDK>, entopts: Value) | Rc<EntyClass> |  | type | callable |  |  |
| stream | (action: &str, args: Value, callopts: Value) | Result<std::vec::IntoIter<Value>, ProjectNameError> | Result | instance | callable | stream | streamList |

Members the runtime does not have: none.

Stream (src/cmp/rust/fragment/Entity.fragment.rs): the operation runs **before it returns** (a provider declares `runs: 'call'`); the streaming feature's items are read **before it returns**; without the feature the items are the whole result, read before the first one is handed over.

Field types (`canonToType`, column `rust`): STRING `String`, INTEGER `i64`, NUMBER `f64`, BOOLEAN `bool`, NULL `Value`, ARRAY `Vec<Value>`, OBJECT `std::collections::HashMap<String, Value>`, ANY `Value`.

## scala

Result style: **throw**; operations return. Record accessor: `data`, 1 parameter(s).

A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; `form` says whether it is called or is a field. A return read from a comment says so.

| operation | method | parameters | returns | fails | on | form | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list | list | reqmatch: JMap[String, Object], ctrl: JMap[String, Object] | Object |  | instance | callable | src/cmp/scala/fragment/EntityListOp.fragment.scala |
| load | load | reqmatch: JMap[String, Object], ctrl: JMap[String, Object] | Object |  | instance | callable | src/cmp/scala/fragment/EntityLoadOp.fragment.scala |
| create | create | reqdata: JMap[String, Object], ctrl: JMap[String, Object] | Object |  | instance | callable | src/cmp/scala/fragment/EntityCreateOp.fragment.scala |
| update | update | reqdata: JMap[String, Object], ctrl: JMap[String, Object] | Object |  | instance | callable | src/cmp/scala/fragment/EntityUpdateOp.fragment.scala |
| patch | patch | reqdata: JMap[String, Object], ctrl: JMap[String, Object] | Object |  | instance | callable | src/cmp/scala/fragment/EntityPatchOp.fragment.scala |
| remove | remove | reqmatch: JMap[String, Object], ctrl: JMap[String, Object] | Object |  | instance | callable | src/cmp/scala/fragment/EntityRemoveOp.fragment.scala |

Entity accessor: `${accessor}(entopts: java.util.Map[String, Object])` -> `SdkEntity`; the entity constructor: `EntyClass(client0: SdkClient, entopts0: JMap[String, Object])`.

| constructor | declaration | parameters | returns | fails | on | form |
| --- | --- | --- | --- | --- | --- | --- |
| client | ProjectNameSDK | (options: JMap[String, Object]) |  |  | type | callable |
| test | testSDK | () or (testopts: JMap[String, Object], sdkopts: JMap[String, Object]) | ProjectNameSDK |  | type | callable |

| client member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| direct | (fetchargs0: JMap[String, Object]) | JMap[String, Object] |  | instance | callable | direct |  |
| features | property or field | JList[Feature] |  | instance | field |  |  |
| getRootCtx | () | Context |  | instance | callable |  |  |
| getUtility | () | Utility |  | instance | callable | utility |  |
| graphql | (query: String, variables: JMap[String, Object] = null [optional], ctrl: JMap[String, Object] = null [optional]) | JMap[String, Object] |  | instance | callable |  |  |
| mode | property or field | String |  | instance | field |  |  |
| optionsMap | () | JMap[String, Object] |  | instance | callable | options |  |
| prepare | (fetchargs0: JMap[String, Object]) | JMap[String, Object] |  | instance | callable | prepare |  |
| testOptions | (testopts: JMap[String, Object], sdkopts: JMap[String, Object]) | JMap[String, Object] |  | type | callable |  |  |
| testSDK | () or (testopts: JMap[String, Object], sdkopts: JMap[String, Object]) | ProjectNameSDK |  | type | callable |  |  |
| toString | no parameter list | String |  | instance | callable |  |  |

| entity member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data | (args: Object* [optional]) | Object |  | instance | callable | data | data |
| deleted | () | Boolean |  | instance | callable |  |  |
| getName | () | String |  | instance | callable | name |  |
| make | () | Entity |  | instance | callable | make |  |
| markDeleted | () | Unit |  | instance | callable |  |  |
| matchArgs | (args: Object* [optional]) | Object |  | instance | callable | match | match |
| stream | (action: String, args: JMap[String, Object], callopts: JMap[String, Object]) | Iterator[Object] |  | instance | callable | stream | streamSync |

Members the runtime does not have: none.

Stream (src/cmp/scala/fragment/EntityBase.fragment.scala): the operation runs **before it returns** (a provider declares `runs: 'call'`); the streaming feature's items are read **as the caller iterates**; without the feature the items are the whole result, read before the first one is handed over.
- `ref.facts.direct.okFalse`, cited ahead of a provider: `false` (tm/scala/core/SdkClient.scala: `out.put("ok", java.lang.Boolean.FALSE)`)

Field types (`canonToType`, column `scala`): STRING `String`, INTEGER `java.lang.Long`, NUMBER `java.lang.Double`, BOOLEAN `java.lang.Boolean`, NULL `Object`, ARRAY `java.util.List[Object]`, OBJECT `java.util.Map[String, Object]`, ANY `Object`.

## swift

Result style: **wrapped**; operations return. Record accessor: `data`, 1 parameter(s).

A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; `form` says whether it is called or is a field. A return read from a comment says so.

| operation | method | parameters | returns | fails | on | form | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list | list | _ reqmatch: VMap?, _ ctrl: VMap? | Value | throws | instance | callable | src/cmp/swift/fragment/EntityListOp.fragment.swift |
| load | load | _ reqmatch: VMap?, _ ctrl: VMap? | Value | throws | instance | callable | src/cmp/swift/fragment/EntityLoadOp.fragment.swift |
| create | create | _ reqdata: VMap?, _ ctrl: VMap? | Value | throws | instance | callable | src/cmp/swift/fragment/EntityCreateOp.fragment.swift |
| update | update | _ reqdata: VMap?, _ ctrl: VMap? | Value | throws | instance | callable | src/cmp/swift/fragment/EntityUpdateOp.fragment.swift |
| patch | patch | _ reqdata: VMap?, _ ctrl: VMap? | Value | throws | instance | callable | src/cmp/swift/fragment/EntityPatchOp.fragment.swift |
| remove | remove | _ reqmatch: VMap?, _ ctrl: VMap? | Value | throws | instance | callable | src/cmp/swift/fragment/EntityRemoveOp.fragment.swift |

Every operation's declaration shows its failure as `throws`; a call to one is written with `try`.

Entity accessor: `${entity.Name}(_ entopts: VMap? = nil)` -> `${Name}EntityBase`; the entity constructor: `init(_ client: ProjectNameSDK, _ entopts: VMap? = nil)`.

| constructor | declaration | parameters | returns | fails | on | form |
| --- | --- | --- | --- | --- | --- | --- |
| client | init | (_ optionsIn: ProjectNameSdk.VMap? = nil [optional]) |  |  | type | callable |
| test | testSDK | (_ testoptsIn: ProjectNameSdk.VMap?, _ sdkoptsIn: ProjectNameSdk.VMap?) | ProjectNameSDK |  | type | callable |

| client member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| customMirror | property or field | Swift.Mirror |  | instance | field |  |  |
| debugDescription | property or field | Swift.String |  | instance | field |  |  |
| description | property or field | Swift.String |  | instance | field |  |  |
| direct | (_ fetchargsIn: ProjectNameSdk.VMap?) | ProjectNameSdk.VMap |  | instance | callable | direct |  |
| features | property or field | [BaseFeature] |  | instance | field |  |  |
| getRootCtx | () | ProjectNameSdk.Context |  | instance | callable |  |  |
| getUtility | () | ProjectNameSdk.Utility |  | instance | callable | utility |  |
| graphql | (_ query: String, _ variables: ProjectNameSdk.VMap? = nil [optional], _ ctrl: ProjectNameSdk.VMap? = nil [optional]) | ProjectNameSdk.VMap |  | instance | callable |  |  |
| mode | property or field |  |  | instance | field |  |  |
| optionsMap | () | ProjectNameSdk.VMap |  | instance | callable | options |  |
| prepare | (_ fetchargsIn: ProjectNameSdk.VMap?) | ProjectNameSdk.VMap | throws | instance | callable | prepare |  |
| testSDK | (_ testoptsIn: ProjectNameSdk.VMap?, _ sdkoptsIn: ProjectNameSdk.VMap?) | ProjectNameSDK |  | type | callable |  |  |

| entity member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| create | (_ reqdata: VMap?, _ ctrl: VMap?) | Value | throws | instance | callable |  |  |
| customMirror | property or field | Swift.Mirror |  | instance | field |  |  |
| data | (_ newdata: Value?) | Value |  | instance | callable | data | dataArg |
| debugDescription | property or field | Swift.String |  | instance | field |  |  |
| deleted | () | Bool |  | instance | callable |  |  |
| description | property or field | Swift.String |  | instance | field |  |  |
| getName | () | String |  | instance | callable | name |  |
| list | (_ reqmatch: VMap?, _ ctrl: VMap?) | Value | throws | instance | callable |  |  |
| load | (_ reqmatch: VMap?, _ ctrl: VMap?) | Value | throws | instance | callable |  |  |
| make | () | Entity |  | instance | callable | make |  |
| markDeleted | () |  |  | instance | callable |  |  |
| matchv | (_ newmatch: Value?) | Value |  | instance | callable | match | matchArg |
| patch | (_ reqdata: VMap?, _ ctrl: VMap?) | Value | throws | instance | callable |  |  |
| remove | (_ reqmatch: VMap?, _ ctrl: VMap?) | Value | throws | instance | callable |  |  |
| stream | (_ action: String, _ args: VMap? = nil [optional], _ callopts: VMap? = nil [optional]) | AsyncStream<Value> | throws | instance | callable | stream | streamIterator |
| update | (_ reqdata: VMap?, _ ctrl: VMap?) | Value | throws | instance | callable |  |  |

Members the runtime does not have: none.

Stream (src/cmp/swift/fragment/EntityBase.fragment.swift): the operation runs **before it returns** (a provider declares `runs: 'call'`); the streaming feature's items are read **before it returns**; without the feature the items are the whole result, read before the first one is handed over.
- `ref.facts.direct.okFalse`, cited ahead of a provider: `false` (src/cmp/swift/fragment/Main.fragment.swift: `r.entries["ok"] = .bool(false)`)

Field types (`canonToType`, column `swift`): STRING `String`, INTEGER `Int`, NUMBER `Double`, BOOLEAN `Bool`, NULL `Value`, ARRAY `[Value]`, OBJECT `VMap`, ANY `Value`.

## ts

Result style: **throw**; operations resolve asynchronously. Record accessor: `data`, 1 parameter(s).

A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; `form` says whether it is called or is a field. A return read from a comment says so.

| operation | method | parameters | returns | fails | on | form | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list | list | reqmatch?: EntityNameListMatch [optional], ctrl?: Control [optional] | Promise<EntyClass[]> |  | instance | callable | src/cmp/ts/fragment/EntityListOp.fragment.ts |
| load | load | reqmatch?: EntityNameLoadMatch [optional], ctrl?: Control [optional] | Promise<EntyClass> |  | instance | callable | src/cmp/ts/fragment/EntityLoadOp.fragment.ts |
| create | create | reqdata?: EntityNameCreateData [optional], ctrl?: Control [optional] | Promise<EntyClass> |  | instance | callable | src/cmp/ts/fragment/EntityCreateOp.fragment.ts |
| update | update | reqdata?: EntityNameUpdateData [optional], ctrl?: Control [optional] | Promise<EntyClass> |  | instance | callable | src/cmp/ts/fragment/EntityUpdateOp.fragment.ts |
| patch | patch | reqdata?: EntityNamePatchData [optional], ctrl?: Control [optional] | Promise<EntyClass> |  | instance | callable | src/cmp/ts/fragment/EntityPatchOp.fragment.ts |
| remove | remove | reqmatch?: EntityNameRemoveMatch [optional], ctrl?: Control [optional] | Promise<EntyClass> |  | instance | callable | src/cmp/ts/fragment/EntityRemoveOp.fragment.ts |

Entity accessor: `${entity.Name}(entopts?: Record<string, any>)`; the entity constructor: `constructor(client: ProjectNameSDK, entopts: any)`.

| constructor | declaration | parameters | returns | fails | on | form |
| --- | --- | --- | --- | --- | --- | --- |
| client | constructor | (options?: any [optional]) |  |  | type | callable |
| test | test | (testoptsarg?: any [optional], sdkoptsarg?: any [optional]) |  |  | type | callable |

| client member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| direct | (fetchargs?: any [optional]) | Promise<DirectResult> |  | instance | callable | direct |  |
| graphql | (query: string, variables?: any [optional], ctrl?: any [optional]) |  |  | instance | callable |  |  |
| options | () |  |  | instance | callable | options |  |
| prepare | (fetchargs?: any [optional]) |  |  | instance | callable | prepare |  |
| test | (testoptsarg?: any [optional], sdkoptsarg?: any [optional]) |  |  | type | callable |  |  |
| tester | (testopts?: any [optional], sdkopts?: any [optional]) |  |  | instance | callable | tester |  |
| toJSON | () |  |  | instance | callable |  |  |
| toString | () |  |  | instance | callable |  |  |
| utility | () |  |  | instance | callable | utility |  |

| entity member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| client | () |  |  | instance | callable | client |  |
| data | (data?: Partial<D> [optional]) | D |  | instance | callable | data | data |
| deleted | () | boolean |  | instance | callable |  |  |
| entopts | () |  |  | instance | callable | entopts |  |
| make | () |  |  | instance | callable | make |  |
| markDeleted | () | void |  | instance | callable |  |  |
| match | (match?: Partial<D> [optional]) | Partial<D> |  | instance | callable | match | match |
| stream | (action: string, args?: any [optional], callopts?: any [optional]) | AsyncGenerator<any> |  | instance | callable | stream | streamIterator |
| toJSON | () |  |  | instance | callable |  |  |
| toString | () |  |  | instance | callable |  |  |

Members the runtime does not have: name.

Stream (src/cmp/ts/fragment/EntityBase.fragment.ts): the operation runs **as the caller iterates** (a provider declares `runs: 'iterate'`); the streaming feature's items are read **as the caller iterates**; without the feature the items are the whole result, read before the first one is handed over.

Field types (`canonToType`, column `ts`): STRING `string`, INTEGER `number`, NUMBER `number`, BOOLEAN `boolean`, NULL `null`, ARRAY `any[]`, OBJECT `Record<string, any>`, ANY `any`.

## zig

Result style: **union**; operations return. Record accessor: `data`, 1 parameter(s).

A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; `form` says whether it is called or is a field. A return read from a comment says so.

| operation | method | parameters | returns | fails | on | form | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list | list | reqmatch: Value, ctrl: Value | EntListResult | error union EntListResult | instance | callable | src/cmp/zig/fragment/EntityListOp.fragment.zig |
| load | load | reqmatch: Value, ctrl: Value | EntResult | error union EntResult | instance | callable | src/cmp/zig/fragment/EntityLoadOp.fragment.zig |
| create | create | reqdata: Value, ctrl: Value | EntResult | error union EntResult | instance | callable | src/cmp/zig/fragment/EntityCreateOp.fragment.zig |
| update | update | reqdata: Value, ctrl: Value | EntResult | error union EntResult | instance | callable | src/cmp/zig/fragment/EntityUpdateOp.fragment.zig |
| patch | patch | reqdata: Value, ctrl: Value | EntResult | error union EntResult | instance | callable | src/cmp/zig/fragment/EntityPatchOp.fragment.zig |
| remove | remove | reqmatch: Value, ctrl: Value | EntResult | error union EntResult | instance | callable | src/cmp/zig/fragment/EntityRemoveOp.fragment.zig |

Every operation's declaration shows its failure as `Result`; a call to one is written with `.err`.

Entity accessor: `${method}(entopts: Value)` -> `*@import("../entity/${mod}.zig").${cls}`; the entity constructor: `new(client: *sdk.ProjectNameSDK, entopts_in: Value)`.

| constructor | declaration | parameters | returns | fails | on | form |
| --- | --- | --- | --- | --- | --- | --- |
| client | new | (options: Value) | *ProjectNameSDK |  | type | callable |
| test | test_sdk | (testopts_in: Value, sdkopts_in: Value) | *ProjectNameSDK |  | module | callable |

| client member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| direct | (fetchargs_in: Value) | Value |  | instance | callable | direct |  |
| get_root_ctx | () | *Context |  | instance | callable |  |  |
| get_utility | () | *Utility |  | instance | callable | utility |  |
| graphql | (query: []const u8, variables: Value, ctrl: Value) | Value |  | type | callable |  |  |
| new | (options: Value) | *ProjectNameSDK |  | type | callable |  |  |
| new_with | (options: Value, extend: []const Feature) | *ProjectNameSDK |  | type | callable |  |  |
| options_map | () | Value |  | instance | callable | options |  |
| prepare | (fetchargs_in: Value) | E!Value |  | instance | callable | prepare |  |
| test_sdk | (testopts_in: Value, sdkopts_in: Value) | *ProjectNameSDK |  | module | callable |  |  |

| entity member | parameters | returns | fails | on | form | family | shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| asEntity | () | Entity |  | instance | callable |  |  |
| data | (args: ?Value) | Value |  | instance | callable | data | dataArg |
| get_name | () | []const u8 |  | instance | callable | name |  |
| is_deleted | () | bool |  | instance | callable |  |  |
| makeEnt | () | Entity |  | instance | callable |  |  |
| mark_deleted | () | void |  | instance | callable |  |  |
| matchv | (args: ?Value) | Value |  | instance | callable | match | matchArg |
| stream | (action: []const u8, args: Value, callopts: Value) | StreamResult | error union StreamResult | instance | callable | stream | streamList |

Members the runtime does not have: make.

Stream (src/cmp/zig/fragment/Entity.fragment.zig): the operation runs **before it returns** (a provider declares `runs: 'call'`); the streaming feature's items are read **before it returns**; without the feature the items are the whole result, read before the first one is handed over.

Field types: no code generator column (the code generator has no zig column in canonToType: every field is a Value, so the page's type words are the provider's own).
