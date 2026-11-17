# What each runtime defines, read through its forms

## c

Result style: **errslot**; operations return. Record accessor: `data`, 2 parameter(s).

| operation | method | parameters | returns | source |
| --- | --- | --- | --- | --- |
| list | list | Entity*, voxgig_value* reqmatch, voxgig_value* ctrl, PNError** err | Entity** | tm/c/core/sdk.h |
| load | load | Entity*, voxgig_value* reqmatch, voxgig_value* ctrl, PNError** err | Entity* | tm/c/core/sdk.h |
| create | create | Entity*, voxgig_value* reqdata, voxgig_value* ctrl, PNError** err | Entity* | tm/c/core/sdk.h |
| update | update | Entity*, voxgig_value* reqdata, voxgig_value* ctrl, PNError** err | Entity* | tm/c/core/sdk.h |
| patch | patch | Entity*, voxgig_value* reqdata, voxgig_value* ctrl, PNError** err | Entity* | tm/c/core/sdk.h |
| remove | remove | Entity*, voxgig_value* reqmatch, voxgig_value* ctrl, PNError** err | Entity* | tm/c/core/sdk.h |

Entity accessor: `${cAccessorName(model, entity.name)}(${Name}SDK* client, voxgig_value* entopts)`; the entity constructor: `entyvar_entity_new(ProjectNameSDK* client, voxgig_value* entopts)`.

| client member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| projectname_sdk_new | (voxgig_value* options) | ProjectNameSDK* |  |  |
| sdk_direct | (ProjectNameSDK* sdk, voxgig_value* fetchargs, PNError** err) | voxgig_value* | direct |  |
| sdk_graphql | (ProjectNameSDK* sdk, const char* query, voxgig_value* variables, voxgig_value* ctrl, PNError** err) | voxgig_value* |  |  |
| sdk_prepare | (ProjectNameSDK* sdk, voxgig_value* fetchargs, PNError** err) | voxgig_value* | prepare |  |
| test_sdk | (voxgig_value* testopts, voxgig_value* sdkopts) | ProjectNameSDK* |  |  |

| entity member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| create | (Entity*, voxgig_value* reqdata, voxgig_value* ctrl, PNError** err) | Entity* |  |  |
| data | (Entity*, voxgig_value* args) | voxgig_value* | data | dataArg |
| deleted | (Entity*) | bool |  |  |
| entyvar_entity_new | (ProjectNameSDK* client, voxgig_value* entopts) | Entity* |  |  |
| entyvar_stream | (Entity* e, const char* action, voxgig_value* args, voxgig_value* callopts, PNError** err) | voxgig_value* | stream | streamList |
| get_name | (Entity*) | const char* | name |  |
| list | (Entity*, voxgig_value* reqmatch, voxgig_value* ctrl, PNError** err) | Entity** |  |  |
| load | (Entity*, voxgig_value* reqmatch, voxgig_value* ctrl, PNError** err) | Entity* |  |  |
| make | (Entity*) | Entity* | make |  |
| mark_deleted | (Entity*) | void |  |  |
| matchv | (Entity*, voxgig_value* args) | voxgig_value* | match | matchArg |
| patch | (Entity*, voxgig_value* reqdata, voxgig_value* ctrl, PNError** err) | Entity* |  |  |
| remove | (Entity*, voxgig_value* reqmatch, voxgig_value* ctrl, PNError** err) | Entity* |  |  |
| update | (Entity*, voxgig_value* reqdata, voxgig_value* ctrl, PNError** err) | Entity* |  |  |

Field types (`canonToType`, column `c`): STRING `char*`, INTEGER `int64_t`, NUMBER `double`, BOOLEAN `bool`, NULL `voxgig_value*`, ARRAY `voxgig_value*`, OBJECT `voxgig_value*`, ANY `voxgig_value*`.

## clojure

Result style: **raise**; operations return. Record accessor: `data-get`, 0 parameter(s).

| operation | method | parameters | returns | source |
| --- | --- | --- | --- | --- |
| list | list | ent, reqmatch, ctrl |  | src/cmp/clojure/fragment/EntityListOp.fragment.clj |
| load | load | ent, reqmatch, ctrl |  | src/cmp/clojure/fragment/EntityLoadOp.fragment.clj |
| create | create | ent, reqdata, ctrl |  | src/cmp/clojure/fragment/EntityCreateOp.fragment.clj |
| update | update | ent, reqdata, ctrl |  | src/cmp/clojure/fragment/EntityUpdateOp.fragment.clj |
| patch | patch | ent, reqdata, ctrl |  | src/cmp/clojure/fragment/EntityPatchOp.fragment.clj |
| remove | remove | ent, reqmatch, ctrl |  | src/cmp/clojure/fragment/EntityRemoveOp.fragment.clj |

Entity accessor: `${cljAccessor(entity)}(client, data)`; the entity constructor: `new-entity(client, entopts)`.

| client member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| direct | (client, fetchargs) |  | direct |  |
| graphql | (not read) |  |  |  |
| make-sdk | (options) |  |  |  |
| options-map | (client) |  | options |  |
| prepare | (client, fetchargs) |  | prepare |  |
| test-sdk | (testopts, sdkopts) |  |  |  |

| entity member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| data-get | () |  | dataGet | dataGet + dataSet |
| data-set | (args) |  | dataSet | dataGet + dataSet |
| deleted | (ent) |  |  |  |
| get-name | () |  | name |  |
| make | () or (client, data) |  | make |  |
| mark-deleted | (ent) |  |  |  |
| match-get | () |  | matchGet | matchGet + matchSet |
| match-set | (args) |  | matchSet | matchGet + matchSet |
| stream | (ent, action, args, callopts) |  | stream | streamLazy |

Field types: no code generator column (the code generator has no clojure column in canonToType; the page's type words are the provider's own).

## cpp

Result style: **throw**; operations return. Record accessor: `data`, 1 parameter(s).

| operation | method | parameters | returns | source |
| --- | --- | --- | --- | --- |
| list | list | const Value& reqmatch, const Value& ctrl | std::vector<SdkEntityPtr> | src/cmp/cpp/fragment/EntityListOp.fragment.cpp |
| load | load | const Value& reqmatch, const Value& ctrl | SdkEntityPtr | src/cmp/cpp/fragment/EntityLoadOp.fragment.cpp |
| create | create | const Value& reqdata, const Value& ctrl | SdkEntityPtr | src/cmp/cpp/fragment/EntityCreateOp.fragment.cpp |
| update | update | const Value& reqdata, const Value& ctrl | SdkEntityPtr | src/cmp/cpp/fragment/EntityUpdateOp.fragment.cpp |
| patch | patch | const Value& reqdata, const Value& ctrl | SdkEntityPtr | src/cmp/cpp/fragment/EntityPatchOp.fragment.cpp |
| remove | remove | const Value& reqmatch, const Value& ctrl | SdkEntityPtr | src/cmp/cpp/fragment/EntityRemoveOp.fragment.cpp |

Entity accessor: `${accessor}(Value entopts = Value::undef())` -> `std::shared_ptr<${cls}>`; the entity constructor: `EntyClass(SdkClient* client, Value entopts = Value::undef())`.

| client member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| create | () | std::shared_ptr<ProjectNameSDK> |  |  |
| direct | (const Value& fetchargs) | Value | direct |  |
| features | property or field | std::vector<FeaturePtr> |  |  |
| getRootCtx | () | CtxPtr |  |  |
| getUtility | () | UtilityPtr | utility |  |
| graphql | (const std::string& query, const Value& variables = Value::undef(), const Value& ctrl = Value::undef()) | Value |  |  |
| mode | property or field | std::string |  |  |
| opAllowed | (const std::string& op) | bool |  |  |
| opDenied | (const std::string& op) | Value |  |  |
| options | property or field | Value |  |  |
| optionsMap | () | Value | options |  |
| prepare | (const Value& fetchargs) | Value | prepare |  |
| rawRequest | (const Value& fetchargs) | Value |  |  |
| rootctx | property or field | CtxPtr |  |  |
| testOptions | (const Value& testopts, const Value& sdkopts) | Value |  |  |
| testSDK | () or (Value testopts, Value sdkopts) | std::shared_ptr<ProjectNameSDK> |  |  |
| to_string | () | std::string |  |  |
| utility | property or field | UtilityPtr |  |  |

| entity member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| client | property or field | SdkClient* |  |  |
| data | (const Value& arg = Value::undef()) | Value | data | data |
| data_ | property or field | Value |  |  |
| deleted | () | bool |  |  |
| deleted_ | property or field | bool |  |  |
| entctx | property or field | CtxPtr |  |  |
| entopts | property or field | Value |  |  |
| getName | () | std::string | name |  |
| make | () | EntityPtr | make |  |
| markDeleted | () | void |  |  |
| match | (const Value& arg = Value::undef()) | Value | match | match |
| match_ | property or field | Value |  |  |
| name_ | property or field | std::string |  |  |
| runOp | (CtxPtr ctx, const std::function<void()>& postDone) | Value |  |  |
| self | () | SdkEntityPtr |  |  |
| stream | (const std::string& action, const Value& args = Value::undef(), const Value& callopts = Value::undef()) | std::vector<Value> | stream | streamList |
| utility | property or field | UtilityPtr |  |  |

Field types (`canonToType`, column `cpp`): STRING `std::string`, INTEGER `int64_t`, NUMBER `double`, BOOLEAN `bool`, NULL `Value`, ARRAY `std::vector<Value>`, OBJECT `std::map<std::string, Value>`, ANY `Value`.

## csharp

Result style: **throw**; operations return. Record accessor: `Data`, 1 parameter(s).

| operation | method | parameters | returns | source |
| --- | --- | --- | --- | --- |
| list | List | Dictionary<string, object?>? reqmatch, Dictionary<string, object?>? ctrl = null | object? | src/cmp/csharp/fragment/EntityListOp.fragment.cs |
| load | Load | Dictionary<string, object?>? reqmatch, Dictionary<string, object?>? ctrl = null | object? | src/cmp/csharp/fragment/EntityLoadOp.fragment.cs |
| create | Create | Dictionary<string, object?>? reqdata, Dictionary<string, object?>? ctrl = null | object? | src/cmp/csharp/fragment/EntityCreateOp.fragment.cs |
| update | Update | Dictionary<string, object?>? reqdata, Dictionary<string, object?>? ctrl = null | object? | src/cmp/csharp/fragment/EntityUpdateOp.fragment.cs |
| patch | Patch | Dictionary<string, object?>? reqdata, Dictionary<string, object?>? ctrl = null | object? | src/cmp/csharp/fragment/EntityPatchOp.fragment.cs |
| remove | Remove | Dictionary<string, object?>? reqmatch, Dictionary<string, object?>? ctrl = null | object? | src/cmp/csharp/fragment/EntityRemoveOp.fragment.cs |

Entity accessor: `${entity.Name}(Dictionary<string, object?>? entopts = null)` -> `${model.const.Name}EntityBase`; the entity constructor: `EntyClass(ProjectNameSDK client, Dictionary<string, object?>? entopts = null)`.

| client member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| Direct | (Dictionary<string, object?>? fetchargs) | Dictionary<string, object?> | direct |  |
| GetRootCtx | () | Context |  |  |
| GetUtility | () | Utility | utility |  |
| Graphql | (string query, Dictionary<string, object?>? variables = null, Dictionary<string, object?>? ctrl = null) | Dictionary<string, object?> |  |  |
| OptionsMap | () | Dictionary<string, object?> | options |  |
| Prepare | (Dictionary<string, object?>? fetchargs) | Dictionary<string, object?> | prepare |  |
| TestSDK | (Dictionary<string, object?>? testopts, Dictionary<string, object?>? sdkopts) | ProjectNameSDK |  |  |

| entity member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| Create | (Dictionary<string, object?>? reqdata, Dictionary<string, object?>? ctrl = null) | object? |  |  |
| Data | (object? newdata = null) | object? | data | data |
| Deleted | () | bool |  |  |
| GetName | () | string | name |  |
| List | (Dictionary<string, object?>? reqmatch, Dictionary<string, object?>? ctrl = null) | object? |  |  |
| Load | (Dictionary<string, object?>? reqmatch, Dictionary<string, object?>? ctrl = null) | object? |  |  |
| Make | () | IEntity | make |  |
| MarkDeleted | () | void |  |  |
| Match | (object? newmatch = null) | object? | match | match |
| Patch | (Dictionary<string, object?>? reqdata, Dictionary<string, object?>? ctrl = null) | object? |  |  |
| Remove | (Dictionary<string, object?>? reqmatch, Dictionary<string, object?>? ctrl = null) | object? |  |  |
| Stream | (string action, Dictionary<string, object?>? args = null, Dictionary<string, object?>? callopts = null, [EnumeratorCancellation] CancellationToken cancel = default) | IAsyncEnumerable<object?> | stream | streamIterator |
| Update | (Dictionary<string, object?>? reqdata, Dictionary<string, object?>? ctrl = null) | object? |  |  |

Field types (`canonToType`, column `csharp`): STRING `string`, INTEGER `long`, NUMBER `double`, BOOLEAN `bool`, NULL `object?`, ARRAY `List<object?>`, OBJECT `Dictionary<string, object?>`, ANY `object?`.

## elixir

Result style: **raise**; operations return. Record accessor: `data_get`, 1 parameter(s).

| operation | method | parameters | returns | source |
| --- | --- | --- | --- | --- |
| list | list | ent, reqmatch \\ nil, ctrl \\ nil | term() | src/cmp/elixir/fragment/EntityListOp.fragment.ex |
| load | load | ent, reqmatch \\ nil, ctrl \\ nil | term() | src/cmp/elixir/fragment/EntityLoadOp.fragment.ex |
| create | create | ent, reqdata, ctrl \\ nil | term() | src/cmp/elixir/fragment/EntityCreateOp.fragment.ex |
| update | update | ent, reqdata, ctrl \\ nil | term() | src/cmp/elixir/fragment/EntityUpdateOp.fragment.ex |
| patch | patch | ent, reqdata, ctrl \\ nil | term() | src/cmp/elixir/fragment/EntityPatchOp.fragment.ex |
| remove | remove | ent, reqmatch \\ nil, ctrl \\ nil | term() | src/cmp/elixir/fragment/EntityRemoveOp.fragment.ex |

Entity accessor: `${accessor}(client, entopts \\\\ nil)`; the entity constructor: `new(client, entopts \\ nil)`.

| client member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| direct | (client, fetchargs \\ nil) |  | direct |  |
| get_root_ctx | (client) |  |  |  |
| get_utility | (client) |  | utility |  |
| graphql | (client, query, variables \\ nil, ctrl \\ nil) |  |  |  |
| mode | (client) |  |  |  |
| new | (options \\ nil) |  |  |  |
| options_map | (client) |  | options |  |
| prepare | (client, fetchargs \\ nil) |  | prepare |  |
| test | (testopts \\ nil, sdkopts \\ nil) |  |  |  |

| entity member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| construct | (module, client, name, entopts \\ nil) |  |  |  |
| data_get | (ent) |  | dataGet | dataGet + dataSet |
| data_set | (ent, args) or (ent, args \\ nil) |  | dataSet | dataGet + dataSet |
| deleted | (ent) |  |  |  |
| get_name | (ent) |  | name |  |
| make | (ent) |  | make |  |
| mark_deleted | (ent) |  |  |  |
| match_get | (ent) |  | matchGet | matchGet + matchSet |
| match_set | (ent, args) or (ent, args \\ nil) |  | matchSet | matchGet + matchSet |
| new | (client, entopts \\ nil) |  |  |  |
| op_return | (ent, ctx, out) |  |  |  |
| stream | (ent, action, args \\ nil, callopts \\ nil) |  | stream | streamLazy |

Field types (`canonToType`, column `elixir`): STRING `String.t()`, INTEGER `integer()`, NUMBER `float()`, BOOLEAN `boolean()`, NULL `nil`, ARRAY `list()`, OBJECT `map()`, ANY `any()`.

## go

Result style: **pair**; operations return. Record accessor: `Data`, 1 parameter(s).

| operation | method | parameters | returns | source |
| --- | --- | --- | --- | --- |
| list | List | reqmatch map[string]any, ctrl map[string]any | (any, error) | src/cmp/go/fragment/EntityListOp.fragment.go |
| load | Load | reqmatch map[string]any, ctrl map[string]any | (any, error) | src/cmp/go/fragment/EntityLoadOp.fragment.go |
| create | Create | reqdata map[string]any, ctrl map[string]any | (any, error) | src/cmp/go/fragment/EntityCreateOp.fragment.go |
| update | Update | reqdata map[string]any, ctrl map[string]any | (any, error) | src/cmp/go/fragment/EntityUpdateOp.fragment.go |
| patch | Patch | reqdata map[string]any, ctrl map[string]any | (any, error) | src/cmp/go/fragment/EntityPatchOp.fragment.go |
| remove | Remove | reqmatch map[string]any, ctrl map[string]any | (any, error) | src/cmp/go/fragment/EntityRemoveOp.fragment.go |

Entity accessor: `${entity.Name}(data map[string]any)` -> `ProjectNameEntityBase`; the entity constructor: `NewEntyClass(client *core.ProjectNameSDK, entopts map[string]any)`.

| client member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| Direct | (fetchargs map[string]any) | (map[string]any, error) | direct |  |
| GetRootCtx | () | *Context |  |  |
| GetUtility | () | *Utility | utility |  |
| Graphql | (query string, variables map[string]any, ctrl map[string]any) | (map[string]any, error) |  |  |
| New | () | *ProjectNameSDK |  |  |
| NewProjectNameSDK | (options map[string]any) | *ProjectNameSDK |  |  |
| OptionsMap | () | map[string]any | options |  |
| Prepare | (fetchargs map[string]any) | (map[string]any, error) | prepare |  |
| Test | () | *ProjectNameSDK |  |  |
| TestSDK | (testopts map[string]any, sdkopts map[string]any) | *ProjectNameSDK |  |  |

| entity member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| Data | (args ...any) | any | data | data |
| DataTyped | (data ...EntityName) | EntityName |  |  |
| Deleted | () | bool |  |  |
| GetName | () | string | name |  |
| GoString | () | string |  |  |
| Make | () | Entity | make |  |
| MarkDeleted | () |  |  |  |
| MarshalJSON | () | ([]byte, error) |  |  |
| Match | (args ...any) | any | match | match |
| MatchTyped | (match ...EntityName) | EntityName |  |  |
| Stream | (action string, args map[string]any, callopts map[string]any) | <-chan StreamItem | stream | stream |
| String | () | string |  |  |

Field types (`canonToType`, column `go`): STRING `string`, INTEGER `int`, NUMBER `float64`, BOOLEAN `bool`, NULL `any`, ARRAY `[]any`, OBJECT `map[string]any`, ANY `any`.

## java

Result style: **throw**; operations return. Record accessor: `data`, 1 parameter(s).

| operation | method | parameters | returns | source |
| --- | --- | --- | --- | --- |
| list | list | Map<String, Object> reqmatch, Map<String, Object> ctrl | Object | src/cmp/java/fragment/EntityListOp.fragment.java |
| load | load | Map<String, Object> reqmatch, Map<String, Object> ctrl | Object | src/cmp/java/fragment/EntityLoadOp.fragment.java |
| create | create | Map<String, Object> reqdata, Map<String, Object> ctrl | Object | src/cmp/java/fragment/EntityCreateOp.fragment.java |
| update | update | Map<String, Object> reqdata, Map<String, Object> ctrl | Object | src/cmp/java/fragment/EntityUpdateOp.fragment.java |
| patch | patch | Map<String, Object> reqdata, Map<String, Object> ctrl | Object | src/cmp/java/fragment/EntityPatchOp.fragment.java |
| remove | remove | Map<String, Object> reqmatch, Map<String, Object> ctrl | Object | src/cmp/java/fragment/EntityRemoveOp.fragment.java |

Entity accessor: `${accessor}(Map<String, Object> entopts)` -> `SdkEntity`; the entity constructor: `EntyClass(SdkClient client, Map<String, Object> entopts)`.

| client member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| direct | (Map<String, Object> fetchargs) | Map<String, Object> | direct |  |
| getRootCtx | () | Context |  |  |
| getUtility | () | Utility | utility |  |
| graphql | (String query, Map<String, Object> variables, Map<String, Object> ctrl) | Map<String, Object> |  |  |
| optionsMap | () | Map<String, Object> | options |  |
| prepare | (Map<String, Object> fetchargs) | Map<String, Object> | prepare |  |
| testSDK | () or (Map<String, Object> testopts, Map<String, Object> sdkopts) | ProjectNameSDK |  |  |

| entity member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| data | (Object... args) | Object | data | data |
| deleted | () | boolean |  |  |
| getName | () | String | name |  |
| make | () | Entity | make |  |
| markDeleted | () | void |  |  |
| match | (Object... args) | Object | match | match |
| stream | (String action, Map<String, Object> args, Map<String, Object> callopts) | Stream<Object> | stream | streamLazy |

Field types (`canonToType`, column `java`): STRING `String`, INTEGER `Long`, NUMBER `Double`, BOOLEAN `Boolean`, NULL `Object`, ARRAY `List<Object>`, OBJECT `Map<String, Object>`, ANY `Object`.

## js

Result style: **throw**; operations resolve asynchronously. Record accessor: `data`, 1 parameter(s).

| operation | method | parameters | returns | source |
| --- | --- | --- | --- | --- |
| list | list | reqmatch, ctrl |  | src/cmp/js/fragment/EntityListOp.fragment.js |
| load | load | reqmatch, ctrl |  | src/cmp/js/fragment/EntityLoadOp.fragment.js |
| create | create | reqdata, ctrl |  | src/cmp/js/fragment/EntityCreateOp.fragment.js |
| update | update | reqdata, ctrl |  | src/cmp/js/fragment/EntityUpdateOp.fragment.js |
| patch | patch | reqdata, ctrl |  | src/cmp/js/fragment/EntityPatchOp.fragment.js |
| remove | remove | reqmatch, ctrl |  | src/cmp/js/fragment/EntityRemoveOp.fragment.js |

Entity accessor: `${entity.Name}(entopts)`; the entity constructor: `constructor(client, entopts)`.

| client member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| direct | (fetchargs) |  | direct |  |
| graphql | (query, variables, ctrl) |  |  |  |
| options | () |  | options |  |
| prepare | (fetchargs) |  | prepare |  |
| test | (testoptsarg, sdkoptsarg) |  |  |  |
| tester | (testopts, sdkopts) |  | tester |  |
| toJSON | () |  |  |  |
| toString | () |  |  |  |
| utility | () |  | utility |  |

| entity member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| client | () |  | client |  |
| data | (data) |  | data | data |
| deleted | () |  |  |  |
| entopts | () |  | entopts |  |
| make | () |  | make |  |
| markDeleted | () |  |  |  |
| match | (match) |  | match | match |
| stream | (action, args, callopts) |  | stream | streamIterator |
| toJSON | () |  |  |  |
| toString | () |  |  |  |

Field types (`canonToType`, column `js`): STRING `string`, INTEGER `number`, NUMBER `number`, BOOLEAN `boolean`, NULL `null`, ARRAY `Array`, OBJECT `Object`, ANY `*`.

## kotlin

Result style: **throw**; operations return. Record accessor: `data`, 1 parameter(s).

| operation | method | parameters | returns | source |
| --- | --- | --- | --- | --- |
| list | list | reqmatch: MutableMap<String, Any?>?, ctrl: MutableMap<String, Any?>? | Any? | src/cmp/kotlin/fragment/EntityListOp.fragment.kt |
| load | load | reqmatch: MutableMap<String, Any?>?, ctrl: MutableMap<String, Any?>? | Any? | src/cmp/kotlin/fragment/EntityLoadOp.fragment.kt |
| create | create | reqdata: MutableMap<String, Any?>?, ctrl: MutableMap<String, Any?>? | Any? | src/cmp/kotlin/fragment/EntityCreateOp.fragment.kt |
| update | update | reqdata: MutableMap<String, Any?>?, ctrl: MutableMap<String, Any?>? | Any? | src/cmp/kotlin/fragment/EntityUpdateOp.fragment.kt |
| patch | patch | reqdata: MutableMap<String, Any?>?, ctrl: MutableMap<String, Any?>? | Any? | src/cmp/kotlin/fragment/EntityPatchOp.fragment.kt |
| remove | remove | reqmatch: MutableMap<String, Any?>?, ctrl: MutableMap<String, Any?>? | Any? | src/cmp/kotlin/fragment/EntityRemoveOp.fragment.kt |

Entity accessor: `${accessor}(entopts: MutableMap<String, Any?>?)` -> `SdkEntity`; the entity constructor: `EntyClass(clientIn: SdkClient, entoptsIn: MutableMap<String, Any?>?)`.

| client member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| direct | (fetchargsIn: MutableMap<String, Any?>?) | MutableMap<String, Any?> | direct |  |
| features | property or field | MutableList<Feature> |  |  |
| getRootCtx | () | Context |  |  |
| getUtility | () | Utility | utility |  |
| graphql | (query: String, variables: MutableMap<String, Any?>? = null, ctrl: MutableMap<String, Any?>? = null) | MutableMap<String, Any?> |  |  |
| mode | property or field | String |  |  |
| optionsMap | () | MutableMap<String, Any?> | options |  |
| prepare | (fetchargsIn: MutableMap<String, Any?>?) | MutableMap<String, Any?> | prepare |  |
| testOptions | (testopts: MutableMap<String, Any?>?, sdkopts: MutableMap<String, Any?>?) | MutableMap<String, Any?> |  |  |
| testSDK | () or (testopts: MutableMap<String, Any?>?, sdkopts: MutableMap<String, Any?>?) | ProjectNameSDK |  |  |
| toString | () | String |  |  |

| entity member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| data | (vararg args: Any?) | Any? | data | data |
| deleted | () | Boolean |  |  |
| make | () | Entity | make |  |
| markDeleted | () |  |  |  |
| match | (vararg args: Any?) | Any? | match | match |
| name | property or field | String | name |  |
| stream | (action: String, args: MutableMap<String, Any?>?, callopts: MutableMap<String, Any?>?) | Sequence<Any?> | stream | streamLazy |

Field types (`canonToType`, column `kotlin`): STRING `String?`, INTEGER `Long?`, NUMBER `Double?`, BOOLEAN `Boolean?`, NULL `Any?`, ARRAY `List<Any?>?`, OBJECT `Map<String, Any?>?`, ANY `Any?`.

## lua

Result style: **pair**; operations return. Record accessor: `data_get`, 0 parameter(s).

| operation | method | parameters | returns | source |
| --- | --- | --- | --- | --- |
| list | list | reqmatch, ctrl | EntyClass[], string? | src/cmp/lua/fragment/EntityListOp.fragment.lua |
| load | load | reqmatch, ctrl | EntyClass, string? | src/cmp/lua/fragment/EntityLoadOp.fragment.lua |
| create | create | reqdata, ctrl | EntyClass, string? | src/cmp/lua/fragment/EntityCreateOp.fragment.lua |
| update | update | reqdata, ctrl | EntyClass, string? | src/cmp/lua/fragment/EntityUpdateOp.fragment.lua |
| patch | patch | reqdata, ctrl | EntyClass, string? | src/cmp/lua/fragment/EntityPatchOp.fragment.lua |
| remove | remove | reqmatch, ctrl | EntyClass, string? | src/cmp/lua/fragment/EntityRemoveOp.fragment.lua |

Entity accessor: `${entity.Name}(data)`; the entity constructor: `new(client, entopts)`.

| client member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| direct | (fetchargs) |  | direct |  |
| get_root_ctx | () |  |  |  |
| get_utility | () |  | utility |  |
| graphql | (query, variables, ctrl) |  |  |  |
| options_map | () |  | options |  |
| prepare | (fetchargs) |  | prepare |  |
| test | (testopts, sdkopts) |  |  |  |
| to_record | () |  |  |  |

| entity member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| data_get | () |  | dataGet | dataGet + dataSet |
| data_set | (args) |  | dataSet | dataGet + dataSet |
| deleted | () |  |  |  |
| get_name | () |  | name |  |
| make | () |  | make |  |
| mark_deleted | () |  |  |  |
| match_get | () |  | matchGet | matchGet + matchSet |
| match_set | (args) |  | matchSet | matchGet + matchSet |
| stream | (action, args, callopts) |  | stream | streamFunction |
| to_record | () |  |  |  |

Field types (`canonToType`, column `lua`): STRING `string`, INTEGER `number`, NUMBER `number`, BOOLEAN `boolean`, NULL `nil`, ARRAY `table`, OBJECT `table`, ANY `any`.

## ocaml

Result style: **raise**; operations return. Record accessor: `e_data_get`, 0 parameter(s).

| operation | method | parameters | returns | source |
| --- | --- | --- | --- | --- |
| list | e_list | value, value | entity_obj list | tm/ocaml/sdk_types.ml |
| load | e_load | value, value | entity_obj | tm/ocaml/sdk_types.ml |
| create | e_create | value, value | entity_obj | tm/ocaml/sdk_types.ml |
| update | e_update | value, value | entity_obj | tm/ocaml/sdk_types.ml |
| patch | e_patch | value, value | entity_obj | tm/ocaml/sdk_types.ml |
| remove | e_remove | value, value | entity_obj | tm/ocaml/sdk_types.ml |

Entity accessor: `${fn}(client : sdk_client, entopts : value)` -> `entity_obj`; the entity constructor: `make(client : sdk_client, entopts_in : value)`.

| client member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| ${fn} | (client : sdk_client, entopts : value) | entity_obj |  |  |
| direct | (client : sdk_client, fetchargs : value) | value | direct |  |
| entity | (_client : sdk_client, _name : string, _entopts : value) or (client : sdk_client, name : string, entopts : value) | entity_obj option |  |  |
| graphql | (client : sdk_client, query : string, variables : value, ctrl : value) | value |  |  |
| make | (options : value) | sdk_client |  |  |
| make0 | () | sdk_client |  |  |
| prepare | (client : sdk_client, fetchargs : value) | value | prepare |  |
| test | () | sdk_client |  |  |
| test_with | (testopts : value, sdkopts : value) | sdk_client |  |  |

| entity member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| e_client | () | sdk_client |  |  |
| e_create | (value, value) | entity_obj |  |  |
| e_data | () | value |  |  |
| e_data_get | () | value | dataGet | dataGet + dataSet |
| e_data_set | (value) | unit | dataSet | dataGet + dataSet |
| e_deleted | () | bool |  |  |
| e_entctx | () | ctx |  |  |
| e_entopts | () | value |  |  |
| e_list | (value, value) | entity_obj list |  |  |
| e_load | (value, value) | entity_obj |  |  |
| e_make | () | entity_obj | make |  |
| e_mark_deleted | () | unit |  |  |
| e_match | () | value |  |  |
| e_match_get | () | value | matchGet | matchGet + matchSet |
| e_match_set | (value) | unit | matchSet | matchGet + matchSet |
| e_name | () | string | name |  |
| e_patch | (value, value) | entity_obj |  |  |
| e_remove | (value, value) | entity_obj |  |  |
| e_stream | (string, value, value) | value Seq.t | stream | streamLazy |
| e_update | (value, value) | entity_obj |  |  |
| e_utility | () | utility |  |  |

Field types: no code generator column (the code generator has no ocaml column in canonToType (every type maps to any); the page's type words are the provider's own).

## perl

Result style: **die**; operations return. Record accessor: `data_get`, 0 parameter(s).

| operation | method | parameters | returns | source |
| --- | --- | --- | --- | --- |
| list | list | $reqmatch, $ctrl |  | src/cmp/perl/fragment/EntityListOp.fragment.pm |
| load | load | $reqmatch, $ctrl |  | src/cmp/perl/fragment/EntityLoadOp.fragment.pm |
| create | create | $reqdata, $ctrl |  | src/cmp/perl/fragment/EntityCreateOp.fragment.pm |
| update | update | $reqdata, $ctrl |  | src/cmp/perl/fragment/EntityUpdateOp.fragment.pm |
| patch | patch | $reqdata, $ctrl |  | src/cmp/perl/fragment/EntityPatchOp.fragment.pm |
| remove | remove | $reqmatch, $ctrl |  | src/cmp/perl/fragment/EntityRemoveOp.fragment.pm |

Entity accessor: `${entity.Name}($data)`; the entity constructor: `new($client, $entopts)`.

| client member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| TO_JSON | () |  |  |  |
| direct | ($fetchargs) |  | direct |  |
| get_root_ctx | () |  |  |  |
| get_utility | () |  | utility |  |
| graphql | ($query, $variables, $ctrl) |  |  |  |
| options_map | () |  | options |  |
| prepare | ($fetchargs) |  | prepare |  |
| test | ($testopts, $sdkopts) |  |  |  |
| to_string | () |  |  |  |

| entity member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| TO_JSON | () |  |  |  |
| data_get | () |  | dataGet | dataGet + dataSet |
| data_set | ($args) |  | dataSet | dataGet + dataSet |
| deleted | () |  |  |  |
| get_name | () |  | name |  |
| make | () |  | make |  |
| mark_deleted | () |  |  |  |
| match_get | () |  | matchGet | matchGet + matchSet |
| match_set | ($args) |  | matchSet | matchGet + matchSet |
| stream | ($action, $args, $callopts) |  | stream | streamFunction |
| to_string | () |  |  |  |

Field types: no code generator column (the code generator has no perl column in canonToType (every type maps to any); the page's type words are the provider's own).

## php

Result style: **throw**; operations return. Record accessor: `data_get`, 0 parameter(s).

| operation | method | parameters | returns | source |
| --- | --- | --- | --- | --- |
| list | list | ?array $reqmatch = null, $ctrl = null | mixed | src/cmp/php/fragment/EntityListOp.fragment.php |
| load | load | ?array $reqmatch = null, $ctrl = null | mixed | src/cmp/php/fragment/EntityLoadOp.fragment.php |
| create | create | ?array $reqdata = null, $ctrl = null | mixed | src/cmp/php/fragment/EntityCreateOp.fragment.php |
| update | update | ?array $reqdata = null, $ctrl = null | mixed | src/cmp/php/fragment/EntityUpdateOp.fragment.php |
| patch | patch | ?array $reqdata = null, $ctrl = null | mixed | src/cmp/php/fragment/EntityPatchOp.fragment.php |
| remove | remove | ?array $reqmatch = null, $ctrl = null | mixed | src/cmp/php/fragment/EntityRemoveOp.fragment.php |

Entity accessor: `${accessor}($data = null)`; the entity constructor: `__construct($client, ?array $entopts = null)`.

| client member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| direct | (array $fetchargs = []) | mixed | direct |  |
| get_root_ctx | () |  |  |  |
| get_utility | () |  | utility |  |
| graphql | (string $query, ?array $variables = null, ?array $ctrl = null) | mixed |  |  |
| jsonSerialize | () | array |  |  |
| options_map | () | array | options |  |
| prepare | (array $fetchargs = []) | mixed | prepare |  |
| test | (?array $testopts = null, ?array $sdkopts = null) | self |  |  |

| entity member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| data_get | () |  | dataGet | dataGet + dataSet |
| data_set | ($args) | void | dataSet | dataGet + dataSet |
| deleted | () | bool |  |  |
| get_name | () | string | name |  |
| make | () | self | make |  |
| markDeleted | () | void |  |  |
| match_get | () |  | matchGet | matchGet + matchSet |
| match_set | ($args) | void | matchSet | matchGet + matchSet |
| stream | (string $action, ?array $args = null, ?array $callopts = null) | \Generator | stream | streamGenerator |

Field types (`canonToType`, column `php`): STRING `string`, INTEGER `int`, NUMBER `float`, BOOLEAN `bool`, NULL `null`, ARRAY `array`, OBJECT `array`, ANY `mixed`.

## py

Result style: **raise**; operations return. Record accessor: `data_get`, 0 parameter(s).

| operation | method | parameters | returns | source |
| --- | --- | --- | --- | --- |
| list | list | reqmatch=None, ctrl=None | list[EntyClass] | src/cmp/py/fragment/EntityListOp.fragment.py |
| load | load | reqmatch=None, ctrl=None | EntyClass | src/cmp/py/fragment/EntityLoadOp.fragment.py |
| create | create | reqdata: EntityNameCreateData, ctrl=None | EntyClass | src/cmp/py/fragment/EntityCreateOp.fragment.py |
| update | update | reqdata: EntityNameUpdateData, ctrl=None | EntyClass | src/cmp/py/fragment/EntityUpdateOp.fragment.py |
| patch | patch | reqdata: EntityNamePatchData, ctrl=None | EntyClass | src/cmp/py/fragment/EntityPatchOp.fragment.py |
| remove | remove | reqmatch=None, ctrl=None | EntyClass | src/cmp/py/fragment/EntityRemoveOp.fragment.py |

Entity accessor: `${entity.Name}(data=None)` -> `"${cls}"`; the entity constructor: `__init__(client, entopts=None)`.

| client member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| direct | (fetchargs=None) |  | direct |  |
| get_root_ctx | () |  |  |  |
| get_utility | () |  | utility |  |
| graphql | (query, variables=None, ctrl=None) |  |  |  |
| options | () or (value) |  |  |  |
| options_map | () |  | options |  |
| prepare | (fetchargs=None) |  | prepare |  |
| test | (testopts=None, sdkopts=None) | "ProjectNameSDK" |  |  |

| entity member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| data_get | () | EntityName | dataGet | dataGet + dataSet |
| data_set | (args=None) |  | dataSet | dataGet + dataSet |
| deleted | () |  |  |  |
| get_name | () |  | name |  |
| make | () |  | make |  |
| mark_deleted | () |  |  |  |
| match_get | () | EntityName | matchGet | matchGet + matchSet |
| match_set | (args=None) |  | matchSet | matchGet + matchSet |
| stream | (action, args=None, callopts=None) |  | stream | streamGenerator |

Field types (`canonToType`, column `py`): STRING `str`, INTEGER `int`, NUMBER `float`, BOOLEAN `bool`, NULL `None`, ARRAY `list`, OBJECT `dict`, ANY `Any`.

## rb

Result style: **raise**; operations return. Record accessor: `data_get`, 0 parameter(s).

| operation | method | parameters | returns | source |
| --- | --- | --- | --- | --- |
| list | list | reqmatch = nil, ctrl = nil | Array<EntyClass> | src/cmp/rb/fragment/EntityListOp.fragment.rb |
| load | load | reqmatch = nil, ctrl = nil | EntyClass | src/cmp/rb/fragment/EntityLoadOp.fragment.rb |
| create | create | reqdata, ctrl = nil | EntyClass | src/cmp/rb/fragment/EntityCreateOp.fragment.rb |
| update | update | reqdata, ctrl = nil | EntyClass | src/cmp/rb/fragment/EntityUpdateOp.fragment.rb |
| patch | patch | reqdata, ctrl = nil | EntyClass | src/cmp/rb/fragment/EntityPatchOp.fragment.rb |
| remove | remove | reqmatch = nil, ctrl = nil | EntyClass | src/cmp/rb/fragment/EntityRemoveOp.fragment.rb |

Entity accessor: `${entity.Name}(data = nil)`; the entity constructor: `initialize(client, entopts = nil)`.

| client member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| direct | (fetchargs = {}) |  | direct |  |
| features | (not read) |  |  |  |
| get_root_ctx | property or field |  |  |  |
| get_utility | property or field |  | utility |  |
| graphql | (query, variables = nil, ctrl = nil) |  |  |  |
| inspect | property or field |  |  |  |
| mode | (not read) |  |  |  |
| op_allowed? | (op) |  |  |  |
| op_denied | (op) |  |  |  |
| options | (not read) |  |  |  |
| options_map | property or field |  | options |  |
| prepare | (fetchargs = {}) |  | prepare |  |
| raw_request | (fetchargs = {}) |  |  |  |
| test | (testopts = nil, sdkopts = nil) |  |  |  |
| to_s | property or field |  |  |  |

| entity member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| data_get | property or field | EntityName, Hash | dataGet | dataGet + dataSet |
| data_set | (args) |  | dataSet | dataGet + dataSet |
| deleted | property or field |  |  |  |
| get_name | property or field |  | name |  |
| inspect | property or field |  |  |  |
| make | property or field |  | make |  |
| mark_deleted | property or field |  |  |  |
| match_get | property or field | Hash | matchGet | matchGet + matchSet |
| match_set | (args) |  | matchSet | matchGet + matchSet |
| stream | (action, args = nil, callopts = nil) |  | stream | streamSync |
| to_h | property or field |  |  |  |
| to_s | property or field |  |  |  |

Field types (`canonToType`, column `rb`): STRING `String`, INTEGER `Integer`, NUMBER `Float`, BOOLEAN `Boolean`, NULL `NilClass`, ARRAY `Array`, OBJECT `Hash`, ANY `Object`.

## rust

Result style: **union**; operations return. Record accessor: `data`, 1 parameter(s).

| operation | method | parameters | returns | source |
| --- | --- | --- | --- | --- |
| list | list | reqmatch: Value, ctrl: Value | Result<Vec<Rc<Self>>, ProjectNameError> | src/cmp/rust/fragment/EntityListOp.fragment.rs |
| load | load | reqmatch: Value, ctrl: Value | Result<Rc<Self>, ProjectNameError> | src/cmp/rust/fragment/EntityLoadOp.fragment.rs |
| create | create | reqdata: Value, ctrl: Value | Result<Rc<Self>, ProjectNameError> | src/cmp/rust/fragment/EntityCreateOp.fragment.rs |
| update | update | reqdata: Value, ctrl: Value | Result<Rc<Self>, ProjectNameError> | src/cmp/rust/fragment/EntityUpdateOp.fragment.rs |
| patch | patch | reqdata: Value, ctrl: Value | Result<Rc<Self>, ProjectNameError> | src/cmp/rust/fragment/EntityPatchOp.fragment.rs |
| remove | remove | reqmatch: Value, ctrl: Value | Result<Rc<Self>, ProjectNameError> | src/cmp/rust/fragment/EntityRemoveOp.fragment.rs |

Entity accessor: `${method}(entopts: Value)` -> `Rc<crate::entity::${mod}::${cls}>`; the entity constructor: `new(client: &Rc<ProjectNameSDK>, entopts: Value)`.

| client member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| direct | (fetchargs: Value) | Result<Value, ProjectNameError> | direct |  |
| get_root_ctx | () | Rc<Context> |  |  |
| get_utility | () | Rc<Utility> | utility |  |
| graphql | (query: &str, variables: Value, ctrl: Value) | Result<Value, ProjectNameError> |  |  |
| new | (options: Value) | Rc<ProjectNameSDK> |  |  |
| options_map | () | Value | options |  |
| prepare | (fetchargs: Value) | Result<Value, ProjectNameError> | prepare |  |
| test_sdk | (testopts: Value, sdkopts: Value) | Rc<ProjectNameSDK> |  |  |

| entity member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| data | (args: Option<&Value>) | Value or  | data | dataArg |
| deleted | () | bool or  |  |  |
| ent_ctx | () | Rc<Context> |  |  |
| get_name | () | String or  | name |  |
| make | () | Rc<dyn Entity> or  | make |  |
| mark_deleted | () |  |  |  |
| matchv | (args: Option<&Value>) | Value or  | match | matchArg |
| new | (client: &Rc<ProjectNameSDK>, entopts: Value) | Rc<EntyClass> |  |  |
| stream | (action: &str, args: Value, callopts: Value) | Result<std::vec::IntoIter<Value>, ProjectNameError> | stream | streamList |

Field types (`canonToType`, column `rust`): STRING `String`, INTEGER `i64`, NUMBER `f64`, BOOLEAN `bool`, NULL `Value`, ARRAY `Vec<Value>`, OBJECT `std::collections::HashMap<String, Value>`, ANY `Value`.

## scala

Result style: **throw**; operations return. Record accessor: `data`, 1 parameter(s).

| operation | method | parameters | returns | source |
| --- | --- | --- | --- | --- |
| list | list | reqmatch: JMap[String, Object], ctrl: JMap[String, Object] | Object | src/cmp/scala/fragment/EntityListOp.fragment.scala |
| load | load | reqmatch: JMap[String, Object], ctrl: JMap[String, Object] | Object | src/cmp/scala/fragment/EntityLoadOp.fragment.scala |
| create | create | reqdata: JMap[String, Object], ctrl: JMap[String, Object] | Object | src/cmp/scala/fragment/EntityCreateOp.fragment.scala |
| update | update | reqdata: JMap[String, Object], ctrl: JMap[String, Object] | Object | src/cmp/scala/fragment/EntityUpdateOp.fragment.scala |
| patch | patch | reqdata: JMap[String, Object], ctrl: JMap[String, Object] | Object | src/cmp/scala/fragment/EntityPatchOp.fragment.scala |
| remove | remove | reqmatch: JMap[String, Object], ctrl: JMap[String, Object] | Object | src/cmp/scala/fragment/EntityRemoveOp.fragment.scala |

Entity accessor: `${accessor}(entopts: java.util.Map[String, Object])` -> `SdkEntity`; the entity constructor: `EntyClass(client0: SdkClient, entopts0: JMap[String, Object])`.

| client member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| direct | (fetchargs0: JMap[String, Object]) | JMap[String, Object] | direct |  |
| features | property or field | JList[Feature] |  |  |
| getRootCtx | () | Context |  |  |
| getUtility | () | Utility | utility |  |
| graphql | (query: String, variables: JMap[String, Object] = null, ctrl: JMap[String, Object] = null) | JMap[String, Object] |  |  |
| mode | property or field | String |  |  |
| optionsMap | () | JMap[String, Object] | options |  |
| prepare | (fetchargs0: JMap[String, Object]) | JMap[String, Object] | prepare |  |
| testOptions | (testopts: JMap[String, Object], sdkopts: JMap[String, Object]) | JMap[String, Object] |  |  |
| testSDK | () or (testopts: JMap[String, Object], sdkopts: JMap[String, Object]) | ProjectNameSDK |  |  |
| toString | property or field | String |  |  |

| entity member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| data | (args: Object*) | Object | data | data |
| deleted | () | Boolean |  |  |
| getName | () | String | name |  |
| make | () | Entity | make |  |
| markDeleted | () | Unit |  |  |
| matchArgs | (args: Object*) | Object | match | match |
| stream | (action: String, args: JMap[String, Object], callopts: JMap[String, Object]) | Iterator[Object] | stream | streamSync |

Field types (`canonToType`, column `scala`): STRING `String`, INTEGER `java.lang.Long`, NUMBER `java.lang.Double`, BOOLEAN `java.lang.Boolean`, NULL `Object`, ARRAY `java.util.List[Object]`, OBJECT `java.util.Map[String, Object]`, ANY `Object`.

## swift

Result style: **wrapped**; operations return. Record accessor: `data`, 1 parameter(s).

| operation | method | parameters | returns | source |
| --- | --- | --- | --- | --- |
| list | list | _ reqmatch: VMap?, _ ctrl: VMap? | Value | src/cmp/swift/fragment/EntityListOp.fragment.swift |
| load | load | _ reqmatch: VMap?, _ ctrl: VMap? | Value | src/cmp/swift/fragment/EntityLoadOp.fragment.swift |
| create | create | _ reqdata: VMap?, _ ctrl: VMap? | Value | src/cmp/swift/fragment/EntityCreateOp.fragment.swift |
| update | update | _ reqdata: VMap?, _ ctrl: VMap? | Value | src/cmp/swift/fragment/EntityUpdateOp.fragment.swift |
| patch | patch | _ reqdata: VMap?, _ ctrl: VMap? | Value | src/cmp/swift/fragment/EntityPatchOp.fragment.swift |
| remove | remove | _ reqmatch: VMap?, _ ctrl: VMap? | Value | src/cmp/swift/fragment/EntityRemoveOp.fragment.swift |

Entity accessor: `${entity.Name}(_ entopts: VMap? = nil)` -> `${Name}EntityBase`; the entity constructor: `init(_ client: ProjectNameSDK, _ entopts: VMap? = nil)`.

| client member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| customMirror | property or field | Swift.Mirror |  |  |
| debugDescription | property or field | Swift.String |  |  |
| description | property or field | Swift.String |  |  |
| direct | (_ fetchargsIn: ProjectNameSdk.VMap?) | ProjectNameSdk.VMap | direct |  |
| features | property or field | [BaseFeature] |  |  |
| getRootCtx | () | ProjectNameSdk.Context |  |  |
| getUtility | () | ProjectNameSdk.Utility | utility |  |
| graphql | (_ query: String, _ variables: ProjectNameSdk.VMap? = nil, _ ctrl: ProjectNameSdk.VMap? = nil) | ProjectNameSdk.VMap |  |  |
| mode | property or field |  |  |  |
| optionsMap | () | ProjectNameSdk.VMap | options |  |
| prepare | (_ fetchargsIn: ProjectNameSdk.VMap?) | ProjectNameSdk.VMap | prepare |  |
| testSDK | (_ testoptsIn: ProjectNameSdk.VMap?, _ sdkoptsIn: ProjectNameSdk.VMap?) | ProjectNameSDK |  |  |

| entity member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| create | (_ reqdata: VMap?, _ ctrl: VMap?) | Value |  |  |
| customMirror | property or field | Swift.Mirror |  |  |
| data | (_ newdata: Value?) | Value | data | dataArg |
| debugDescription | property or field | Swift.String |  |  |
| deleted | () | Bool |  |  |
| description | property or field | Swift.String |  |  |
| getName | () | String | name |  |
| list | (_ reqmatch: VMap?, _ ctrl: VMap?) | Value |  |  |
| load | (_ reqmatch: VMap?, _ ctrl: VMap?) | Value |  |  |
| make | () | Entity | make |  |
| markDeleted | () |  |  |  |
| matchv | (_ newmatch: Value?) | Value | match | matchArg |
| patch | (_ reqdata: VMap?, _ ctrl: VMap?) | Value |  |  |
| remove | (_ reqmatch: VMap?, _ ctrl: VMap?) | Value |  |  |
| stream | (_ action: String, _ args: VMap? = nil, _ callopts: VMap? = nil) | AsyncStream<Value> | stream | streamIterator |
| update | (_ reqdata: VMap?, _ ctrl: VMap?) | Value |  |  |

Field types (`canonToType`, column `swift`): STRING `String`, INTEGER `Int`, NUMBER `Double`, BOOLEAN `Bool`, NULL `Value`, ARRAY `[Value]`, OBJECT `VMap`, ANY `Value`.

## ts

Result style: **throw**; operations resolve asynchronously. Record accessor: `data`, 1 parameter(s).

| operation | method | parameters | returns | source |
| --- | --- | --- | --- | --- |
| list | list | reqmatch?: EntityNameListMatch, ctrl?: Control | Promise<EntyClass[]> | src/cmp/ts/fragment/EntityListOp.fragment.ts |
| load | load | reqmatch?: EntityNameLoadMatch, ctrl?: Control | Promise<EntyClass> | src/cmp/ts/fragment/EntityLoadOp.fragment.ts |
| create | create | reqdata?: EntityNameCreateData, ctrl?: Control | Promise<EntyClass> | src/cmp/ts/fragment/EntityCreateOp.fragment.ts |
| update | update | reqdata?: EntityNameUpdateData, ctrl?: Control | Promise<EntyClass> | src/cmp/ts/fragment/EntityUpdateOp.fragment.ts |
| patch | patch | reqdata?: EntityNamePatchData, ctrl?: Control | Promise<EntyClass> | src/cmp/ts/fragment/EntityPatchOp.fragment.ts |
| remove | remove | reqmatch?: EntityNameRemoveMatch, ctrl?: Control | Promise<EntyClass> | src/cmp/ts/fragment/EntityRemoveOp.fragment.ts |

Entity accessor: `${entity.Name}(entopts?: Record<string, any>)`; the entity constructor: `constructor(client: ProjectNameSDK, entopts: any)`.

| client member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| direct | (fetchargs?: any) | Promise<DirectResult> | direct |  |
| graphql | (query: string, variables?: any, ctrl?: any) |  |  |  |
| options | () |  | options |  |
| prepare | (fetchargs?: any) |  | prepare |  |
| test | (testoptsarg?: any, sdkoptsarg?: any) |  |  |  |
| tester | (testopts?: any, sdkopts?: any) |  | tester |  |
| toJSON | () |  |  |  |
| toString | () |  |  |  |
| utility | () |  | utility |  |

| entity member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| client | () |  | client |  |
| data | (data?: Partial<D>) | D | data | data |
| deleted | () | boolean |  |  |
| entopts | () |  | entopts |  |
| make | () |  | make |  |
| markDeleted | () | void |  |  |
| match | (match?: Partial<D>) | Partial<D> | match | match |
| stream | (action: string, args?: any, callopts?: any) | AsyncGenerator<any> | stream | streamIterator |
| toJSON | () |  |  |  |
| toString | () |  |  |  |

Field types (`canonToType`, column `ts`): STRING `string`, INTEGER `number`, NUMBER `number`, BOOLEAN `boolean`, NULL `null`, ARRAY `any[]`, OBJECT `Record<string, any>`, ANY `any`.

## zig

Result style: **union**; operations return. Record accessor: `data`, 1 parameter(s).

| operation | method | parameters | returns | source |
| --- | --- | --- | --- | --- |
| list | list | reqmatch: Value, ctrl: Value | EntListResult | src/cmp/zig/fragment/EntityListOp.fragment.zig |
| load | load | reqmatch: Value, ctrl: Value | EntResult | src/cmp/zig/fragment/EntityLoadOp.fragment.zig |
| create | create | reqdata: Value, ctrl: Value | EntResult | src/cmp/zig/fragment/EntityCreateOp.fragment.zig |
| update | update | reqdata: Value, ctrl: Value | EntResult | src/cmp/zig/fragment/EntityUpdateOp.fragment.zig |
| patch | patch | reqdata: Value, ctrl: Value | EntResult | src/cmp/zig/fragment/EntityPatchOp.fragment.zig |
| remove | remove | reqmatch: Value, ctrl: Value | EntResult | src/cmp/zig/fragment/EntityRemoveOp.fragment.zig |

Entity accessor: `${method}(entopts: Value)` -> `*@import("../entity/${mod}.zig").${cls}`; the entity constructor: `new(client: *sdk.ProjectNameSDK, entopts_in: Value)`.

| client member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| direct | (fetchargs_in: Value) | Value | direct |  |
| get_root_ctx | () | *Context |  |  |
| get_utility | () | *Utility | utility |  |
| graphql | (query: []const u8, variables: Value, ctrl: Value) | Value |  |  |
| new | (options: Value) | *ProjectNameSDK |  |  |
| new_with | (options: Value, extend: []const Feature) | *ProjectNameSDK |  |  |
| options_map | () | Value | options |  |
| prepare | (fetchargs_in: Value) | E!Value | prepare |  |
| test_sdk | (testopts_in: Value, sdkopts_in: Value) | *ProjectNameSDK |  |  |

| entity member | parameters | returns | family | shape |
| --- | --- | --- | --- | --- |
| asEntity | () | Entity |  |  |
| data | (args: ?Value) | Value | data | dataArg |
| get_name | () | []const u8 | name |  |
| is_deleted | () | bool |  |  |
| makeEnt | () | Entity |  |  |
| mark_deleted | () | void |  |  |
| matchv | (args: ?Value) | Value | match | matchArg |
| stream | (action: []const u8, args: Value, callopts: Value) | StreamResult | stream | streamList |

Field types: no code generator column (the code generator has no zig column in canonToType: every field is a Value, so the page's type words are the provider's own).
