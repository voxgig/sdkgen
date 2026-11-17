# Survey: what each of the twenty runtimes does, in twelve questions

Ten readers, two runtimes each, read the code of version 3.2 (`P/base32/sdkgen/ts/project/.sdk/src/cmp/<lang>/`, `tm/<lang>/`) and answered from it, with file and line. Every answer is a claim by one reader; "sure" is the reader's own word. Paths in the evidence are relative to `ts/project/.sdk/` unless they say otherwise.

Languages covered: ts js go c py rb php perl lua elixir java kotlin scala csharp swift cpp zig rust clojure ocaml


## 1. The accessor and the cache

### ts

- **answer** (read and certain): The accessor makes a new entity on every call, with or without an argument, including undefined or null. It never caches. The argument is the entity OPTIONS object (entopts), not initial data. null or undefined becomes {} in the entity constructor. The constructor also mutates the caller's object: it sets entopts.active.
- **evidence**: src/cmp/ts/MainEntity_ts.ts:23-25 "${entity.Name}(entopts?: Record<string, any>) {" / "return new ${cls}(self, entopts)"; :21-22 "The argument is the entity OPTIONS object (passed to the entity constructor as entopts), not initial entity data."; src/cmp/ts/fragment/EntityBase.fragment.ts:36-37 "entopts = entopts || {}" / "entopts.active = false !== entopts.active"
- **old page**: Old README (out/old/B/ts/README.md) lists `Ambient(data?)` with 'Create an Ambient entity instance'. Old REFERENCE.md documents the parameter as `data` | `object` | 'Initial entity data.' That is wrong: the argument is entopts.

### js

- **answer** (read and certain): Same as ts: a new entity on every call, never cached. The argument is entopts, not data. null or undefined becomes {}.
- **evidence**: src/cmp/js/MainEntity_js.ts:23-25 "${entity.Name}(entopts) {" / "return new ${cls}(self, entopts)"; src/cmp/js/fragment/EntityBase.fragment.js:18-19 "entopts = entopts || {}" / "entopts.active = false !== entopts.active"
- **old page**: out/old/B/js/README.md:230 "| `Ambient(data?)` | `AmbientEntity` | Create an Ambient entity instance. |": the parameter name is wrong (it is entopts).

### go

- **answer** (read and certain): A new entity every call, with or without an argument: the client keeps no entity. The argument (named `data`) is NOT data: it is passed through as the entity's entopts (entity options), so `client.Planet(map[string]any{"id":"x"})` sets no data. nil gives fresh entopts {active:true}.
- **evidence**: ts/project/.sdk/src/cmp/go/MainEntity_go.ts:17 "func (sdk *${model.const.Name}SDK) ${entity.Name}(data map[string]any) ${model.const.Name}EntityBase {"; :18 "return New${entity.Name}EntityFunc(sdk, data)"; ts/project/.sdk/src/cmp/go/Main_go.ts:192 "core.New${ent.Name}EntityFunc = func(client *core.${model.const.Name}SDK, entopts map[string]any) ..."; ts/project/.sdk/src/cmp/go/fragment/Entity.fragment.go:23 "func NewEntyClass(client *core.ProjectNameSDK, entopts map[string]any) *EntyClass {"; :39 "entopts: entopts,"; :40 "data:    map[string]any{},"
- **old page**: go/REFERENCE.md: "#### `Planet(data map[string]any) DemoEntityBase` Create a new `Planet` entity instance. Pass `nil` for no initial data." and README table "`(data map[string]any) DemoEntityBase` | Create an Ambient entity instance" - 'new instance' is right, 'initial data' is false: the map becomes entity options.

### c

- **answer** (read and certain): A new entity every call (calloc in entity_new); the client keeps none. The argument is the entity options (`entopts`, a voxgig_value* map; NULL or a non-map gives a fresh map with active=true). It does not set data.
- **evidence**: ts/project/.sdk/src/cmp/c/MainEntity_c.ts:20-21 "Entity* ${cAccessorName(model, entity.name)}(${Name}SDK* client, voxgig_value* entopts) {" / "return ${evar}_entity_new(client, entopts);"; src/cmp/c/fragment/Entity.fragment.c:44 "entopts = voxgig_is_map(entopts) ? entopts : voxgig_new_map();"; :53 "entyvar_entity* self = (entyvar_entity*)calloc(1, sizeof(entyvar_entity));"; :59 "self->data = voxgig_new_map();"
- **old page**: "`demo_ambient` | `(DemoSDK*, entopts) -> Entity*` | Create an Ambient entity instance." - consistent.

### py

- **answer** (read and certain): The accessor makes a new entity on every call, with or without an argument. The client keeps no cache. The argument is NOT data: it is passed as the entity constructor's second parameter, `entopts`, so it becomes entity options. The constructor also writes `active` into the caller's dict.
- **evidence**: src/cmp/py/MainEntity_py.ts:21 "def ${entity.Name}(self, data=None) -> \"${cls}\":"; :24 "return ${cls}(self, data)"; src/cmp/py/fragment/Entity.fragment.py:12 "def __init__(self, client, entopts=None):"; :16 "entopts[\"active\"] = True"; :25 "self._entopts = entopts"; :26 "self._data = {}"
- **old page**: py/README.md and the REFERENCE list the accessor as `(data) -> XEntity`, 'Create an X entity instance'. Calling the parameter data is wrong: it is entopts.

### rb

- **answer** (read and certain): The accessor makes a new entity on every call (`Cls.new(self, data)`), with or without an argument. The client keeps no cache. As in py, the argument is passed to the constructor's `entopts` parameter, not used as data, and the constructor writes "active" into the caller's Hash.
- **evidence**: src/cmp/rb/MainEntity_rb.ts:21 "def ${entity.Name}(data = nil)"; :23 "${cls}.new(self, data)"; src/cmp/rb/fragment/Entity.fragment.rb:7 "def initialize(client, entopts = nil)"; :10 "entopts[\"active\"] = true"; :21 "@_data = {}"
- **old page**: rb/REFERENCE.md:61 "#### `Planet(data = nil)`" with 'Pass `nil` for no initial data.' This is false: the argument becomes entity options and the entity's data starts as {}.

### php

- **answer** (read and certain): Called with no argument or null, the accessor returns one entity that the client keeps in a private field and creates on the first call. Called with a non-null argument, it makes a new entity every time. The argument becomes the entity's entopts, not its data.
- **evidence**: ts/project/.sdk/src/cmp/php/MainEntity_php.ts:30 "private $_${field} = null;"; :43-47 "if ($data === null) { if ($this->_${field} === null) { $this->_${field} = new ${cls}($this, null); } return $this->_${field};"; :49 "return new ${cls}($this, $data);"; fragment/Entity.fragment.php:22 "public function __construct($client, ?array $entopts = null)"
- **old page**: The old README method table says `Ambient | ($data): AmbientEntity | Create an Ambient entity instance.` That is false for the no-argument call, which returns the cached instance.

### perl

- **answer** (read and certain): The accessor makes a new entity on every call, with or without an argument; there is no cache. The argument is passed to the entity constructor as entopts, not as data.
- **evidence**: ts/project/.sdk/src/cmp/perl/MainEntity_perl.ts:21-24 "sub ${entity.Name} { my ($self, $data) = @_; require(...); return ${cls}->new($self, $data);"; fragment/Entity.fragment.pm:18 "my ($class, $client, $entopts) = @_;"
- **old page**: The old page says "Create an Ambient entity instance" and "Create an instance: `my $ambient = $client->Ambient;`". Both are consistent with the code.

### lua

- **answer** (read and certain): With no argument (nil) the accessor returns one entity the client keeps: the first call makes it and stores it on the client, and later calls return that same instance, state included. With an argument it makes a new entity every time and does not cache it.
- **evidence**: S/src/cmp/lua/MainEntity_lua.ts:18-26: "function ${model.const.Name}SDK:${entity.Name}(data)" / "if data == nil then" / "if self._${field} == nil then" / "self._${field} = EntityMod.new(self, nil)" / "return self._${field}" / "return EntityMod.new(self, data)" (S = P/base32/sdkgen/ts/project/.sdk)
- **old page**: Not stated. README.md:948-956 ('local ambient = client:Ambient() ... Call make() to create a fresh instance') does not say the accessor caches.

### elixir

- **answer** (read and certain): No cache: the accessor is a module function that calls the entity module's new/2 on every call, with or without entopts, so each call returns a new entity node.
- **evidence**: S/src/cmp/elixir/MainEntity_elixir.ts:20-21: "def ${accessor}(client, entopts \\\\ nil) do" / "${elixirEntityModule(Name, entity)}.new(client, entopts)"; S/tm/elixir/lib/projectname/entity_base.ex:22: "ent = S.jm([])"
- **old page**: Not stated.

### java

- **answer** (read and certain): The accessor (e.g. client.planet(entopts)) makes a new entity on every call, with null or with a map. There is no cache field and no no-argument overload; null is the 'no argument' form.
- **evidence**: sdkgen/ts/project/.sdk/src/cmp/java/MainEntity_java.ts:31-32 "public SdkEntity ${accessor}(Map<String, Object> entopts) {" / "return new ${javapackage}.entity.${cls}(this, entopts);"
- **old page**: README 'DemoSDK methods' table: "Create an Ambient entity instance." Consistent.

### kotlin

- **answer** (read and certain): Same as java: client.planet(entopts) constructs a new entity every call, null or a map. No cache, no zero-arg overload.
- **evidence**: sdkgen/ts/project/.sdk/src/cmp/kotlin/MainEntity_kotlin.ts:29-30 "fun ${accessor}(entopts: MutableMap<String, Any?>?): SdkEntity {" / "return ${kotlinpackage}.entity.${cls}(this, entopts)"
- **old page**: Consistent ("Create a Record entity instance.").

### scala

- **answer** (read and certain): The accessor makes a new entity on every call, whether it gets null or a map. The client keeps no cache. The argument is the entopts map. It is passed by reference and mutated: the entity writes an `active` key into the caller's map.
- **evidence**: src/cmp/scala/MainEntity_scala.ts:31-32 `def ${accessor}(entopts: java.util.Map[String, Object]): SdkEntity =` / `new ${scalapackage}.entity.${cls}(this, entopts)`; src/cmp/scala/fragment/EntityBase.fragment.scala:22-28 `var eo = entopts0` ... `if (!eo.containsKey("active")) eo.put("active", java.lang.Boolean.TRUE)` ... `this.entopts = eo`
- **old page**: Not stated.

### csharp

- **answer** (read and certain): The accessor makes a new entity on every call, with no argument (`entopts = null` is the default), with null, or with a dictionary. The client keeps no cache. The dictionary is passed by reference and mutated: an `active` key is set in the caller's map.
- **evidence**: src/cmp/csharp/MainEntity_csharp.ts:25-27 `public ${model.const.Name}EntityBase ${entity.Name}(Dictionary<string, object?>? entopts = null)` / `return new global::${model.const.Name}Sdk.Entity.${cls}(this, entopts);`; src/cmp/csharp/fragment/EntityBase.fragment.cs:42-45 `entopts ??= new Dictionary<string, object?>();` `if (!entopts.ContainsKey("active"))` `entopts["active"] = true;`
- **old page**: Not stated.

### swift

- **answer** (read and certain): A new entity every call, with or without an argument (nil or a VMap). The accessor builds a fresh entity instance each time and the client keeps no cache.
- **evidence**: All paths below are relative to P/base32/sdkgen/ts/project/.sdk. src/cmp/swift/MainEntity_swift.ts:25 "public func ${entity.Name}(_ entopts: VMap? = nil) -> ${Name}EntityBase {"; :26 "return ${cls}(self, entopts)". src/cmp/swift/fragment/Main.fragment.swift:19-24: the client's stored properties are mode, options, utility, features and rootctx, with no entity map.
- **old page**: B/swift/README.md:228 "| `Ambient` | `(entopts) -> DemoEntityBase` | Create an Ambient entity instance. |". Consistent.

### cpp

- **answer** (read and certain): A new entity every call, with or without an argument (Value::undef() or a map). The accessor returns std::make_shared of the entity class each time, and the client holds no entity cache.
- **evidence**: src/cmp/cpp/MainEntity_cpp.ts:25 "std::shared_ptr<${cls}> ${accessor}(Value entopts = Value::undef()) {"; :26 "return std::make_shared<${cls}>(this, entopts);"; tm/cpp/core/types.hpp:653-658 (client fields mode, features, options, utility, rootctx, with no entity cache).
- **old page**: B/cpp/README.md:221 "| `ambient` | `(entopts) -> std::shared_ptr<AmbientEntity>` | Create an Ambient entity instance. |". Consistent.

### zig

- **answer** (read and certain): Same as rust: the accessor takes a required `entopts: Value` and always calls `.new`, so every call returns a newly allocated entity. `h.vnull()` and a map behave the same here, except that a map is used as the entity options. The client struct has no entity cache.
- **evidence**: src/cmp/zig/MainEntity_zig.ts:28 `pub fn ${method}(self: *@This(), entopts: Value) *@import("../entity/${mod}.zig").${cls} {`; :29 `return @import("../entity/${mod}.zig").${cls}.new(self, entopts);`; src/cmp/zig/fragment/Entity.fragment.zig:50-53 `const entopts: Value = switch (entopts_in) { .object => entopts_in, else => h.omap(), };`; :61 `const e = h.A().create(EntyClass) catch unreachable;`; Main.fragment.zig:22-40 (no entity field)
- **old page**: zig/README.md: "`ambient` | `(entopts: Value) *AmbientEntity` | Create an Ambient entity instance." Consistent.

### rust

- **answer** (read and certain): The accessor takes a required `entopts: Value` and always constructs a new entity; the client keeps no entity cache. Passing `Value::Noval` (the null) or a map makes no difference to this: a non-map entopts becomes an empty map, and a new `Rc<Entity>` comes back every time.
- **evidence**: src/cmp/rust/MainEntity_rust.ts:27 `pub fn ${method}(self: &Rc<Self>, entopts: Value) -> Rc<crate::entity::${mod}::${cls}> {`; :28 `crate::entity::${mod}::${cls}::new(self, entopts)`; src/cmp/rust/fragment/Entity.fragment.rs:33-35 `let entopts = match entopts { Value::Map(m) => Value::Map(m), _ => Value::empty_map(), };`; :43 `let e = Rc::new(EntyClass {`; Main.fragment.rs:16-22 (struct ProjectNameSDK has no entity field)
- **old page**: rust/README.md table: "`ambient` | `(entopts: Value) -> Rc<AmbientEntity>` | Create an Ambient entity instance." Consistent.

### clojure

- **answer** (read and certain): No cache. The accessor `(api/<name> client x)` calls `make`, which calls `new-entity`. Every call returns a new entity map, whether x is nil or a value. The argument is not entity data: `new-entity` takes it as the entity OPTIONS (entopts), so the new entity's data starts empty.
- **evidence**: Paths are relative to base32/sdkgen/ts/project/.sdk/. src/cmp/clojure/MainEntity_clojure.ts:121 `(defn ${cljAccessor(entity)} [client data] (${cljEntityAlias(entity)}/make client data))`; src/cmp/clojure/fragment/Entity.fragment.clj:54 `(defn make [client data] (new-entity client data))`; :32-35 `(defn- new-entity [client entopts] (let [entopts (ensure-entopts entopts) ... data (atom (vs/jm))`
- **old page**: REFERENCE.md:47 says "Create a new `Ambient` entity instance. Pass `nil` for no initial data." The 'new instance' part is right. Calling the argument 'initial data' is wrong: it becomes entopts and never reaches the data.

### ocaml

- **answer** (read and certain): No cache. `Sdk_client.<name> client entopts` calls `<Mod>.make client entopts`, which builds a new `entity_obj` record on every call, with Noval or with a value. The argument is entity OPTIONS: Noval or a non-map becomes an empty map, and the data starts empty.
- **evidence**: src/cmp/ocaml/MainEntity_ocaml.ts:311-312 `let ${fn} (client : sdk_client) (entopts : value) : entity_obj =\n  ${Mod}.make client entopts`; src/cmp/ocaml/Entity_ocaml.ts:60-61 `let rec make (client : sdk_client) (entopts_in : value) : entity_obj = let entopts = match to_map entopts_in with Map _ as m -> m | _ -> empty_map () in`; :71 `e_data = empty_map ();`
- **old page**: README.md:209 'An Ambient entity accessor' does not say what the argument is.


## 2. Getters: a copy or the live value

### ts

- **answer** (read and certain): options() returns struct.clone(_options). That is a deep JSON copy of plain data, but functions (system.fetch) and class instances (extend features) are shared by reference. utility() returns struct.clone(_utility), and because Utility is a class instance, clone hands back THE SAME LIVE OBJECT, not a copy. data() and match() return struct.clone of _data and _match (deep copies). entopts() returns merge([{}, _entopts]), a new object whose nested maps are also copied. client() returns the live client.
- **evidence**: src/cmp/ts/fragment/Main.fragment.ts:104-111 "return this._utility.struct.clone(this._options)" / "return this._utility.struct.clone(this._utility)"; :31 "_utility = new Utility()"; tm/ts/src/utility/Utility.ts:37 "class Utility {"; tm/ts/src/utility/StructUtility.ts:752 "// Copy (don't clone) functions and non-plain-object instances by reference." and :764-765 "v.constructor instanceof Function && 'Object' !== v.constructor.name"; EntityBase.fragment.ts:89 "let out = struct.clone(this._data)"; :105 "let out = struct.clone(this._match)"; :71 "return this._utility.struct.merge([{}, this._entopts])"; :75 "return this._client". I checked this by running tm/js StructUtility clone in node: clone(new U()) === instance -> true; merge([{}, e]).n === e.n -> false.
- **old page**: The old README says `utility()` | 'Deep copy of the SDK utility object.' The old REFERENCE says 'Return a copy of the SDK utility object.' Both are FALSE: utility() returns the live instance. Its description of options() as a 'Deep copy' holds for plain data only.

### js

- **answer** (read and certain): Identical to ts: options() is a deep copy of plain data; utility() returns the live Utility instance, because clone keeps class instances by reference; data() and match() are deep copies; entopts() is a merged copy; client() is live.
- **evidence**: src/cmp/js/fragment/Main.fragment.js:99 "return this._utility.struct.clone(this._options)"; :104 "return this._utility.struct.clone(this._utility)"; tm/js/src/utility/Utility.js:37 "class Utility {"; tm/js/src/utility/StructUtility.js:675 "// Copy (don't clone) functions and non-plain-object instances by reference."; EntityBase.fragment.js:75 "let out = struct.clone(this._data)"; :91 "let out = struct.clone(this._match)"; :57 "return this._utility.struct.merge([{}, this._entopts])"
- **old page**: out/old/B/js/README.md:227 "| `utility()` | `Utility` | Deep copy of the SDK utility object. |": false.

### go

- **answer** (read and certain): Client options getter `OptionsMap()`: deep clone. Client utility getter `GetUtility()`: a copy (new *Utility struct, value-copied, its Custom map copied one level; function fields shared). Entity data getter `Data()`: clone. Match getter `Match()`: clone. Entity-options getter: does not exist (entopts is an unexported field). Setters `Data(x)`/`Match(x)` also store a clone of the argument.
- **evidence**: ts/project/.sdk/src/cmp/go/fragment/Main.fragment.go:104-105 "func (sdk *ProjectNameSDK) OptionsMap() map[string]any {" / "out := vs.Clone(sdk.options)"; :112-113 "func (sdk *ProjectNameSDK) GetUtility() *Utility {" / "return CopyUtility(sdk.utility)"; ts/project/.sdk/tm/go/core/utility_type.go:52-55 "*u = *src" / "u.Custom = map[string]any{}"; Entity.fragment.go:100 "e.data = vs.Clone(args[0])"; :105 "out := vs.Clone(e.data)"; :119 "out := vs.Clone(e.match)"; :16 "entopts map[string]any" (unexported, no getter in Entity interface tm/go/core/types.go:26-34)
- **old page**: README: "`OptionsMap` ... Deep copy of current SDK options.", "`GetUtility` ... Copy of the SDK utility object."; REFERENCE: Data "returns a copy of the current data" - consistent.

### c

- **answer** (read and certain): Options getter `sdk_options_map(client)`: deep clone. Utility getter `sdk_get_utility(client)`: a newly allocated Utility sharing the same fetcher pointer with a shallow copy of the custom map (a copy, not the live struct). Entity `vt->data(e, NULL)`: clone. `vt->matchv(e, NULL)`: clone. Entity-options getter: does not exist (entopts is a private field of the per-entity struct defined in the .c file). Setting via data/matchv stores a clone.
- **evidence**: ts/project/.sdk/tm/c/core/utility.c:70 "voxgig_value* sdk_options_map(ProjectNameSDK* sdk) { return voxgig_clone(sdk->options); }"; :72 "Utility* sdk_get_utility(ProjectNameSDK* sdk) { return utility_copy(sdk->utility); }"; :20-29 "Utility* utility_copy(Utility* src) {" ... "u->fetcher = src->fetcher;" / "// Shallow copy of the custom map."; Entity.fragment.c:245 "self->data = voxgig_clone(args);"; :249 "return voxgig_clone(self->data);"; :260 "return voxgig_clone(self->mtch);"; :13 "voxgig_value* entopts;" (inside the static struct, no vtable entry: tm/c/core/sdk.h:347-367)
- **old page**: README: "`data` | `(Entity*, args) -> voxgig_value*` | Get entity data (pass a map to set)." - silent on clone; sdk.h comment says "deep clone of options".

### py

- **answer** (read and certain): Options: `client.options` is a property that returns the live dict the client holds, and it has a setter. `client.options_map()` returns a deep clone. Utility: `client.get_utility()` returns a shallow copy, a new Utility object holding the same function references. Entity data: `data_get()` returns a clone. Match: `match_get()` returns a clone. Entity options: the entity has no getter (`_entopts` is private). The client attribute `_utility` is private.
- **evidence**: tm: src/cmp/py/fragment/Main.fragment.py:96-98 "@property / def options(self): / return self._options"; :107-108 "def options_map(self): / out = vs.clone(self.options)"; :113-114 "def get_utility(self): / return ProjectNameUtility.copy(self._utility)"; tm/py/pkg/core/utility_type.py:52-54 "def copy(cls, src): / u = cls() / u.clean = src.clean"; src/cmp/py/fragment/Entity.fragment.py:61-63 "def data_get(self) -> EntityName: ... return vs.clone(self._data)"; :70-72 "def match_get(self) ... return vs.clone(self._match)"
- **old page**: py/REFERENCE.md:75 'Return a deep copy of the current SDK options.' (options_map) and :79 'Return a copy of the SDK utility object.' Both agree with the code. The live `options` property is not documented.

### rb

- **answer** (read and certain): Options: `client.options` is an attr_accessor that returns, and allows replacing, the live Hash. `client.options_map` returns a deep clone. Utility: `client.get_utility` returns a shallow copy: the instance variables are copied by reference and only `@custom` is dup'ed. Entity data: `data_get` returns a clone, and so does `to_h`. Match: `match_get` returns a clone. Entity options: no getter exists.
- **evidence**: src/cmp/rb/fragment/Main.fragment.rb:21 "attr_accessor :mode, :features, :options"; :85-86 "def options_map / out = VoxgigStruct.clone(@options)"; :90-91 "def get_utility / ProjectNameUtility.copy(@_utility)"; tm/rb/core/utility_type.rb:27-30 "src.instance_variables.each do |var| ... u.instance_variable_set(:@custom, src.custom.dup)"; src/cmp/rb/fragment/Entity.fragment.rb:77-79 "def data_get ... VoxgigStruct.clone(@_data)"; :90-92 "def match_get ... VoxgigStruct.clone(@_match)"
- **old page**: rb/REFERENCE.md:75/79 say 'deep copy' (options_map) and 'copy' (get_utility). Both agree with the code. rb/REFERENCE.md:138 says data_get 'Returns a copy of the current data', which is correct.

### php

- **answer** (read and certain): options_map() returns a deep clone. get_utility() returns a new utility object (UtilityType::copy) that holds the same closures, so it is a shallow copy. data_get() and match_get() each return a clone. There is no entity-options getter and no client getter on the entity. The client's `options` property is public, so `$client->options` reads the live array; PHP arrays are value types, though, so the caller gets a copy on write.
- **evidence**: fragment/Main.fragment.php:116 "$out = Struct::clone($this->options);"; :135 "return ProjectNameUtility::copy($this->_utility);"; tm/php/core/UtilityType.php:58-60 "public static function copy(ProjectNameUtility $src): ProjectNameUtility { $u = new ProjectNameUtility(); $u->clean = $src->clean;"; fragment/Entity.fragment.php:114 "return Struct::clone($this->_data);"; :134 "return Struct::clone($this->_match);"; :16 "private array $_entopts;" (no getter); Main.fragment.php:29 "public ?array $options;"
- **old page**: The old page says `options_map` is a deep copy and `get_utility` is a copy. Both agree with the code.

### perl

- **answer** (read and certain): options_map returns a deep clone. get_utility returns a new utility hash with the same coderefs and a copied custom map, so it is a shallow copy. data_get and match_get each return a clone. There is no entity-options getter and no client getter. The client is a blessed hashref, so `$client->{options}` reads the live hash with nothing to stop it.
- **evidence**: fragment/Main.fragment.pm:105 "my $out = Voxgig::Struct::clone($self->{options});"; :111 "return ProjectNameUtility->copy($self->{_utility});"; tm/perl/core/utility_type.pm:22-28 "sub copy { ... for my $k (keys %$src) { $u->{$k} = $src->{$k}; } $u->{custom} = { %{ $src->{custom} || {} } };"; fragment/Entity.fragment.pm:103 "return Voxgig::Struct::clone($self->{_data});"; :119 "return Voxgig::Struct::clone($self->{_match});"
- **old page**: The old page says "Deep copy of current SDK options" and "Copy of the SDK utility object". Both agree with the code.

### lua

- **answer** (read and certain): options_map() returns a deep clone. get_utility() returns a new Utility table holding the same function members and a shallow copy of custom, so it is a copy but the functions are shared. data_get() and match_get() return clones. No entity-options getter exists: the options sit in the raw field _entopts.
- **evidence**: S/tm/../src/cmp/lua/fragment/Main.fragment.lua:159-160: "function ProjectNameSDK:options_map()" / "local out = vs.clone(self.options)"; Main.fragment.lua:168-169: "function ProjectNameSDK:get_utility()" / "return Utility.copy(self._utility)"; S/tm/lua/core/utility_type.lua:53-54: "function Utility.copy(src)" / "local u = Utility.new()", :87-89: "u.custom = {}" / "for k, v in pairs(src.custom) do" / "u.custom[k] = v"; Entity.fragment.lua:100-102: "function EntyClass:data_get()" ... "return vs.clone(self._data)"; :114-116: "function EntyClass:match_get()" ... "return vs.clone(self._match)"; :26: "self._entopts = entopts" (no getter in the file)
- **old page**: README.md:202-203: options_map 'Deep copy of current SDK options.', get_utility 'Copy of the SDK utility object.' REFERENCE.md:135: data_get 'Returns a copy of the current data.' These agree.

### elixir

- **answer** (read and certain): options_map(client) returns a clone. get_utility(client) returns the live utility node the client holds, with no copy. This is a difference from lua. data_get(ent) and match_get(ent) return clones. No entity-options getter exists: the options are read only with S.getprop(ent, "_entopts").
- **evidence**: S/src/cmp/elixir/fragment/Main.fragment.ex:79-80: "def options_map(client) do" / "out = S.clone(S.getprop(client, \"options\"))"; :84: "def get_utility(client), do: S.getprop(client, \"_utility\")"; S/tm/elixir/lib/projectname/entity_base.ex:86-88: "def data_get(ent) do" ... "S.clone(S.getprop(ent, \"_data\"))"; :100-102: "def match_get(ent) do" ... "S.clone(S.getprop(ent, \"_match\"))"; :27: "S.setprop(ent, \"_entopts\", entopts)"
- **old page**: README.md:234-235: options_map 'Deep copy of current SDK options.', get_utility 'The SDK utility node.' REFERENCE.md:75-77: 'Return the SDK utility node.' Consistent: it does not claim a copy.

### java

- **answer** (read and certain): optionsMap(): deep clone. getUtility(): a new Utility holder whose function members are the same references (shallow copy; only the custom map is copied). data(): clone. match(): clone. No entity-options getter exists (entopts is a protected field).
- **evidence**: tm/java/core/SdkClient.java:99-100 "public Map<String, Object> optionsMap() {" "Object out = Struct.clone(this.options);"; :107-108 "public Utility getUtility() {" "return this.utility.copy();"; tm/java/core/Utility.java:100 "Utility u = new Utility(true);" :109 "u.fetcher = this.fetcher;" :135 "u.custom = new LinkedHashMap<>(this.custom);"; src/cmp/java/fragment/EntityBase.fragment.java:94 "return Struct.clone(this.data);" :106 "return Struct.clone(this.match);" :33 "protected Map<String, Object> entopts;"
- **old page**: README: optionsMap "Deep copy of current SDK options."; getUtility "Copy of the SDK utility object." (it is a shallow copy). data/match: "Get or set entity data." (does not say clone).

### kotlin

- **answer** (read and certain): Same as java: optionsMap() deep clone; getUtility() new Utility with shared function references (custom map copied); data() clone; match() clone; no entity-options getter (entopts protected var).
- **evidence**: tm/kotlin/core/SdkClient.kt:89-90 "fun optionsMap(): MutableMap<String, Any?> {" "val out = Struct.clone(this.options)"; :97-98 "fun getUtility(): Utility {" "return this.util.copy()"; tm/kotlin/core/Utility.kt:60 "val u = Utility(false)" :95 "u.custom = LinkedHashMap(this.custom)"; src/cmp/kotlin/fragment/EntityBase.fragment.kt:87 "return Struct.clone(this.data)" :98 "return Struct.clone(this.match)" :51 "protected var entopts: MutableMap<String, Any?>"
- **old page**: Same wording as java.

### scala

- **answer** (read and certain): `optionsMap()` returns a deep clone. `getUtility()` returns `Utility.copy()`: a new Utility with the same function references and a fresh copy of the `custom` map. `data()` returns a clone. `matchArgs()` returns a clone. There is no public entity-options getter: `entopts` is a protected var. `make()` copies it into a new entity but does not return it.
- **evidence**: tm/scala/core/SdkClient.scala:83 `def optionsMap(): JMap[String, Object] = Struct.clone(this.options) match {`; :88 `def getUtility(): Utility = this.utility.copy()`; tm/scala/core/Utility.scala:53-54 `// A field-level copy sharing nothing mutable but the function refs.` `def copy(): Utility = {`; src/cmp/scala/fragment/EntityBase.fragment.scala:49 `Struct.clone(this.dataState)`; :59 `Struct.clone(this.matchState)`; :16 `protected var entopts: JMap[String, Object] = null`
- **old page**: README:209-210 says 'Deep copy of current SDK options' and 'Copy of the SDK utility object'. Both agree with the code.

### csharp

- **answer** (read and certain): `OptionsMap()` returns a deep clone (StructUtils.Clone). `GetUtility()` returns `Utility.Copy(_utility)`: a new Utility with the same delegates and a fresh copy of `Custom`. `Data()` returns a clone. `Match()` returns a clone. There is no public entity-options getter: `entopts` is a protected field, and `CloneOpts()` is protected.
- **evidence**: src/cmp/csharp/fragment/Main.fragment.cs:97-99 `public Dictionary<string, object?> OptionsMap()` `return global::Voxgig.Struct.StructUtils.Clone(_options) as Dictionary<string, object?>`; :103-105 `public Utility GetUtility()` `return global::ProjectNameSdk.Utility.Copy(_utility);`; tm/csharp/core/Utility.cs:54 `public static Utility Copy(Utility src)`, :90 `Custom = new Dictionary<string, object?>(src.Custom),`; src/cmp/csharp/fragment/EntityBase.fragment.cs:85 `return StructUtils.Clone(data);`; :98 `return StructUtils.Clone(match);`; :18 `protected Dictionary<string, object?> entopts;`; :70 `protected Dictionary<string, object?> CloneOpts()`
- **old page**: README:224-225 says 'Deep copy of current SDK options' and 'Copy of the SDK utility object'. Both agree with the code.

### swift

- **answer** (read and certain): The options getter optionsMap() returns a deep clone. The utility getter getUtility() returns a new Utility whose function slots are copied from the original, a shallow copy. The data getter data() returns a clone. The match getter is matchv(), and it returns a clone. There is no entity-options getter: entopts is an internal stored property, not public, so a program outside the module cannot read it.
- **evidence**: src/cmp/swift/fragment/Main.fragment.swift:85 "return clone(.map(options)).asMap ?? ProjectNameSdk.VMap()"; :89 "return ProjectNameSdk.Utility.copy(utility)"; tm/swift/Sources/ProjectNameSDK/core/Utility.swift:50-52 "public static func copy(_ src: Utility) -> Utility { let u = Utility(noregister: true) u.clean = src.clean"; src/cmp/swift/fragment/EntityBase.fragment.swift:54 "return clone(data)"; :64 "return clone(.map(match))"; :12 "var entopts: VMap" (no access modifier, so internal).
- **old page**: B/swift/README.md:225 "Deep copy of current SDK options."; :226 "Copy of the SDK utility object." Consistent. The page does not say that data() and matchv() return clones.

### cpp

- **answer** (read and certain): The options getter optionsMap() returns Struct::clone(options). The utility getter getUtility() returns utility->copy(), a new Utility with its function slots copied. The data getter data() returns a clone. The match getter match() returns a clone. There is no entity-options getter, but `entopts` is a public data member, read live. The client's `options` and `utility` are also public data members, so a program can bypass the copying getters and read the live values directly.
- **evidence**: tm/cpp/core/types.hpp:984 "Value out = Struct::clone(options);"; :988 "inline UtilityPtr SdkClient::getUtility() { return utility->copy(); }"; :587-589 "UtilityPtr copy() const { auto u = std::shared_ptr<Utility>(new Utility(NoRegister{})); u->clean = clean;"; :1334 "return Struct::clone(data_);"; :1344 "return Struct::clone(match_);"; :721 "Value entopts = Value::undef();" (public); :656-657 "Value options = Value::undef();" "UtilityPtr utility;" (public).
- **old page**: B/cpp/README.md:217-218 "Deep copy of current SDK options." / "Copy of the SDK utility object." Consistent.

### zig

- **answer** (read and certain): Client options: `options_map()` returns `h.clone`, a deep clone. Client utility: `get_utility()` returns `Utility.copy`, a new Utility with the same fetcher and a shallow copy of `custom`. Entity data: `asEntity().data(null)` returns a clone, but the struct FIELD `entity.data` is also readable and holds the live value. Entity match: `asEntity().matchv(null)` returns a clone, and the field `entity.mtch` is live. Entity options: there is no getter method, but the public field `entity.entopts` gives the live value (zig has no private fields).
- **evidence**: src/cmp/zig/fragment/Main.fragment.zig:130-131 `pub fn options_map(self: *ProjectNameSDK) Value {` / `return h.clone(self.options);`; :134-135 `pub fn get_utility(self: *ProjectNameSDK) *Utility {` / `return Utility.copy(self.sdkUtility);`; tm/zig/core/utility.zig:71-78 `pub fn copy(src: *Utility) *Utility {` ... `u.* = .{ .fetcher = src.fetcher, .custom = custom };`; tm/zig/core/helpers.zig:72-73 `pub fn clone(v: Value) Value {` / `return vs.clone(A(), v) catch v;`; src/cmp/zig/fragment/Entity.fragment.zig:301 `return h.clone(self.data);`; :316 `return h.clone(self.mtch);`; :42-44 `entopts: Value,` `data: Value,` `mtch: Value,`
- **old page**: zig/README.md: "`options_map` | Deep copy of the current SDK options." and "`get_utility` | Copy of the SDK utility object." Consistent. The page lists `data` and `matchv` as entity methods, which is not literally true (see 13).

### rust

- **answer** (read and certain): Client options: `options_map()` returns a deep clone. Client utility: `get_utility()` returns `Utility::copy`, a new Utility whose fetcher is the same shared Rc and whose `custom` map is a shallow copy (a new map holding the same values), so it is a shallow copy, not the live object. Entity data: `data(None)` returns a deep clone. Entity match: `matchv(None)` returns a deep clone. Entity options: there is no getter. The `entopts` field is private and no method returns it.
- **evidence**: tm/../src/cmp/rust/fragment/Main.fragment.rs:95-97 `pub fn options_map(&self) -> Value {` / `vs::clone(&self.options.borrow())`; :99-100 `pub fn get_utility(&self) -> Rc<Utility> {` / `Utility::copy(&self.utility)`; tm/rust/core/utility_type.rs:31-41 `pub fn copy(src: &Utility) -> Rc<Utility> {` ... `fetcher: RefCell::new(src.fetcher.borrow().clone()),` `custom: RefCell::new(custom),`; src/cmp/rust/fragment/Entity.fragment.rs:285 `vs::clone(&self.data.borrow())`; :301 `vs::clone(&self.mtch.borrow())`; :23 `entopts: Value,` (no pub); tm/rust/core/types.rs:69-77 trait Entity has get_name, make, data, matchv, mark_deleted, deleted only
- **old page**: rust/README.md: "`options_map` | Deep copy of the current SDK options." and "`get_utility` | Copy of the SDK utility object." Consistent. The page says nothing about the data and match getters returning copies.

### clojure

- **answer** (read and certain): Clients: `options-map` returns a deep clone. `get-utility` returns a NEW atom holding the same map of functions, with only `:custom` cloned (a shallow copy). It exists only in `sdk.client`, not in the public `sdk.api`. Entities: `:data-get` and `:match-get` return clones. There is no entity-options getter: `:_entopts` is a raw field holding the live map. The entity's `:_utility` is the get-utility copy.
- **evidence**: tm/clojure/src/sdk/core.clj:202-203 `(defn client-options-map [client] (let [o (vs/clone (deref (:options client)))] ...`; core.clj:223-227 `(defn utility-copy [u] (let [m (deref u)] (atom (assoc m :custom ... (vs/clone c) ...` / `(defn get-utility [client] (utility-copy (:utility client)))`; tm/clojure/src/sdk/client.clj:69 `(defn get-utility [client] (core/get-utility client))`; src/cmp/clojure/Main_clojure.ts:85-90, which defines only make-sdk test-sdk direct graphql prepare options-map in sdk.api; fragment/Entity.fragment.clj:21 `(vs/clone (deref (:_data ent))))`; :30 `(vs/clone (deref (:_match ent))))`; :40 `ent {:_name "entityname" :_client client :_utility utility :_entopts entopts`
- **old page**: README.md:222-223 lists `options-map` as a "Deep copy" (right) and `get-utility` as a "Copy" (only shallow). REFERENCE.md:77 documents `(api/get-utility client)`, but sdk.api has no such var.

### ocaml

- **answer** (read and certain): Sdk_client has no options getter and no utility getter. The client's `cl_options` and `cl_utility` are mutable record fields that hold the live values. `Sdk_helpers.client_options_map client` is a public helper that returns a clone. Entities: `e_data_get ()` and `e_match_get ()` return clones. There is no entity-options getter; `e_entopts` is the live field. `e_utility` is the client's own utility record, shared and not copied (unlike clojure, which copies).
- **evidence**: tm/ocaml/sdk_types.ml:188-189 `mutable cl_options : value;` / `mutable cl_utility : utility;`; tm/ocaml/sdk_helpers.ml:120-121 `let client_options_map (client : sdk_client) : value = match clone client.cl_options with Map _ as m -> m | _ -> empty_map ()`; Entity_ocaml.ts:101 `ent.e_data_get <- (fun () -> utility.u_feature_hook entctx "GetData"; clone ent.e_data);`; :107 `... clone ent.e_match);`; :63 `let utility = client.cl_utility in`; :69 `e_utility = utility;`; :70 `e_entopts = entopts;`; Main_ocaml.ts:168-200 (sdk_client.ml defines make make0 test test_with direct graphql prepare, and no options/utility function)
- **old page**: README.md:203-215 lists no options or utility function, which is consistent.


## 3. The stream and a signal

### ts

- **answer** (read and certain): Yes. stream(action, args, callopts) copies callopts.signal into ctrl.signal. It is an AbortSignal (Control types it that way). It is checked before each item is yielded, and the generator returns quietly once it has aborted. It also travels in ctrl to makeFetchDef, so fetch aborts the request in flight. An error thrown while the signal is aborted is swallowed, so the stream ends without throwing.
- **evidence**: src/cmp/ts/fragment/EntityBase.fragment.ts:121-124 "if (null != callopts.signal) {" / "ctrl.signal = callopts.signal" / "const signal = ctrl.signal"; :151 "if (signal && signal.aborted) { return }"; :177-179 "// An abort ends the stream quietly, whenever it lands." / "if (e && true !== signal?.aborted) { throw e }"; tm/ts/src/Control.ts:10 "signal?: AbortSignal"; tm/ts/src/utility/MakeFetchDefUtility.ts:37-38 "if (null != ctx.ctrl?.signal) {" / "fetchdef.signal = ctx.ctrl.signal"
- **old page**: The old REFERENCE says "`stream()` takes the signal as `callopts.signal`, and ends when it aborts." That is consistent with the code.

### js

- **answer** (read and certain): Same as ts: callopts.signal (an AbortSignal) is copied to ctrl.signal. Each yield is checked and the stream returns quietly on abort. The fetch is aborted, and the resulting error is swallowed when the signal has aborted.
- **evidence**: src/cmp/js/fragment/EntityBase.fragment.js:117-120 "if (null != callopts.signal) {" / "ctrl.signal = callopts.signal" / "const signal = ctrl.signal"; :147 and :156 "if (signal && signal.aborted) { return }"; :175 "if (e && true !== signal?.aborted) { throw e }"; :105 comment "`signal` (AbortSignal) are honoured: an abort cancels the request and ends the iteration."

### go

- **answer** (read and certain): Yes. `Stream` reads `callopts["signal"]`, accepted as a channel (`<-chan struct{}` or `chan struct{}`; anything else is ignored). When it is closed or receives, the next send fails, the goroutine returns and the item channel is closed: the caller just sees the channel end, with no error item. The signal is checked only when handing over an item; it does not abort the HTTP request already running in the pipeline steps.
- **evidence**: ts/project/.sdk/src/cmp/go/fragment/Entity.fragment.go:151 "var signal <-chan struct{}"; :152 "switch s := callopts[\"signal\"].(type) {"; :153 "case <-chan struct{}:"; :155 "case chan struct{}:"; :187-193 "send := func(item core.StreamItem) bool {" / "case <-signal:" / "return false"; :218 "defer close(out)"; :240-241 "if !send(core.StreamItem{Item: item}) {" / "return"
- **old page**: go/REFERENCE.md Stream section mentions only callopts["ctrl"] and throw:false; nothing about a signal.

### c

- **answer** (read and certain): No signal. `<entity>_stream` reads only `ctrl` and `body` from callopts (callopts is also copied into ctrl as `stream`); there is no signal or cancellation key.
- **evidence**: Entity.fragment.c:147-148 "voxgig_value* entyvar_stream(Entity* e, const char* action, voxgig_value* args," / "voxgig_value* callopts, PNError** err) {"; :156 "voxgig_value* given = to_map(getp(stream_opts, \"ctrl\"));"; :163 "setp(ctrl, \"stream\", v_share(stream_opts));"; :178 "voxgig_value* body = getp(stream_opts, \"body\");"; no other getp on stream_opts
- **old page**: Nothing found.

### py

- **answer** (read and certain): Yes. `stream` reads `callopts["signal"]`. It accepts either a callable, whose truthy return means aborted, or any object with an `aborted` attribute, such as an event-like flag. The signal is checked only before each item is handed over. When it fires, the generator returns and iteration simply ends: no exception is raised and no error code is given. It does not interrupt a request already in flight.
- **evidence**: src/cmp/py/fragment/Entity.fragment.py:88 "signal = callopts.get(\"signal\")"; :113-118 "def aborted(): ... if callable(signal): return bool(signal()) / return bool(getattr(signal, \"aborted\", False))"; :134-136 "if aborted(): return / yield item"; :148-150 same
- **old page**: Not documented on the old py pages: stream does not appear in README or REFERENCE.

### rb

- **answer** (read and certain): Yes. `stream` reads `callopts["signal"]`, a value that responds to `call`, such as a lambda or Proc, or that responds to `aborted`. It is checked before each item. When it fires, the code throws `:stream_stop`, which the Enumerator catches, so enumeration ends quietly with no exception. It does not interrupt a request in flight.
- **evidence**: src/cmp/rb/fragment/Entity.fragment.rb:107 "signal = callopts[\"signal\"]"; :130-135 "aborted = lambda do ... return !!signal.call if signal.respond_to?(:call) / return !!signal.aborted if signal.respond_to?(:aborted)"; :148 "catch(:stream_stop) do"; :159 "throw :stream_stop if aborted.call"
- **old page**: Not documented on the old rb pages.

### php

- **answer** (read and certain): Yes. stream reads callopts['signal']. It may be a callable that returns true to abort, or an object with an `aborted` property. It is checked before each yield, and when it is set the generator returns and ends quietly, with no error.
- **evidence**: fragment/Entity.fragment.php:152 "$signal = $callopts['signal'] ?? null;"; :183-187 "if (is_callable($signal)) { return (bool)$signal(); } if (is_object($signal) && isset($signal->aborted)) { return (bool)$signal->aborted;"; :206-208 "if ($aborted()) { return; }"

### perl

- **answer** (read and certain): Yes. stream reads callopts->{signal}, and only a coderef counts: when it returns true, the iterator returns undef, which is the same as exhaustion. An object with an aborted flag is ignored, which PHP does accept. The signal is checked on each pull.
- **evidence**: fragment/Entity.fragment.pm:148 "#   - signal: an optional coderef; when it returns true the iterator stops."; :153 "my $signal = ProjectNameHelpers::gp($callopts, 'signal');"; :190-192 "my $aborted = sub { return (ref $signal eq 'CODE' && $signal->()) ? 1 : 0; };"; :236 "return undef if $aborted->();"

### lua

- **answer** (read and certain): Yes. stream reads callopts["signal"]. The signal can be a function (it aborts when the call returns a truthy value) or a table with an `aborted` field. It is checked before each item is yielded. When it fires, the coroutine returns and iteration ends quietly, with no error. The request has already been made by then.
- **evidence**: S/src/cmp/lua/fragment/Entity.fragment.lua:133: "local signal = callopts[\"signal\"]"; :166-177: "local function aborted()" ... "if type(signal) == \"function\" then" / "return signal() and true or false" ... "if type(signal) == \"table\" and signal.aborted ~= nil then"; :193-195 and :219-221: "if aborted() then" / "return"; :230-231: "if coroutine.status(co) == \"dead\" then" / "return nil"
- **old page**: Not documented.

### elixir

- **answer** (read and certain): Yes. stream reads callopts "signal", which must be a 0-arity function. It counts as fired only when it returns exactly true. The Stream is wrapped in Stream.take_while, so the signal is checked before each item, and when it returns true the stream stops quietly. It cannot stop the request, because the pipeline already ran inside stream/4.
- **evidence**: S/tm/elixir/lib/projectname/entity_base.ex:117: "#   - signal: an optional 0-arity fn; when it returns true iteration stops."; :153: "signal = S.getprop(callopts, \"signal\")"; :172: "|> Stream.take_while(fn _ -> not (S.isfunc(signal) and signal.() == true) end)"
- **old page**: Not documented.

### java

- **answer** (read and certain): Yes: stream(action, args, callopts) reads callopts.get("signal") and uses it only if it is a java.util.function.BooleanSupplier (true = aborted); anything else is ignored. It is checked in the iterator's hasNext before each item; when it returns true the stream simply ends (hasNext false), no error. It does not abort the request already made.
- **evidence**: src/cmp/java/fragment/EntityBase.fragment.java:214-216 "Object signalObj = callopts.get(\"signal\");" "signalObj instanceof BooleanSupplier ? (BooleanSupplier) signalObj : null;"; :285-286 "if (ended || (signal != null && signal.getAsBoolean())) {" "return false;"
- **old page**: Old README/REFERENCE do not mention stream at all.

### kotlin

- **answer** (read and certain): Yes: callopts["signal"] is used only if it is a Kotlin Function0 (a () -> Boolean); the stream checks it before each item and stops (sequence ends) when it returns true. Differs from java in the type: Function0 vs BooleanSupplier.
- **evidence**: src/cmp/kotlin/fragment/EntityBase.fragment.kt:217 "val signal = opts[\"signal\"]"; :263-265 "val aborted: () -> Boolean = when (signal) {" "is Function0<*> -> {" "{ (signal as Function0<Any?>).invoke() == true }"; :278 "if (source.hasNext() && !aborted()) source.next() else end"; :283-284 "if (item === end) {" "break"
- **old page**: Not mentioned.

### scala

- **answer** (read and certain): Yes. `stream` reads `callopts.get("signal")`. It must be a Scala `Function0` (`() => Boolean`); any other type is ignored and treated as never aborted. The check runs in `hasNext` before each pull. When the function returns TRUE, `hasNext` returns false and the iteration ends quietly, with no exception (only `next()` called after that throws NoSuchElementException). The request has already finished by then.
- **evidence**: src/cmp/scala/fragment/EntityBase.fragment.scala:159-161 `callopts["signal"] (a` / `() => Boolean that returns true when aborted) is honoured between` / `yields.`; :166 `val signal = opts.get("signal")`; :210-212 `val aborted: () => Boolean = signal match {` `case f: Function0[_] => () => f.asInstanceOf[Function0[Object]].apply() == java.lang.Boolean.TRUE` `case _ => () => false`; :224 `if (ended || aborted()) false`; :231 `if (!hasNext) throw new NoSuchElementException()`
- **old page**: Not documented; neither page mentions stream.

### csharp

- **answer** (read and certain): Yes. `Stream` reads `callopts["signal"]` as a `System.Threading.CancellationToken`; any other type becomes CancellationToken.None. It also takes a second token through `[EnumeratorCancellation] CancellationToken cancel`, which `WithCancellation` passes. Both are checked only between yields. When either fires, the iterator does `yield break`: the stream ends quietly, without an OperationCanceledException. The request itself is not cancelled. With the streaming feature active, the next item is pulled before the check and then dropped.
- **evidence**: src/cmp/csharp/fragment/EntityBase.fragment.cs:255-256 `callopts["signal"] (a` / `CancellationToken) is honoured between yields.`; :261 `[EnumeratorCancellation] CancellationToken cancel = default)`; :265-270 `// Read between yields only: the request itself is not cancelled,` ... `StructUtils.GetProp(callopts, "signal") is CancellationToken sigTok`; :333-344 `source ??= stream().GetEnumerator();` `more = source.MoveNext();` ... `if (!more || cancel.IsCancellationRequested || signal.IsCancellationRequested)` `yield break;`; :370-372 same check in the materialised path
- **old page**: Not documented.

### swift

- **answer** (read and inferred): Yes. stream reads callopts["signal"] as a native `@Sendable () -> Bool` function that returns true once the caller has aborted. When it returns true, the yield loop breaks and the stream finishes early, with no error. The loop runs inside the AsyncStream build closure, and Swift calls that closure while the AsyncStream is being created. So the signal is consulted while stream() itself is executing, not while the caller iterates. A signal that fires after stream() has returned has no effect (inferred from AsyncStream semantics).
- **evidence**: src/cmp/swift/fragment/EntityBase.fragment.swift:193 "let signal = opts.entries[\"signal\"]?.asNative as? @Sendable () -> Bool"; :185-187 comment "callopts[\"signal\"] (a native () -> Bool that returns true when aborted) is honoured between yields"; :236-241 "return AsyncStream { continuation in for item in items { if let s = signal, s() { break } continuation.yield(item) } continuation.finish() }".
- **old page**: The old README and REFERENCE do not mention stream or signal.

### cpp

- **answer** (read and certain): No. stream reads only `ctrl` and `body` from callopts and copies callopts into ctrl.stream. It reads no signal, and the runtime has no signal type.
- **evidence**: tm/cpp/core/types.hpp:1395 "Value streamOpts = callopts.is_map() ? callopts : vmap();"; :1399 "Value given = Helpers::toMapAny(getp(streamOpts, \"ctrl\"));"; :1405 "map_put(ctrl, \"stream\", streamOpts);"; :1417 "Value body = getp(streamOpts, \"body\");". A search for signal, cancel, abort and stop_token in tm/cpp/core and utility/pipeline.hpp finds nothing.
- **old page**: Not mentioned.

### zig

- **answer** (read and certain): No. `stream` reads only `ctrl` and `body` from callopts, and puts callopts into `ctrl.stream`. No signal is read anywhere, so nothing can fire.
- **evidence**: src/cmp/zig/fragment/Entity.fragment.zig:188 `const given = h.to_map(h.getp(stream_opts, "ctrl"));`; :193 `h.setp(ctrl, "stream", stream_opts);`; :210 `const body = h.getp(stream_opts, "body");`; src/cmp/zig/Syntax_zig.ts:55 `cancel: false,`; a grep for signal|cancel|abort over tm/zig/core and tm/zig/feature/streaming.zig found nothing relevant
- **old page**: Not mentioned.

### rust

- **answer** (read and certain): No. `stream` reads only `ctrl` and `body` from callopts. The whole callopts map is also copied into `ctrl.stream`, but nothing reads a signal from it. Neither the runtime nor the streaming feature has a signal, abort or cancel concept.
- **evidence**: src/cmp/rust/fragment/Entity.fragment.rs:148 `if let Value::Map(m) = to_map(&getp(&stream_opts, "ctrl")) {`; :153 `setp(&ctrl, "stream", stream_opts.clone());`; :176 `let body = getp(&stream_opts, "body");`; src/cmp/rust/Syntax_rust.ts:59 `cancel: false,`; a grep for signal|cancel|abort over tm/rust/core, tm/rust/utility and tm/rust/feature/streaming.rs found no such handling
- **old page**: Not mentioned.

### clojure

- **answer** (read and certain): Yes. `stream` reads `"signal"` from callopts. It is a 0-arg function, not an abort object. The lazy sequence calls it before each element is yielded. When it returns truthy, the sequence simply ends: no error and no exception, and the request has already completed by then.
- **evidence**: fragment/Entity.fragment.clj:144 `;;   - signal: an optional 0-arg fn; when it returns true iteration stops.`; :166-167 `signal (vs/getprop callopts "signal")` / `signalled? (fn [] (and (fn? signal) (boolean (signal))))`; :185-187 `(lazy-seq (when (and (seq xs) (not (signalled?))) (cons (first xs) (lz (rest xs)))))`
- **old page**: The old pages do not mention stream or signal.

### ocaml

- **answer** (read and certain): Yes. `e_stream` reads `signal` from callopts. It must be a struct `Func` value (for example `vfunc0 (fun () -> Bool true)`). It is called before each Seq node is produced, and when it returns `Bool true` the Seq ends with `Seq.Nil`. There is no error.
- **evidence**: Entity_ocaml.ts:117 `* and signal (a 0-arity fn -> Bool; iteration stops when it returns true). *)`; :142-143 `let signal = getp callopts "signal" in let aborted () = match signal with Func _ -> call_json signal = Bool true | _ -> false in`; :151-153 `| x :: rest -> if aborted () then Seq.Nil else Seq.Cons (x, seq_of rest) in`
- **old page**: Not mentioned.


## 4. Cancelling an operation

### ts

- **answer** (read and certain): Yes. Pass an AbortSignal as ctrl.signal: load(match, { signal }), list(match, { signal }), or direct({ ..., ctrl: { signal } }). makeFetchDef hands the signal to fetch. A signal that has already aborted throws before sending, so nothing is sent. Any failure after the abort becomes a ProjectNameError with code 'request_aborted', message 'request aborted' and a non-enumerable cause holding signal.reason. An operation then throws (makeError prefixes the message: 'DemoSDK: load: request aborted'). With ctrl.throw === false it returns undefined instead. direct does not throw: it returns { ok: false, err } where err.code is 'request_aborted'.
- **evidence**: tm/ts/src/utility/MakeRequestUtility.ts:35-36 "if (true === fetchdef.signal?.aborted) {" / "throw fetchdef.signal.reason"; :77-85 "function abortError(ctx: Context, err: any): any {" ... "const abort = ctx.error('request_aborted', 'request aborted')" ... "Object.defineProperty(abort, 'cause', { value: signal.reason, ..."; tm/ts/src/utility/MakeErrorUtility.ts:34 "setMessage(err, 'ProjectNameSDK: ' + op.name + ': ' + errmsg)" and :72-76 "if (false === ctx.ctrl.throw) {" ... "throw err"; src/cmp/ts/fragment/Main.fragment.ts:220-221 "if (true === fetchdef.signal?.aborted) {" / "throw fetchdef.signal.reason" and :278-279 "return { ok: false, err: utility.clean(ctx, abortError(ctx, err)) }"; tm/ts/src/Control.ts:9 "// Cancels the request in flight, which ts and js alone do so far."
- **old page**: The old REFERENCE section 'Cancelling a call' and the fetchargs.ctrl.signal row agree with the code.

### js

- **answer** (read and certain): Same as ts: ctrl.signal (an AbortSignal) cancels load, list and direct. An operation rejects with an error whose code is 'request_aborted' and whose cause is the signal's reason. direct returns { ok: false, err } with that error. A pre-aborted signal sends nothing.
- **evidence**: tm/js/src/utility/MakeRequestUtility.js (no differences from the ts file except types: diff -w shows only import and signature lines) abortError 'request_aborted'; src/cmp/js/fragment/Main.fragment.js:276 "return { ok: false, err: utility.clean(ctx, abortError(ctx, err)) }"

### go

- **answer** (read and certain): No. Load/List/Direct take no context.Context and no cancel signal; ctrl has no cancellation key (Control holds Throw, Err, Explain, Actor, Paging); the default transport builds the request with http.NewRequest (no context). Not found anywhere in core/utility.
- **evidence**: ts/project/.sdk/tm/go/core/control.go:3-9 "type Control struct { Throw *bool; Err error; Explain map[string]any; Actor string; Paging map[string]any }"; ts/project/.sdk/tm/go/utility/fetcher.go:115 "req, err := http.NewRequest(method, fullurl, bodyReader)"; EntityLoadOp.fragment.go:13 "func (e *EntyClass) Load(reqmatch map[string]any, ctrl map[string]any) (any, error) {"; grep for context/signal/cancel in tm/go/utility, tm/go/core: no matches except the stream
- **old page**: Nothing stated.

### c

- **answer** (read and certain): No. load/list/direct take (reqmatch/fetchargs, ctrl, PNError**); Control has no cancel field, and the built-in HTTP transport has only a fixed 30 s deadline (HTTP_TIMEOUT_MS), not caller cancellation.
- **evidence**: ts/project/.sdk/tm/c/core/sdk.h:152-159 "typedef struct Control { bool has_throw; bool throw_v; PNError* err; voxgig_value* explain; char* actor; voxgig_value* paging; } Control;"; tm/c/utility/http.c:24 "#define HTTP_TIMEOUT_MS 30000"; :1232 "c.deadline = monotonic_ms() + HTTP_TIMEOUT_MS;"
- **old page**: C README: "gives up on an exchange 30 seconds after it starts to connect" - consistent; no cancellation claimed.

### py

- **answer** (read and certain): No. A caller cannot cancel `load`, `list` or `direct` once it has started. The control object has no signal, token or context: ctrl carries only throw_err/throw, explain, actor and paging. The only time limit is the `timeout` feature, which is set in the client options, not per call, and passes a `timeout` to the HTTP request. A request that times out comes back as a transport error string (see Q9 d).
- **evidence**: tm/py/pkg/core/control.py:10-15 "self.throw_err = ... self.explain = ... self.actor = ... self.paging = ..."; tm/py/pkg/core/context.py:49-58 (reads throw_err, throw, explain, actor, paging only); tm/py/pkg/utility/fetcher.py:97-99 "timeout = fetchdef.get(\"timeout\") ... kwargs[\"timeout\"] = timeout"; grep of tm/py/pkg for signal/cancel/abort finds no caller-facing cancellation
- **old page**: Nothing said.

### rb

- **answer** (read and certain): No. `load`, `list` and `direct` have no caller cancellation: the Control class carries only throw_err, err, explain, actor and paging. A timeout is possible only through the timeout feature in the client options.
- **evidence**: tm/rb/core/control.rb:4 "attr_accessor :throw_err, :err, :explain, :actor, :paging"; grep of tm/rb for signal/cancel/abort finds no cancellation outside Entity.stream
- **old page**: Nothing said.

### php

- **answer** (read and inferred): No. ctrl for load, list and direct carries throw, explain, actor and paging, and nothing that cancels. The transport is synchronous (cURL or file_get_contents). The timeout feature says outright that an in-flight request cannot be aborted.
- **evidence**: tm/php/core/Context.php:52-63 (only throw/explain/actor/paging read from ctrl); tm/php/feature/TimeoutFeature.php:9-11 "PHP transports are synchronous, so an in-flight request cannot be raced/aborted the way the TS implementation cancels a fetch via AbortController."

### perl

- **answer** (read and inferred): No. ctrl carries throw, explain, actor and paging only. Transport is a blocking HTTP::Tiny request, and the runtime has no signal, token or context.
- **evidence**: tm/perl/core/context.pm:45-49 (only throw/explain/actor/paging read from ctrl); tm/perl/utility/fetcher.pm:154 "my $res = eval { _http_client(%new_args)->request($method, $fullurl, $opts) };"; grep for signal/cancel/abort in tm/perl/utility and core: none

### lua

- **answer** (read and certain): No. ctrl has no signal, token or context, and direct has none either. Transports are synchronous. The timeout feature only discards a late result after the call finishes.
- **evidence**: S/tm/lua/core/control.lua:10-15: only "throw_err", "err", "explain", "actor", "paging"; S/tm/lua/core/context.lua:47-61 copies only throw_err/throw, explain, actor, paging from ctrl; grep -i 'signal|cancel|abort' over tm/lua/core, tm/lua/utility, tm/lua/feature/*.lua finds no cancellation; S/tm/lua/feature/timeout_feature.lua:3-4: "-- Per-request timeout. Lua transports are synchronous, so an in-flight" / "-- request cannot be raced or aborted the way the async targets do it."
- **old page**: Not stated.

### elixir

- **answer** (read and certain): No. The control node holds only throw_err, err, explain, actor and paging. No cancellation path exists for ops or direct. The timeout feature only adds a `timeout` key to fetchdef and turns a late response into a timeout error.
- **evidence**: S/tm/elixir/lib/projectname/core.ex:15-20: "\"throw_err\", ...", "\"err\", nil,", "\"explain\", ...", "\"actor\", ...", "\"paging\", ..."; grep -i 'signal|cancel|abort' over tm/elixir/lib/projectname finds only the stream signal; S/tm/elixir/lib/projectname/feature/timeout.ex:40-41: "# Annotate the fetch definition so a real transport can cancel itself" / "# (Python-idiomatic analog of an abort signal)."
- **old page**: Not stated.

### java

- **answer** (read and certain): No cancellation API: Control has no signal/token field and ctrl is read only for throw, explain, actor, paging. load/list/direct run synchronously on the caller's thread. (Inferred only: interrupting the thread during HttpClient.send would surface as RuntimeException "fetch: ...", i.e. a thrown error from load/list and ok:false+err from direct; not a designed feature.)
- **evidence**: tm/java/core/Control.java:8-22 fields "public Boolean throwing;" "public Map<String, Object> explain;" "public String actor = \"\";" "public Map<String, Object> paging;" "public Object streamOut;"; tm/java/utility/Fetcher.java:144-147 "resp = clientFor(fetchdef).send(reqb.build(), decodedText());" "catch (Exception e) {" "throw new RuntimeException(\"fetch: \" + e.getMessage(), e);"
- **old page**: Nothing.

### kotlin

- **answer** (read and certain): No cancellation API, same as java (no signal in Control/ctrl; synchronous). Thread interruption would surface as RuntimeException "fetch: ..." (inferred).
- **evidence**: tm/kotlin/core/Control.kt:11 "var explain: MutableMap<String, Any?>? = null" (grep for signal/cancel in Context.kt/Control.kt finds nothing); tm/kotlin/utility/Fetcher.kt:125-126 "} catch (e: Exception) {" "throw RuntimeException(\"fetch: \" + e.message, e)"
- **old page**: Nothing.

### scala

- **answer** (read and inferred): No. Control has no signal, token or context field, and the context parser reads only throw, explain, actor and paging from ctrl. The default transport calls the blocking `HttpClient.send` with nothing that can cancel it. load, list and direct cannot be cancelled once started. (Only the per-call `timeout` feature can bound a request.)
- **evidence**: tm/scala/core/Control.scala:9-22 fields `throwing`, `err`, `explain`, `actor`, `paging`, `streamOut` only; tm/scala/core/Context.scala:47-50 `m.get("throw") ...` `m.get("explain") ...` `m.get("actor") ...` `m.get("paging") ...`; tm/scala/utility/Fetcher.scala:105 `try clientFor(fetchdef).send(reqb.build(), decodedText())`; a search of tm/scala and src/cmp/scala for signal/cancel/abort finds only the stream signal and the feature-internal InterruptedException handlers
- **old page**: Not stated.

### csharp

- **answer** (read and certain): No. Load, List and Direct take no CancellationToken. Control has no token field, and the context parses only throw, explain, actor and paging. The default transport makes a synchronous `HttpClient.Send(req, ...)` with no token. An operation cannot be cancelled once started.
- **evidence**: src/cmp/csharp/fragment/EntityBase.fragment.cs:101-102 `public virtual object? Load(Dictionary<string, object?>? reqmatch,` `Dictionary<string, object?>? ctrl = null)`; tm/csharp/core/Control.cs:7-16 fields Throw, Err, Explain, Actor, Paging, Stream_out; tm/csharp/core/Context.cs:62-77 throw/explain/actor/paging only; tm/csharp/utility/Fetcher.cs:162 `using var resp = ClientFor(fetchdef).Send(req, HttpCompletionOption.ResponseContentRead);`
- **old page**: Not stated.

### swift

- **answer** (read and certain): No. load, list and direct take no signal, token or context. Control holds only throwErr, err, explain, actor, paging and streamOut, and the context reads only throw, explain, actor and paging from a ctrl map. The default transport blocks on a semaphore with no cancel path.
- **evidence**: tm/swift/Sources/ProjectNameSDK/core/Control.swift:7-17 (fields throwErr, err, explain, actor, paging, streamOut); core/Context.swift:55-58 "if let t = cm.entries[\"throw\"]?.asBool ... explain ... actor ... paging"; utility/Fetcher.swift:168-169 "task.resume()" "sem.wait()". A search for signal, cancel and abort in core/ and utility/ finds only the semaphore signal at Fetcher.swift:166.
- **old page**: The old page says nothing about cancelling.

### cpp

- **answer** (read and certain): No. Control has throwing, err, explain, actor and paging, and nothing else. No operation, list or direct takes a token, and there is no cancellation path anywhere in core or the pipeline.
- **evidence**: tm/cpp/core/types.hpp:151-158 "class Control { ... Value throwing ... SdkErrorPtr err; Value explain ... std::string actor ... Value paging"; :788-795 (the ctrl map reads throw, explain, actor and paging only).
- **old page**: Not mentioned.

### zig

- **answer** (read and certain): No. The Control struct and the context ctrl parsing cover throw, explain, actor and paging only, and the runtime is synchronous. There is no cancellation.
- **evidence**: tm/zig/core/control.zig:7-15 `pub const Control = struct { throw: ?bool = null, err: ... explain: Value ..., actor: []const u8 = "", paging: Value ...`; tm/zig/core/context.zig:96-99 `if (h.get_bool(cm, "throw")) |t| c.throw = t;` `if (h.getp(cm, "explain") == .object) ...` `if (h.get_str(cm, "actor")) ...` `if (h.getp(cm, "paging") == .object) ...`; src/cmp/zig/Syntax_zig.ts:55 `cancel: false,`
- **old page**: Not mentioned.

### rust

- **answer** (read and certain): No. The runtime is synchronous, and Control holds only throw, err, explain, actor and paging. The context reads only throw, explain, actor and paging from ctrl. There is no signal, token or context to cancel load, list or direct once started.
- **evidence**: tm/rust/core/control.rs:5-13 `pub struct Control { pub throw: Option<bool>, pub err: Option<ProjectNameError>, ... pub explain: Value, pub actor: String, pub paging: Value, }`; tm/rust/core/context.rs:88-99 (reads "throw", "explain", "actor", "paging" only); src/cmp/rust/Syntax_rust.ts:8 `async: false,` and :59 `cancel: false,`
- **old page**: Not mentioned.

### clojure

- **answer** (read and inferred): No cancellation option exists. The control record holds throw/err/explain/actor/paging only, and nothing reads a signal from ctrl. The default transport blocks in `HttpClient.send`. If the caller's thread is interrupted, the catch turns the interruption into an SDK error with code `fetch_transport`; an op then raises it (ex-info), and `direct` returns it as `{ok false, err}`. That is thread interruption, not an API.
- **evidence**: core.clj:325 `(defn make-control [] (atom {:throw nil :err nil :explain nil :actor nil :paging nil}))`; core.clj:1873 `resp (.send ^HttpClient client (.build builder) (HttpResponse$BodyHandlers/ofByteArray))`; core.clj:1886-1889 `(catch Throwable e (when (instance? InterruptedException e) (.interrupt (Thread/currentThread))) [nil (make-error-obj "fetch_transport" ...`
- **old page**: The old pages say nothing about cancellation.

### ocaml

- **answer** (read and certain): No. The control record carries only throw, err, explain, actor and paging, and nothing in the runtime reads a signal from ctrl. A started load, list or direct cannot be cancelled by the caller.
- **evidence**: tm/ocaml/sdk_types.ml:43-49 `and control = { mutable ctrl_throw : bool option; mutable ctrl_err : sdk_error option; mutable ctrl_explain : value; mutable ctrl_actor : value; mutable ctrl_paging : value; }`; tm/ocaml/sdk_runtime.ml:204-209 (ctrl parse reads throw_err/throw/explain/actor/paging only); grep for signal/cancel/abort in sdk_runtime.ml and sdk_features.ml finds only comments
- **old page**: Not mentioned.


## 5. When the stream's operation runs

### ts

- **answer** (read and certain): When the caller first asks for an item. stream is an async generator (async *), so calling it runs nothing. On the first next() or for-await step the body runs in order: it builds ctrl and ctx, then awaits _streamSteps(ctx) (point, spec, request, response, result), then yields. There is no thread: everything runs on the caller's event loop.
- **evidence**: src/cmp/ts/fragment/EntityBase.fragment.ts:111 "async *stream(this: any, action: string, args?: any, callopts?: any): AsyncGenerator<any> {"; :126 "const ctx: Context = makeContext({"; :142 "const failed = await this._streamSteps(ctx)"; :150-152 "for await (const item of result.stream()) {" ... "yield item"; :157-161 "const data = null == failed ? done(ctx) : error(ctx, failed)" ... "yield item"

### js

- **answer** (read and certain): Same as ts: async generator. The operation runs on the first iteration step, not at the call.
- **evidence**: src/cmp/js/fragment/EntityBase.fragment.js:107 "async *stream(action, args, callopts) {"; :138 "const failed = await this._streamSteps(ctx)"; :146 "for await (const item of result.stream()) {"

### go

- **answer** (read and certain): Beside the caller, in a goroutine started at the call. Stream makes an unbuffered channel, builds the context, starts `go func()` and returns the channel at once; the goroutine runs all pipeline steps (request included) immediately, whether or not anyone reads; each item hand-over blocks until the caller receives.
- **evidence**: Entity.fragment.go:145 "out := make(chan core.StreamItem)"; :177 "ctx := utility.MakeContext(ctxmap, e.entctx)"; :217 "go func() {"; :229 "if err := e.streamSteps(ctx); err != nil {"; :239 "for item := range ctx.Result.Stream() {"; :247 "sendData(utility.Done(ctx))"; :250 "return out"
- **old page**: REFERENCE: "Run an operation through the pipeline and send its result items on the returned channel, which closes when the stream ends" - consistent, silent on the goroutine.

### c

- **answer** (read and certain): At the call, synchronously, before it returns: the stream function runs every pipeline step and returns a whole List (or the streaming feature's producer output, also obtained before return); the caller then walks the list. No thread.
- **evidence**: Entity.fragment.c:139-140 "// whole result). This runtime is synchronous and C has no lazy iterators, so" / "// the returned value is a List cursor the caller walks (voxgig_as_list)."; :187-188 "feature_hook_util(ctx, \"PrePoint\");" / "voxgig_value* point = make_point_util(ctx, &pe);"; :198 "Response* resp = make_request_util(ctx, &pe);"; :217-220 "if (res && res->stream) {" ... "return res->stream(res->stream_ud);"; :223 "return entyvar_stream_items(done_util(ctx, err), err);"
- **old page**: Nothing on stream in the C README.

### py

- **answer** (read and certain): The operation runs when the caller first asks for an item. `stream` contains `yield`, so it is a generator function and nothing in its body runs at the call, not even building ctx. The order on the first `next()` is: ctx is built (line 103); `_stream_steps` runs the whole pipeline, including the HTTP request (line 123); then either the streaming feature's generator is iterated lazily (lines 133-136), or the materialised result is read once with `done` (line 139) and its items are yielded one by one (lines 147-150). No thread is involved.
- **evidence**: src/cmp/py/fragment/Entity.fragment.py:74 "def stream(self, action, args=None, callopts=None):"; :103 "ctx = utility.make_context(ctxmap, self._entctx)"; :123 "failed = self._stream_steps(ctx)"; :133 "for item in stream_fn():"; :139 "data = utility.done(ctx) if failed is None"; :150 "yield item"
- **old page**: Not documented.

### rb

- **answer** (read and certain): The work is split. At the call, lines 105-135 run eagerly: the context is built and the body is attached. Then `Enumerator.new` (line 140) is returned without running the pipeline. The pipeline (`_stream_steps`, line 149) runs when the caller first iterates (`each` or `next`), and the items follow from the feature's enumerator (line 158) or from the materialised `done` result (lines 164-169). This differs from py, where even the context is built lazily. Everything runs on the caller's thread.
- **evidence**: src/cmp/rb/fragment/Entity.fragment.rb:120 "ctx = utility.make_context.call(ctxmap, @_entctx)"; :140 "Enumerator.new do |yielder|"; :149 "failed = _stream_steps(ctx)"; :158 "stream_enum.each do |item|"; :164 "data = failed.nil? ? utility.done.call(ctx) : utility.make_error.call(ctx, failed)"
- **old page**: Not documented.

### php

- **answer** (read and certain): When the caller first asks for an item. stream is a PHP generator function (it returns \Generator and contains yield), so none of its body runs until the first iteration. That includes make_context and the pipeline in _stream_steps. An error from the pipeline is also raised on that first iteration, not at the call.
- **evidence**: fragment/Entity.fragment.php:148 "public function stream(string $action, ?array $args = null, ?array $callopts = null): \Generator"; :169 "$ctx = ($utility->make_context)($ctxmap, $this->_entctx);"; :195 "$failed = $this->_stream_steps($ctx);"; :209 "yield $item;"

### perl

- **answer** (read and certain): At the call, eagerly. stream builds the context, runs the whole pipeline through _run_op, and only then returns an iterator coderef. Pipeline errors therefore die from stream() itself. Only when the streaming feature supplies result->{stream} does each pull call the source incrementally. This differs from PHP, where nothing runs until the first item is asked for.
- **evidence**: fragment/Entity.fragment.pm:159 "my $ctx = $utility->{make_context}->({"; :177 "$self->_run_op($ctx, sub { return });"; :200-202 "if ($result && ref $result->{stream} eq 'CODE') { my $src = $result->{stream}; return sub {"; :235 "return sub {"

### lua

- **answer** (read and certain): When the caller first asks for an item. stream builds the context, wraps the pipeline in a coroutine that has not started, and returns an iterator. The first iterator call resumes the coroutine, which runs the pipeline steps and then yields items. Nothing runs alongside the caller: a coroutine is not a thread.
- **evidence**: S/src/cmp/lua/fragment/Entity.fragment.lua:155: "local ctx = utility.make_context(ctxmap, self._entctx)"; :179-180: "local co = coroutine.create(function()" / "local failed = self:_stream_steps(ctx)"; :229: "return function()"; :233: "local ok, item = coroutine.resume(co)"; :263-307 _stream_steps runs make_point..make_result
- **old page**: Not documented.

### elixir

- **answer** (read and certain): At the call. stream/4 runs Pipeline.run_op synchronously before it returns. With the streaming feature it also calls the feature's stream function then, and that function builds its items eagerly as a list. Only the take_while/map/guard wrapping is lazy. Nothing runs in another process.
- **evidence**: S/tm/elixir/lib/projectname/entity_base.ex:150: "Pipeline.run_op(ctx, fn -> nil end)"; :159-160: "if S.isfunc(stream_fn) do" / "source(ctx, stream_fn)"; :179-180: "defp source(ctx, stream_fn) do" / "stream_fn.()"; :171-174: "items" / "|> Stream.take_while(...)" / "|> Stream.map(&stream_unwrap/1)" / "|> guarded(ctx)"; S/tm/elixir/lib/projectname/feature/streaming.ex:47: "S.setprop(result, \"stream\", fn -> stream_items(f, result) end)", :58: "# Produce the streamed items eagerly as a plain Elixir list."
- **old page**: Not documented. Note the entity fragment comment (Entity.fragment.ex:22) says 'returns a lazy Stream over result items'. That is true of the returned Stream, but the request is not lazy.

### java

- **answer** (read and certain): At the call. stream() runs the whole pipeline (runOp) synchronously, and also obtains the streaming feature's iterator, before it returns the java.util.stream.Stream; only pulling items from that iterator is deferred to consumption. No thread.
- **evidence**: src/cmp/java/fragment/EntityBase.fragment.java:246 "Object materialised = runOp(ctx, () -> {});"; :251-253 "if (ctx.result != null && ctx.result.stream != null) {" "source = ctx.result.stream.get();"; :313-314 "return StreamSupport.stream(" "Spliterators.spliteratorUnknownSize(guarded, Spliterator.ORDERED), false);"; :288-292 (hasNext pulls src.next() lazily)
- **old page**: Not mentioned.

### kotlin

- **answer** (read and certain): At the call, as java: runOp and the streaming-source get() run before the lazy Sequence is returned; items are pulled from the source as the caller iterates. No coroutine/thread.
- **evidence**: src/cmp/kotlin/fragment/EntityBase.fragment.kt:243 "val materialised = runOp(ctx) {}"; :247-248 "val streamed: Iterator<Any?>? = try {" "ctx.result?.stream?.get()"; :275 "return sequence {"; :278 "if (source.hasNext() && !aborted()) source.next() else end"
- **old page**: Not mentioned.

### scala

- **answer** (read and certain): At the call. `stream` builds the context and runs `runOp` (the whole request) synchronously, then builds and returns the Iterator. Iterating only reads results that already exist, or the streaming feature's iterator if that feature is active. No thread is started.
- **evidence**: src/cmp/scala/fragment/EntityBase.fragment.scala:181 `val ctx = this.utility.makeContext(ctxmap, this.entctx)`; :192 `val materialised = runOp(ctx, () => {})`; :196-198 `val source: JIterator[Object] =` `if (ctx.result != null && ctx.result.stream != null) {` `try ctx.result.stream.get()`; :218 `new Iterator[Object] {`
- **old page**: Not stated.

### csharp

- **answer** (read and inferred): When the caller first asks for an item. `Stream` is an async iterator (`async IAsyncEnumerable` with `yield`), so nothing in its body runs at the call. The context build and `RunOp`, which is the request, run on the first `MoveNextAsync`, on the caller's thread (no Task.Run). The items are then yielded. This differs from Scala, which runs the request at the call.
- **evidence**: src/cmp/csharp/fragment/EntityBase.fragment.cs:257 `public async IAsyncEnumerable<object?> Stream(`; :294 `var ctx = utility.MakeContext(ctxmap, entctx);`; :306 `var materialised = RunOp(ctx, () =>`; :314 `await Task.CompletedTask;`; :346 `yield return item;`; :374 `yield return item;`
- **old page**: Not stated.

### swift

- **answer** (read and certain): At the call, synchronously, before stream returns. The order is: (1) the full pipeline runs via runOp; (2) the items are read in full, from the streaming feature's result.stream closure (which returns an array) or else from the materialised result; (3) an AsyncStream is built and every item is buffered into it during construction. The caller then iterates buffered values. No thread or Task is started.
- **evidence**: src/cmp/swift/fragment/EntityBase.fragment.swift:223 "let materialised = try runOp(ctx, {})"; :228-229 "if let result = ctx.result, let streamFn = result.stream { items = streamFn()"; :236 "return AsyncStream { continuation in"; tm/swift/Sources/ProjectNameSDK/core/Result.swift:19 "public var stream: (() -> [Value])? = nil".
- **old page**: Not mentioned.

### cpp

- **answer** (read and certain): At the call, synchronously. stream runs the pipeline stages inline (PrePoint through PreDone). If the streaming feature set result->stream, it calls that function and returns its vector. Otherwise it calls done() and returns the items as a std::vector<Value>. The whole result is materialised before stream returns, and no thread is used.
- **evidence**: tm/cpp/core/types.hpp:744-745 comment "This runtime is synchronous, so the returned vector is a materialised cursor the caller iterates."; :1424-1446 (inline makePoint ... makeResult, PreDone); :1451-1454 "if (res && res->stream) { ... return res->stream();"; :1457 "Value data = u->done(ctx);"; :749 "std::vector<Value> stream(const std::string& action,".
- **old page**: Not mentioned.

### zig

- **answer** (read and certain): At the call. `stream` runs the whole pipeline in order. It then calls the streaming producer `sf.call(sf.ctx)`, which returns a `[]Value` slice, or else runs `done`. It returns `StreamResult{ .ok = slice }`. Nothing is lazy, and there is no thread.
- **evidence**: src/cmp/zig/fragment/Entity.fragment.zig:224 `const point = utility.make_point(ctx) catch return streamItems(self.opError(ctx));`; :232 `const resp = utility.make_request(ctx) catch ...`; :240 `const result = utility.make_result(ctx) catch ...`; :247-251 `if (ctx.result) |res| { if (res.stream) |sf| { ... return .{ .ok = sf.call(sf.ctx) };`; :255 `return streamItems(self.doneResult(ctx));`; :171-173 comment `This runtime is synchronous and zig has no built-in lazy iterators, so the items are a materialised slice the caller walks`; tm/zig/core/result.zig:9-11 `pub const StreamFn = struct { ctx: *anyopaque, call: *const fn (ctx: *anyopaque) []Value, };`
- **old page**: zig/README.md: "`stream` ... Run an op through the pipeline: `.ok` with its result items, or `.err` with the error that failed it." Consistent.

### rust

- **answer** (read and certain): At the call, before `stream` returns. The whole pipeline runs synchronously inside `stream`: point, spec, request, response, result. Then, if the streaming feature attached a producer, `sf()` is called immediately. It materialises a Vec, applying any chunkDelay sleeps inside the call, and `stream` returns `Ok(vec.into_iter())`. Otherwise `done()` runs and the items are materialised. The caller only iterates finished values.
- **evidence**: src/cmp/rust/fragment/Entity.fragment.rs:190 `let point = match self.utility.make_point(&ctx) {`; :204 `let resp = match self.utility.make_request(&ctx) {`; :218 `let result = match self.utility.make_result(&ctx) {`; :230-234 `let streamfn = res.borrow().stream.clone();` `if let Some(sf) = streamfn {` ... `return Ok(sf().into_iter());`; :238 `self.utility.done(&ctx).map(stream_items)`; tm/rust/core/result.rs:9 `pub type StreamFn = Rc<dyn Fn() -> Vec<Value>>;`; tm/rust/feature/streaming.rs:71-78 (closure calls `iterate(&options, &resdata)`), :85-111 iterate sleeps `chunk_delay` while building `out`
- **old page**: Not described beyond the Syntax fact `runs: 'call'`.

### clojure

- **answer** (read and certain): At the call. `stream` runs the whole pipeline with `run-op`, then turns the result into a vector before it returns. That vector is built eagerly with mapv/vec, so a streaming feature's thunk is fully drained too. Only the signal check is lazy. Nothing runs beside the caller (the timeout feature's future is internal and is awaited).
- **evidence**: fragment/Entity.fragment.clj:164 `(run-op ctx (fn []))`; :177-180 `items (try (mapv unwrap (if (and result (fn? (core/oget result :stream))) (vec ((core/oget result :stream)))`; :185-188 `(letfn [(lz [xs] (lazy-seq ...))] (lz items))`. Note that the comment at :133 says it 'returns a LAZY SEQUENCE'.
- **old page**: Not described.

### ocaml

- **answer** (read and certain): At the call. `e_stream` runs `run_op` and then computes the whole item list before returning the Seq: it calls the feature's `rt_stream fn ()`, or reads resdata. The Seq only gates each element on the signal. There is no thread or domain.
- **evidence**: Entity_ocaml.ts:141 `ignore (run_op ctx (fun () -> ()));`; :145-150 `let raw = (try (match ctx.c_result with | Some result -> (match result.rt_stream with | Some fn -> fn () | None -> (match result.rt_resdata with List r -> !r ...`; :154 `seq_of raw);`
- **old page**: Not described.


## 6. After remove

### ts

- **answer** (read and certain): After a successful remove the op calls markDeleted(), which sets the field _deleted = true. The caller reads it through the method deleted(), which returns a boolean. The data is not cleared. Like load, remove first replaces _data with ctx.result.resdata when the response produced non-null data. Otherwise the instance keeps the data it held.
- **evidence**: src/cmp/ts/fragment/EntityRemoveOp.fragment.ts:91-92 "if (null != ctx.result.resdata) {" / "this._data = ctx.result.resdata"; :98-100 "if (ctx.result && ctx.result.ok) {" / "this.markDeleted()" / "return this"; EntityBase.fragment.ts:60-61 "markDeleted(this: any): void {" / "this._deleted = true"; :65-66 "deleted(this: any): boolean {" / "return true === this._deleted"
- **old page**: The old pages say 'return it marked as deleted' but name neither deleted() nor _deleted. The old Entity method tables omit deleted() (and stream).

### js

- **answer** (read and certain): Same as ts: the method deleted() reads the field _deleted. Data is replaced by the remove response's resdata if it is non-null, otherwise kept. A js comment states that the instance keeps its data.
- **evidence**: src/cmp/js/fragment/EntityRemoveOp.fragment.js:88-89 "if (null != ctx.result.resdata) {" / "this._data = ctx.result.resdata"; :103-104 "this.markDeleted()" / "return this"; EntityBase.fragment.js:25 "this._deleted = false"; :43-44 comment "the instance KEEPS the data it held — a caller can still read what was deleted"; :51-52 "deleted() {" / "return true === this._deleted"
- **old page**: The js comment's 'KEEPS the data it held' is not quite exact: a non-null resdata from the remove response replaces it.

### go

- **answer** (read and certain): Method `Deleted() bool` (field `deleted`, set by `MarkDeleted()`), set only when the result is ok. Data is not cleared, but it is REPLACED by a clone of the response data when the remove response carries data (resdata non-nil); kept only when the response has none.
- **evidence**: Entity.fragment.go:79-81 "func (e *EntyClass) MarkDeleted() {" / "e.deleted = true"; :85 "func (e *EntyClass) Deleted() bool {"; :372-374 "if ctx.Result != nil && ctx.Result.Ok && opname != \"list\" {" / "if opname == \"remove\" {" / "e.MarkDeleted()"; EntityRemoveOp.fragment.go:28-31 "if ctx.Result.Resdata != nil {" / "e.data = map[string]any{}" / "if data := core.ToMapAny(vs.Clone(ctx.Result.Resdata)); data != nil {" / "e.data = data"
- **old page**: "Remove an entity, and return it marked as deleted." - no name for the mark given (Deleted() is not in the README's interface table).

### c

- **answer** (read and certain): The vtable function `deleted` (`e->vt->deleted(e)`, backed by the private field `deleted`, set at the end of a successful remove). Data is not cleared, but it is REPLACED by a clone of the response data when the remove response carries data; kept only when it carries none. The code's own comment ('keeps its data') is only true in that second case.
- **evidence**: Entity.fragment.c:282-283 "static bool entyvar_deleted(Entity* e) {" / "return ((entyvar_entity*)e)->deleted;"; EntityRemoveOp.fragment.c:9-11 "if (!v_is_noval(resdata) && !v_is_null(resdata)) {" / "voxgig_value* m = to_map(voxgig_clone(resdata));" / "self->data = voxgig_is_map(m) ? m : voxgig_new_map();"; :33-34 "// A removed entity keeps its data but is no longer a live record." / "self->deleted = true;"; tm/c/core/sdk.h comment "`remove` resolves to the entity, marked. The instance KEEPS the data it held"
- **old page**: "Remove an entity, which is returned marked as deleted." - names no accessor; the vtable table in README omits `deleted`/`mark_deleted`.

### py

- **answer** (read and certain): `remove` calls `self.mark_deleted()`, which sets the private `_deleted`. Callers read it with the method `deleted()`, which returns bool. The data is not cleared. But it is not simply kept: post_done REPLACES `_data` with the response's resdata whenever that is not None. It is kept only when the response carries no record. On a successful remove, `remove` returns the entity itself.
- **evidence**: src/cmp/py/fragment/Entity.fragment.py:43-47 "def mark_deleted(self): self._deleted = True / def deleted(self): return True is self._deleted"; :267-269 "if opname == \"remove\": self.mark_deleted() / return self"; src/cmp/py/fragment/EntityRemoveOp.fragment.py:27-28 "if ctx.result.resdata is not None: / self._data = helpers.to_map(vs.clone(ctx.result.resdata)) or {}"
- **old page**: py/README.md:230 'Remove an entity, and return it marked as deleted.' This is right. The code comment (Entity.fragment.py:41 'The instance KEEPS the data it held') overstates it, because a response record replaces the data.

### rb

- **answer** (read and certain): The same as py. `mark_deleted` sets `@_deleted`, and the method `deleted` (no `?`, called without parentheses) returns true. The data is replaced by the response's resdata when that is truthy (non-nil), and is otherwise kept.
- **evidence**: src/cmp/rb/fragment/Entity.fragment.rb:55-61 "def mark_deleted / @_deleted = true ... def deleted / true == @_deleted"; :289 "mark_deleted if opname == \"remove\""; src/cmp/rb/fragment/EntityRemoveOp.fragment.rb:25-26 "if ctx.result.resdata / @_data = ProjectNameHelpers.to_map(VoxgigStruct.clone(ctx.result.resdata)) || {}"
- **old page**: rb/README.md:230 'return it marked as deleted'. This is correct, and the page does not name `deleted`.

### php

- **answer** (read and certain): Through the method deleted(), which returns bool and is backed by the private field _deleted that markDeleted() sets. Whether the data is kept depends on the response: remove's post_done replaces _data with the response's resdata when resdata is truthy, and leaves the old data when the body is empty or falsy.
- **evidence**: fragment/Entity.fragment.php:80-83 "public function markDeleted(): void { $this->_deleted = true;"; :85 "public function deleted(): bool"; :399-400 "if ($opname === 'remove') { $this->markDeleted();"; fragment/EntityRemoveOp.fragment.php:69-70 "if ($ctx->result->resdata) { $this->_data = ProjectNameHelpers::to_map(Struct::clone($ctx->result->resdata)) ?? [];"
- **old page**: The old page says remove will "return it marked as deleted" and does not name deleted(). A comment in the code says the instance "KEEPS the data it held". That holds only when the remove response has no body.

### perl

- **answer** (read and certain): Through the method deleted, which returns 1 or 0 and is backed by the hash key _deleted that mark_deleted sets. Remove's post_done replaces _data with a clone of the response's resdata when that is truthy, and otherwise keeps the old data.
- **evidence**: fragment/Entity.fragment.pm:77-80 "sub mark_deleted { my ($self) = @_; $self->{_deleted} = 1;"; :84-86 "sub deleted { ... return $self->{_deleted} ? 1 : 0;"; :295 "$self->mark_deleted if defined $opname && $opname eq 'remove';"; fragment/EntityRemoveOp.fragment.pm:23-25 "if ($result->{resdata}) { $self->{_data} = ProjectNameHelpers::to_map(Voxgig::Struct::clone($result->{resdata})) || {};"
- **old page**: The old page says "return it marked as deleted" and does not name deleted.

### lua

- **answer** (read and certain): remove sets the field _deleted = true, which the method ent:deleted() reads. The entity keeps its data unless the response carries resdata: post_done then replaces _data with a clone of resdata, and resmatch replaces _match.
- **evidence**: S/src/cmp/lua/fragment/Entity.fragment.lua:82-84: "function EntyClass:mark_deleted()" / "self._deleted = true"; :87-88: "function EntyClass:deleted()" / "return true == self._deleted"; :434-435: "if opname == \"remove\" then" / "self:mark_deleted()"; S/src/cmp/lua/fragment/EntityRemoveOp.fragment.lua:24-28: "if ctx.result.resmatch ~= nil then" / "self._match = ctx.result.resmatch" ... "if ctx.result.resdata ~= nil then" / "self._data = helpers.to_map(vs.clone(ctx.result.resdata)) or {}"
- **old page**: README.md:224 and REFERENCE.md:365: 'return it marked as deleted'. The page never names how the mark is read.

### elixir

- **answer** (read and certain): remove sets the key "_deleted" to true on the entity node. The mark is read with ProjectName.EntityBase.deleted(ent). The per-entity module (Demo.Entity.Planet) does not delegate deleted/1, so Demo.Entity.Planet.deleted(ent) does not exist. Data is kept unless the response carries resdata, which then replaces _data (resmatch replaces _match).
- **evidence**: S/tm/elixir/lib/projectname/entity_base.ex:60-61: "def mark_deleted(ent) do" / "S.setprop(ent, \"_deleted\", true)"; :65: "def deleted(ent), do: S.getprop(ent, \"_deleted\") == true"; S/src/cmp/elixir/fragment/Entity.fragment.ex:14-24 delegate only get_name, make, data_set, data_get, match_set, match_get, stream (no deleted); S/src/cmp/elixir/fragment/EntityRemoveOp.fragment.ex:29-30: "rd = S.getprop(result, \"resdata\")" / "if rd != nil, do: S.setprop(ent, \"_data\", H.or_(H.to_map(S.clone(rd)), S.jm([])))"; :37: "if ent == out, do: out, else: EntityBase.mark_deleted(ent)"
- **old page**: README.md:256 and REFERENCE.md:357: 'return it marked as deleted'. Nothing says how to read the mark.

### java

- **answer** (read and certain): A private boolean flag read through the method deleted() on EntityBase (set by markDeleted() when a remove succeeds). deleted() is NOT on the SdkEntity/Entity interfaces, so code holding the SdkEntity the accessor returns must cast to EntityBase. Data: kept, unless the remove result carries resdata, in which case data is replaced by a clone of it (match likewise replaced by resmatch).
- **evidence**: src/cmp/java/fragment/EntityBase.fragment.java:41 "private boolean deleted = false;" :47 "public boolean deleted() {" :159-160 "if (\"remove\".equals(opname)) {" "this.markDeleted();"; src/cmp/java/fragment/EntityRemoveOp.fragment.java:36-38 "if (ctx.result.resdata != null) {" "Map<String, Object> d = Helpers.toMapAny(Struct.clone(ctx.result.resdata));" "this.data = d == null ? new LinkedHashMap<>() : d;"; tm/java/core/SdkEntity.java (no deleted method)
- **old page**: README: remove "return it marked as deleted" - never names deleted(), and the entity-interface table omits it.

### kotlin

- **answer** (read and certain): Same as java: fun deleted(): Boolean on EntityBase (not on SdkEntity), set on successful remove; data kept unless resdata is present, then replaced by its clone.
- **evidence**: src/cmp/kotlin/fragment/EntityBase.fragment.kt:107 "private var deletedFlag: Boolean = false" :113 "fun deleted(): Boolean = this.deletedFlag" :162-163 "if (\"remove\" == opname) {" "this.markDeleted()"; src/cmp/kotlin/fragment/EntityRemoveOp.fragment.kt:21-23 "if (result.resdata != null) {" "val d = Helpers.toMapAny(Struct.clone(result.resdata))" "this.data = d ?: linkedMapOf<String, Any?>()"
- **old page**: Same omission as java.

### scala

- **answer** (read and certain): A private flag `deletedFlag` is read through the method `deleted()`, which returns true after a successful remove. The data is not cleared: if the remove result carries resdata (a response body), `dataState` is replaced with a clone of it; otherwise the entity keeps the data it held. `deleted()` is declared on EntityBase, not on the `SdkEntity` trait the accessor returns, so a program must cast to the entity class or EntityBase to call it.
- **evidence**: src/cmp/scala/fragment/EntityBase.fragment.scala:68 `private var deletedFlag: Boolean = false`; :72 `def deleted(): Boolean = deletedFlag`; :121 `if ("remove" == opname) markDeleted()`; src/cmp/scala/fragment/EntityRemoveOp.fragment.scala:50-53 `if (ctx.result.resdata != null) {` `val d = Helpers.toMapAny(Struct.clone(ctx.result.resdata))` `this.dataState = if (d == null) new LinkedHashMap[String, Object]() else d`; tm/scala/core/Contracts.scala:16-27 (SdkEntity has no deleted())
- **old page**: README:231 and REFERENCE:338 say remove returns the entity 'marked as deleted' but name no marker. The README entity method table does not list deleted().

### csharp

- **answer** (read and certain): A private `_deleted` flag is read through the method `Deleted()`, which is declared on IEntity and on the entity base and returns true after a successful Remove. The data is not cleared: if the result carries Resdata, `data` is replaced with a clone of it; otherwise the old data is kept.
- **evidence**: src/cmp/csharp/fragment/EntityBase.fragment.cs:26 `private bool _deleted = false;`; :33-35 `public bool Deleted()` `return this._deleted;`; :237-239 `if ("remove" == opname)` `this.MarkDeleted();`; src/cmp/csharp/fragment/EntityRemoveOp.fragment.cs:31-35 `if (ctx.Result.Resdata != null)` `data = Helpers.ToMapAny(` `Voxgig.Struct.StructUtils.Clone(ctx.Result.Resdata))`; tm/csharp/core/Types.cs:18-19 `void MarkDeleted();` `bool Deleted();`
- **old page**: README:246 and REFERENCE:355 say 'return it marked as deleted' and name no marker. The README method table does not list Deleted().

### swift

- **answer** (read and certain): Through a method, deleted() -> Bool, backed by a private deletedFlag. runOp sets the flag only when the remove succeeded (result.ok). The data is not cleared, but it is not always kept either: remove's postDone replaces the entity's data with the response's resdata whenever that is non-nil. The comment saying the entity KEEPS its data holds only when the delete response has no body.
- **evidence**: src/cmp/swift/fragment/EntityBase.fragment.swift:94 "private var deletedFlag: Bool = false"; :100 "public func deleted() -> Bool {"; :167-169 "if let result = ctx.result, result.ok, \"list\" != opname { if \"remove\" == opname { self.markDeleted()"; src/cmp/swift/fragment/EntityRemoveOp.fragment.swift:18 "self.data = .map(clone(result.resdata).asMap ?? VMap())"; EntityBase.fragment.swift:92 comment "The instance KEEPS the data it held".
- **old page**: B/swift/README.md:247 "Remove an entity, and return it marked as deleted." The page does not name deleted(): the Entity interface table at README.md:241-253 omits it.

### cpp

- **answer** (read and certain): Through a method, deleted() -> bool, backed by a public field `deleted_`. The data is kept: remove's postDone updates only match_, never data_. markDeleted() is called after runOp returns whatever the outcome. By default a failure throws, so markDeleted is not reached. With ctrl throw:false, runOp returns the fallback instead of throwing, and the entity is marked deleted even though the remove failed. Swift marks only on success.
- **evidence**: tm/cpp/core/types.hpp:718 "bool deleted_ = false;"; :731 "bool deleted() override { return deleted_; }"; src/cmp/cpp/fragment/EntityRemoveOp.fragment.cpp:12-18 (postDone sets only this->match_); :25 "this->markDeleted();"; :27 "return this->self();"; tm/cpp/utility/pipeline.hpp:466-467 "if (is_false(ctx->ctrl->throwing)) { return result->resdata;".
- **old page**: B/cpp/README.md:239 "Remove an entity, which is returned marked as deleted." deleted() is not listed in the Entity interface table at :233-243.

### zig

- **answer** (read and certain): A public `deleted: bool` field, also readable through the method `is_deleted()`, is set by `mark_deleted()` only when the result is `.ok`. The data is kept: the post-done step replaces `data` with the response's resdata when it is present, and otherwise leaves it. Under `throw: false` the same caveat as rust applies (inferred: `opError` turns a failure into `.ok`).
- **evidence**: src/cmp/zig/fragment/Entity.fragment.zig:46-47 `// Set once a successful `remove` resolves on this instance.` `deleted: bool = false,`; :105-114 `// `remove` resolves to the entity, marked. The instance KEEPS the data it held` ... `pub fn is_deleted(self: *EntyClass) bool {`; src/cmp/zig/fragment/EntityRemoveOp.fragment.zig:12-13 `// A removed entity keeps its data but is no longer a live record.` `if (res == .ok) self.mark_deleted();`; :22-24 `if (!h.is_noval(resdata)) { const cm = h.to_map(h.clone(resdata)); self.data = ...`; Entity.fragment.zig:86-88 opError returns `.{ .ok = v }` when make_error does not error
- **old page**: zig/README.md: "Remove an entity, which is returned marked as deleted." It does not name the field or the method.

### rust

- **answer** (read and certain): A private `deleted: RefCell<bool>` field is set by `mark_deleted()` and read through the method `deleted()` (trait Entity). The entity keeps its data: the post-done step first absorbs the remove response's resdata, if there was any, into `data`, replacing it, and then the entity is marked. Data is replaced only when the response carried data, and is never cleared. Inferred: under `ctrl` `throw: false`, a failed remove returns Ok from run_op, so the entity is marked deleted even though the remove failed.
- **evidence**: src/cmp/rust/fragment/Entity.fragment.rs:27-28 `// Set once a successful `remove` resolves on this instance.` `deleted: RefCell<bool>,`; :258-263 `fn mark_deleted(&self) { *self.deleted.borrow_mut() = true; }` `fn deleted(&self) -> bool {`; src/cmp/rust/fragment/EntityRemoveOp.fragment.rs:25-30 `if !resdata.is_noval() && !resdata.is_null() { *self.data.borrow_mut() = match to_map(&vs::clone(&resdata)) {`; :32 `})?;`; :34 `self.mark_deleted();`; tm/rust/utility/make_error.rs:79-80 `if ctrl.borrow().throw == Some(false) { return Ok(result.borrow().resdata.clone());`
- **old page**: rust/README.md: "`remove` ... Remove an entity, which is returned marked as deleted." It does not name `deleted()`.

### clojure

- **answer** (read and certain): Through an atom field `:_deleted`, read with the module function `(e-<name>/deleted ent)` and set by `mark-deleted`. It is set only when the op succeeded (`out` is the entity). Data: on success the post-done step REPLACES `:_data` with a clone of the response's resdata whenever the response has data. The entity keeps its old data only when the response has none.
- **evidence**: fragment/Entity.fragment.clj:38 `deleted (atom false)`; :72 `(defn mark-deleted [ent] (reset! (:_deleted ent) true) ent)`; :74 `(defn deleted [ent] (true? (deref (:_deleted ent))))`; :245-247 `(when (core/oget result :resdata) (reset! (:_data ent) (let [m (core/to-map (vs/clone (core/oget result :resdata)))] ...`; :248 `(if (= out ent) (mark-deleted ent) out)`
- **old page**: README.md:246 says 'return it marked as deleted', without naming how. The code comment at fragment :233-234 says 'The instance keeps the data it held'. That is true only when the response carries no data.

### ocaml

- **answer** (read and certain): Through the mutable bool field `e_deleted`, set by the closure `e_mark_deleted ()`. It is set UNCONDITIONALLY once `run_op` returns. If the caller passed `throw: false` and the op failed, the entity is still marked deleted (unlike clojure). Data: post_done REPLACES `e_data` with a clone of resdata whenever resdata is not nullish.
- **evidence**: tm/ocaml/sdk_types.ml:223-224 `mutable e_deleted : bool; mutable e_mark_deleted : unit -> unit;`; Entity_ocaml.ts:108 `ent.e_mark_deleted <- (fun () -> ent.e_deleted <- true);`; src/cmp/ocaml/EntityOperation_ocaml.ts:265-267 `ignore (run_op ctx post_done);\n      ent.e_mark_deleted ();\n      ent);`; :245-246 `if not (is_nullish result.rt_resdata) then ent.e_data <- (match to_map (clone result.rt_resdata) ...`
- **old page**: README.md:240 and REFERENCE.md:369 say "marked deleted (`e_deleted`); it keeps the data it held". The name is right. 'Keeps the data' is false when the remove response has data.


## 7. What each thing is called on

### ts

- **answer** (read and certain): Constructor: instance (`new DemoSDK({ apikey })`). Test constructor: static `DemoSDK.test(testopts, sdkopts)`, plus the instance alias `client.tester(testopts, sdkopts)`. direct and prepare are instance and async: `await client.direct({ path, method, params })` and `await client.prepare({...})`. Getters are instance methods: `client.options()` and `client.utility()`. The accessor is an instance method: `client.Planet()`. Operations are entity instance methods: `await client.Planet().load({ id: 'p1' })`.
- **evidence**: src/cmp/ts/fragment/Main.fragment.ts:36 "constructor(options?: any) {"; :325 "static test(testoptsarg?: any, sdkoptsarg?: any) {"; :344-345 "tester(testopts?: any, sdkopts?: any) {" / "return ProjectNameSDK.test(testopts, sdkopts)"; :186 "async direct(fetchargs?: any): Promise<DirectResult> {"; :116 "async prepare(fetchargs?: any) {"; :104 "options() {"; :109 "utility() {"; MainEntity_ts.ts:23 "${entity.Name}(entopts?: Record<string, any>) {"; EntityLoadOp.fragment.ts:13 "async load(this: any, reqmatch?: EntityNameLoadMatch, ctrl?: Control): Promise<EntyClass> {"

### js

- **answer** (read and certain): Same shape as ts: `new DemoSDK({...})`, static `DemoSDK.test()`, `client.tester()`, `await client.direct({...})`, `await client.prepare({...})`, `client.options()`, `client.utility()`, `client.Planet()`, `await client.Planet().load({ id: 'p1' })`.
- **evidence**: src/cmp/js/fragment/Main.fragment.js:27 "constructor(options) {"; :334 "static test(testoptsarg, sdkoptsarg) {"; :353 "tester(testopts, sdkopts) {"; :183 "async direct(fetchargs) {"; :110 "async prepare(fetchargs) {"; :99,:104 options()/utility() bodies; src/cmp/js/MainEntity_js.ts:23 "${entity.Name}(entopts) {"; EntityLoadOp.fragment.js:12 "async load(reqmatch, ctrl) {"

### go

- **answer** (read and certain): Constructor: package-level function `sdk.NewDemoSDK(opts)` (also `sdk.New()`). Test constructors: package-level `sdk.TestSDK(nil, nil)` and `sdk.Test()`. direct, prepare, options and utility getters, entity accessor: methods on the client instance. Operation: method on the entity instance. Calls: `client := sdk.NewDemoSDK(map[string]any{"apikey": key})`; `tc := sdk.TestSDK(nil, nil)` / `tc := sdk.Test()`; `res, err := client.Direct(map[string]any{"path": "/x"})`; `fd, err := client.Prepare(map[string]any{"path": "/x"})`; `opts := client.OptionsMap()`; `u := client.GetUtility()`; `p := client.Planet(nil)`; `ent, err := client.Planet(nil).Load(map[string]any{"id": "x"}, nil)`.
- **evidence**: Main.fragment.go:19 "func NewProjectNameSDK(options map[string]any) *ProjectNameSDK {"; :390 "func TestSDK(testopts map[string]any, sdkopts map[string]any) *ProjectNameSDK {"; :120 "func (sdk *ProjectNameSDK) Prepare(fetchargs map[string]any) (map[string]any, error) {"; :220 "func (sdk *ProjectNameSDK) Direct(fetchargs map[string]any) (map[string]any, error) {"; Main_go.ts:215 "func New() *${model.const.Name}SDK  { return New${model.const.Name}SDK(nil) }"; :216 "func Test() *${model.const.Name}SDK { return TestSDK(nil, nil) }"; MainEntity_go.ts:17; EntityLoadOp.fragment.go:13
- **old page**: Consistent.

### c

- **answer** (read and certain): Everything except entity operations is a module-level function taking the client (or nothing): `DemoSDK* client = demo_sdk_new(cmap(1, "apikey", v_str(key)));`; `DemoSDK* tc = test_sdk(NULL, NULL);`; `voxgig_value* res = sdk_direct(client, cmap(1, "path", v_str("/x")), &err);`; `voxgig_value* fd = sdk_prepare(client, cmap(1, "path", v_str("/x")), &err);`; `voxgig_value* o = sdk_options_map(client);`; `Utility* u = sdk_get_utility(client);`; `Entity* p = demo_planet(client, NULL);`. An operation is a function pointer in the entity's vtable, called with the entity as first argument: `Entity* got = p->vt->load(p, cmap(1, "id", v_str("x")), NULL, &err);`. Stream is again module-level: `voxgig_value* items = planet_stream(p, "list", NULL, NULL, &err);`. (Every global name is mapped to a demo_-prefixed one by core/prefix_api.h; programs keep the short names.)
- **evidence**: tm/c/core/sdk.h:482-485 "ProjectNameSDK* projectname_sdk_new(voxgig_value* options);" / "ProjectNameSDK* test_sdk(voxgig_value* testopts, voxgig_value* sdkopts);" / "voxgig_value* sdk_prepare(ProjectNameSDK* sdk, voxgig_value* fetchargs, PNError** err);" / "voxgig_value* sdk_direct(ProjectNameSDK* sdk, voxgig_value* fetchargs, PNError** err);"; :477-478 "voxgig_value* sdk_options_map(ProjectNameSDK* sdk);" / "Utility* sdk_get_utility(ProjectNameSDK* sdk);"; :356 "Entity* (*load)(Entity*, voxgig_value* reqmatch, voxgig_value* ctrl, PNError** err);"; src/cmp/c/EntityBase_c.ts:47 "voxgig_value* ${evar}_stream(Entity* e, const char* action, ..."; tm/c/Makefile:97-101 "SDK_PREFIX := projectname_" ... "API_PREFIX_H := core/prefix_api.h"
- **old page**: Consistent.

### py

- **answer** (read and certain): Constructor: on the type, `client = DemoSDK({"apikey": "..."})`. Test constructor: a classmethod on the type, `client = DemoSDK.test()`. direct: on the instance, `res = client.direct({"path": "/planet", "method": "GET"})`. prepare: on the instance, `fd = client.prepare({"path": "/planet"})`. Options: `opts = client.options`, a property; the clone is `client.options_map()`. Utility: `u = client.get_utility()`. Accessor: on the instance, `planet = client.Planet()`. Operation: on the entity instance, `planet = client.Planet().load({"id": "p1"})`. There are no module-level functions.
- **evidence**: src/cmp/py/fragment/Main.fragment.py:24 "def __init__(self, options=None):"; :353-354 "@classmethod / def test(cls, testopts=None, sdkopts=None)"; :210 "def direct(self, fetchargs=None):"; :120 "def prepare(self, fetchargs=None):"; :96-97 "@property def options(self)"; :113 "def get_utility(self):"; src/cmp/py/MainEntity_py.ts:21; src/cmp/py/fragment/EntityLoadOp.fragment.py:8 "def load(self, reqmatch=None, ctrl=None) -> EntyClass:"
- **old page**: Consistent with the old pages.

### rb

- **answer** (read and certain): Constructor: on the type, `client = DemoSDK.new({ "apikey" => "..." })`. Test constructor: a class method, `client = DemoSDK.test`. direct: `res = client.direct({ "path" => "/planet" })`. prepare: `fd = client.prepare({ "path" => "/planet" })`. Options: `client.options`, an attr_accessor, and `client.options_map`. Utility: `client.get_utility`. Accessor: `planet = client.Planet`, parentheses optional. Operation: `planet = client.Planet.load({ "id" => "p1" })`. All except the constructor and test are instance methods. Ruby calls every one of them as a method, even without parentheses.
- **evidence**: src/cmp/rb/fragment/Main.fragment.rb:23 "def initialize(options = {})"; :325 "def self.test(testopts = nil, sdkopts = nil)"; :179 "def direct(fetchargs = {})"; :109 "def prepare(fetchargs = {})"; :21 "attr_accessor :mode, :features, :options"; :90 "def get_utility"; src/cmp/rb/MainEntity_rb.ts:21; src/cmp/rb/fragment/EntityLoadOp.fragment.rb:14 "def load(reqmatch = nil, ctrl = nil)"
- **old page**: Consistent with the old pages.

### php

- **answer** (read and certain): Constructor: an instance via new, `$client = new DemoSDK(["apikey" => getenv("DEMO_APIKEY")]);`. Test constructor: static, `$client = DemoSDK::test(["entity"=>[...]], []);`. direct: instance, `$res = $client->direct(["path"=>"/x/{id}","method"=>"GET","params"=>["id"=>"1"]]);`. prepare: instance, `$def = $client->prepare(["path"=>"/x"]);`. Options: `$client->options_map();`. Utility: `$client->get_utility();`. Accessor: instance method, `$planet = $client->Planet();`. Operation: instance, `$planet->load(["id"=>"p1"]);`.
- **evidence**: fragment/Main.fragment.php:34 "public function __construct(array $options = [])"; :393 "public static function test(?array $testopts = null, ?array $sdkopts = null): self"; :222 "public function direct(array $fetchargs = []): mixed"; :143 "public function prepare(array $fetchargs = []): mixed"; :114 "public function options_map(): array"; :133 "public function get_utility()"; MainEntity_php.ts:40 "public function ${accessor}($data = null)"; fragment/EntityLoadOp.fragment.php:15 "public function load(?array $reqmatch = null, $ctrl = null): mixed"

### perl

- **answer** (read and certain): Constructor: class method, `my $client = DemoSDK->new({ 'apikey' => $ENV{'DEMO_APIKEY'} });`. Test constructor: class method, though it works on an instance too, `my $client = DemoSDK->test(undef, undef);`. direct: instance, `my $res = $client->direct({ 'path' => '/x/{id}', 'method' => 'GET', 'params' => { 'id' => '1' } });`. prepare: instance, `$client->prepare({ 'path' => '/x' })`. Options: `$client->options_map`. Utility: `$client->get_utility`. Accessor: instance method, parentheses optional, `my $planet = $client->Planet;`. Operation: instance, `$planet->load({ 'id' => 'p1' });`.
- **evidence**: fragment/Main.fragment.pm:31-32 "sub new { my ($class, $options) = @_;"; :364-377 "sub test { my ($class, $testopts, $sdkopts) = @_; ... my $sdk = $class->new($sdkopts);"; :206 "sub direct {"; :132 "sub prepare {"; :103 "sub options_map {"; :109 "sub get_utility {"; MainEntity_perl.ts:21 "sub ${entity.Name} {"; fragment/EntityLoadOp.fragment.pm:42-43 "sub load { my ($self, $reqmatch, $ctrl) = @_;"

### lua

- **answer** (read and certain): The constructor and the test constructor are functions on the module table (static, dot call). direct, prepare, options_map, get_utility and the accessor are instance methods (colon). Operations are instance methods on the entity.
- **evidence**: Main.fragment.lua:81: "function ProjectNameSDK.new(options)"; :432: "function ProjectNameSDK.test(testopts, sdkopts)"; :265: "function ProjectNameSDK:direct(fetchargs)"; :178: "function ProjectNameSDK:prepare(fetchargs)"; :159, :168 options_map/get_utility with ':'; MainEntity_lua.ts:18 "function ${model.const.Name}SDK:${entity.Name}(data)"; EntityLoadOp.fragment.lua:12: "function EntyClass:load(reqmatch, ctrl)". Calls: local sdk = require("demo_sdk"); local client = sdk.new({ apikey = os.getenv("DEMO_APIKEY") }); local tclient = sdk.test(); local res = client:direct({ path = "/planet/{id}", params = { id = "p1" } }); local fetchdef, err = client:prepare({ path = "/planet" }); local opts = client:options_map(); local u = client:get_utility(); local planet = client:Planet(); local planet2, err2 = client:Planet():load({ id = "p1" })
- **old page**: Consistent (README.md:31, 111, 62).

### elixir

- **answer** (read and certain): Everything is a module-level function. new/1 and test/2 are functions on the SDK module. direct, prepare, options_map, get_utility and the accessor are functions on the SDK module that take the client first. Operations are functions on Demo.Entity.<Name> that take the entity first and return the entity.
- **evidence**: Main.fragment.ex:12: "def new(options \\\\ nil) do"; :88: "def test(testopts \\\\ nil, sdkopts \\\\ nil) do"; :176: "def direct(client, fetchargs \\\\ nil) do"; :103: "def prepare(client, fetchargs \\\\ nil) do"; :79,:84 options_map(client), get_utility(client); MainEntity_elixir.ts:20 "def ${accessor}(client, entopts \\\\ nil) do"; EntityLoadOp.fragment.ex:10: "def load(ent, reqmatch \\\\ nil, ctrl \\\\ nil) do". Calls: alias Demo.Helpers, as: H; sdk = Demo.new(H.deep(%{"apikey" => System.get_env("DEMO_APIKEY")})); tsdk = Demo.test(); res = Demo.direct(sdk, H.deep(%{"path" => "/planet/{id}", "params" => %{"id" => "p1"}})); fetchdef = Demo.prepare(sdk, H.deep(%{"path" => "/planet"})); opts = Demo.options_map(sdk); u = Demo.get_utility(sdk); planet = Demo.planet(sdk); planet = Demo.Entity.Planet.load(planet, H.deep(%{"id" => "p1"}))
- **old page**: Consistent in the Elixir sections (README.md:52-62, 113).

### java

- **answer** (read and certain): Constructor: new on the type. testSDK: static method on the class. direct, prepare, optionsMap, getUtility, accessor, operations: instance methods. Calls: `DemoSDK client = new DemoSDK(options);` `DemoSDK t = DemoSDK.testSDK();` / `DemoSDK.testSDK(null, null);` `Map<String,Object> r = client.direct(Map.of("path","/x","method","GET"));` `Map<String,Object> fd = client.prepare(Map.of("path","/x"));` `client.optionsMap();` `client.getUtility();` `SdkEntity p = client.planet(null);` `Object e = client.planet(null).load(Map.of("id","p1"), null);`
- **evidence**: src/cmp/java/fragment/Main.fragment.java:16 "public ProjectNameSDK(Map<String, Object> options) {" :24 "public static ProjectNameSDK testSDK() {" :28-29 "public static ProjectNameSDK testSDK(" ; tm/java/core/SdkClient.java:115 "public Map<String, Object> prepare(Map<String, Object> fetchargs) {" :201 "public Map<String, Object> direct(Map<String, Object> fetchargs) {"; tm/java/core/SdkEntity.java:13 "Object load(Map<String, Object> reqmatch, Map<String, Object> ctrl);"
- **old page**: Consistent. Ops return Object, so the old page casts: "(SdkEntity) client.ambient(null).load(null, null)".

### kotlin

- **answer** (read and certain): Constructor on the type; testSDK on the companion object (called on the type in Kotlin; not @JvmStatic, so from Java it would be DemoSDK.Companion.testSDK). Everything else instance. Calls: `val client = DemoSDK(mutableMapOf<String, Any?>("apikey" to key))` `val t = DemoSDK.testSDK()` `client.direct(mutableMapOf<String, Any?>("path" to "/x", "method" to "GET"))` `client.prepare(mutableMapOf<String, Any?>("path" to "/x"))` `client.optionsMap()` `client.getUtility()` `client.planet(null)` `client.planet(null).load(mutableMapOf<String, Any?>("id" to "p1"), null)`
- **evidence**: src/cmp/kotlin/fragment/Main.fragment.kt:8 "class ProjectNameSDK(options: MutableMap<String, Any?>?) : SdkClient(options) {" :14 "companion object {" :17 "fun testSDK(): ProjectNameSDK = testSDK(null, null)"; tm/kotlin/core/SdkClient.kt:105 "fun prepare(fetchargsIn: MutableMap<String, Any?>?): MutableMap<String, Any?> {" :187 "fun direct(fetchargsIn: MutableMap<String, Any?>?): MutableMap<String, Any?> {"
- **old page**: Consistent.

### scala

- **answer** (read and certain): The constructor is an instance constructor: `new DemoSDK(options)`. The test constructor is on the type, in the companion object: `DemoSDK.testSDK(null, null)`, with a no-arg overload `DemoSDK.testSDK()`. Everything else is an instance method: `client.direct(...)`, `client.prepare(...)`, `client.optionsMap()`, `client.getUtility()`, the entity accessor `client.ambient(null)` (the argument is required; there is no default) and operations `client.ambient(null).load(null, null)` (both arguments required).
- **evidence**: src/cmp/scala/fragment/Main.fragment.scala:8 `class ProjectNameSDK(options: JMap[String, Object]) extends SdkClient(options) {`; :16 `object ProjectNameSDK {`; :20 `def testSDK(): ProjectNameSDK = testSDK(null, null)`; :22 `def testSDK(testopts: JMap[String, Object], sdkopts: JMap[String, Object]): ProjectNameSDK = {`; tm/scala/core/SdkClient.scala:92 `def prepare(fetchargs0: JMap[String, Object]): JMap[String, Object] = {`; :160 `def direct(fetchargs0: JMap[String, Object]): JMap[String, Object] = {`; tm/scala/core/Contracts.scala:17 `def load(reqmatch: JMap[String, Object], ctrl: JMap[String, Object]): Object`
- **old page**: The old page agrees: `DemoSDK.testSDK(null, null)`, `client.ambient(null).load(null, null)`.

### csharp

- **answer** (read and certain): The constructor is an instance constructor: `new DemoSDK(new Dictionary<string, object?> { ["apikey"] = key })`, and the options argument is optional. The test constructor is a static method on the type: `DemoSDK.TestSDK(null, null)`. Both parameters are nullable but have no defaults in the code, although REFERENCE.md:36 shows `= null`. Everything else is an instance method: `client.Direct(args)`, `client.Prepare(args)`, `client.OptionsMap()`, `client.GetUtility()`, the accessor `client.Ambient()` and operations `client.Ambient().Load(null)`, where ctrl defaults to null.
- **evidence**: src/cmp/csharp/fragment/Main.fragment.cs:26 `public ProjectNameSDK(Dictionary<string, object?>? options = null)`; :113 `public Dictionary<string, object?> Prepare(Dictionary<string, object?>? fetchargs)`; :205 `public Dictionary<string, object?> Direct(Dictionary<string, object?>? fetchargs)`; :414-415 `public static ProjectNameSDK TestSDK(Dictionary<string, object?>? testopts,` `Dictionary<string, object?>? sdkopts)`; src/cmp/csharp/fragment/EntityBase.fragment.cs:101-102 Load signature
- **old page**: REFERENCE.md:36 shows `DemoSDK.TestSDK(testopts = null, sdkopts = null)`. The code gives no default values, so `DemoSDK.TestSDK()` would not compile.

### swift

- **answer** (read and certain): Constructor: on the type, as an initializer, `let client = DemoSDK(options)`. Test constructor: a static method, `let client = DemoSDK.testSDK(nil, nil)`. direct: on the instance, `let result = client.direct(fetchargs)`. prepare: on the instance and throwing, `let fetchdef = try client.prepare(fetchargs)`. Options getter: on the instance, `let opts = client.optionsMap()`. Utility getter: on the instance, `let u = client.getUtility()`. Entity accessor: on the instance, `let planet = client.Planet()`. An operation: on the entity instance, `let res = try client.Planet().load(VMap([("id", .string("p1"))]), nil)`, which returns a Value that wraps the entity (`res.asNative as? Entity`).
- **evidence**: src/cmp/swift/fragment/Main.fragment.swift:26 "public init(_ optionsIn: ProjectNameSdk.VMap? = nil) {"; :330 "public static func testSDK(_ testoptsIn: ProjectNameSdk.VMap?, _ sdkoptsIn: ProjectNameSdk.VMap?) -> ProjectNameSDK {"; :162 "public func direct(_ fetchargsIn: ProjectNameSdk.VMap?) -> ProjectNameSdk.VMap {"; :96 "public func prepare(_ fetchargsIn: ProjectNameSdk.VMap?) throws -> ProjectNameSdk.VMap {"; :84 "public func optionsMap()"; :88 "public func getUtility()"; src/cmp/swift/fragment/EntityLoadOp.fragment.swift:8 "public override func load(_ reqmatch: VMap?, _ ctrl: VMap?) throws -> Value {"; EntityBase.fragment.swift:171 "return .native(NativeRef(self))".
- **old page**: Consistent with B/README.md:596-611 and swift/README.md:213-230.

### cpp

- **answer** (read and certain): Constructor: on the type, `auto client = std::make_shared<DemoSDK>(vmap({{"apikey", Value("...")}}));` (or `DemoSDK client(opts);`, or the static `DemoSDK::create()`). Test constructor: static, `auto client = DemoSDK::testSDK();` or `DemoSDK::testSDK(testopts, sdkopts)`. direct: on the instance, `Value r = client->direct(vmap({{"path", Value("/x")}}));`. prepare: on the instance, `Value fd = client->prepare(fetchargs);`. Getters: on the instance, `Value o = client->optionsMap(); UtilityPtr u = client->getUtility();`. Entity accessor: on the instance, lower snake-case name, `auto planet = client->planet();`. An operation: on the entity instance, `SdkEntityPtr p = client->planet()->load(vmap({{"id", Value("p1")}}), Value::undef());`. All of these sit in namespace sdk.
- **evidence**: src/cmp/cpp/fragment/Main.fragment.cpp:17 "explicit ProjectNameSDK(Value options = Value::undef()) : SdkClient(options) {}"; :23 "static std::shared_ptr<ProjectNameSDK> testSDK() {"; :27 "static std::shared_ptr<ProjectNameSDK> testSDK(Value testopts, Value sdkopts) {"; :34 "static std::shared_ptr<ProjectNameSDK> create() {"; :13 "namespace sdk {"; tm/cpp/core/types.hpp:663-671 (optionsMap, getUtility, prepare, direct as instance members); src/cmp/cpp/MainEntity_cpp.ts:21 "const accessor = cppVarName(entity.name)"; src/cmp/cpp/fragment/EntityLoadOp.fragment.cpp:3 "SdkEntityPtr load(const Value& reqmatch, const Value& ctrl) override {".
- **old page**: Consistent with B/cpp/README.md:56-58 and 205-221.

### zig

- **answer** (read and certain): Constructor: a function on the type, `sdk.DemoSDK.new(opts)`; also `sdk.DemoSDK.new_with(opts, extend)` and the module function `sdk.new()`. Test constructors: the module functions `sdk.test_sdk(testopts, sdkopts)` and `sdk.testSdk()`. `direct`, `prepare`, `options_map`, `get_utility`, the accessor and the operations: methods taking `self`, called on the instance. `graphql` is also an instance method (the runtime table wrongly says type). Calls: `const client = sdk.DemoSDK.new(h.jo(&.{.{ "apikey", h.vstr("k") }}));` `const client = sdk.test_sdk(h.vnull(), h.vnull());` `const client = sdk.testSdk();` `const r = client.direct(h.jo(&.{.{ "path", h.vstr("/x") }}));` `const fd = try client.prepare(h.jo(&.{.{ "path", h.vstr("/x") }}));` `const o = client.options_map();` `const u = client.get_utility();` `const p = client.planet(h.vnull());` `switch (client.planet(h.vnull()).load(h.vnull(), h.vnull())) { .ok => |e| ..., .err => |e| ... }`
- **evidence**: src/cmp/zig/fragment/Main.fragment.zig:42 `pub fn new(options: Value) *ProjectNameSDK {`; :58 `pub fn new_with(options: Value, extend: []const Feature) *ProjectNameSDK {`; :130 `pub fn options_map(self: *ProjectNameSDK) Value {`; :142 `pub fn prepare(self: *ProjectNameSDK, fetchargs_in: Value) E!Value {`; :237 `pub fn direct(self: *ProjectNameSDK, fetchargs_in: Value) Value {`; :361-362 `pub fn graphql(` `self: *ProjectNameSDK, ...`; :411 `pub fn test_sdk(testopts_in: Value, sdkopts_in: Value) *ProjectNameSDK {`; src/cmp/zig/fragment/Root.fragment.zig:21 `pub const test_sdk = sdk.test_sdk;`; :78 `pub fn new() *ProjectNameSDK {`; :82 `pub fn testSdk() *ProjectNameSDK {`; EntityLoadOp.fragment.zig:3 `pub fn load(self: *EntyClass, reqmatch: Value, ctrl: Value) EntResult {`
- **old page**: Consistent with the old page. `testSdk()`, `sdk.new()` and `new_with` are not mentioned.

### rust

- **answer** (read and certain): Constructor: an associated function on the type, `DemoSDK::new(opts)`, and also the crate-level function `demo_sdk::new()`. Test constructors: the module-level function `test_sdk(testopts, sdkopts)` and the crate-level `demo_sdk::test()`. `direct`, `prepare`, `options_map` and `get_utility`: instance methods. Entity accessor: an instance method (`self: &Rc<Self>`). Operations: instance methods on the `DemoEntityBase` trait (`self: &Rc<Self>`), so the trait must be in scope. Calls: `let client = DemoSDK::new(jo(vec![("apikey", Value::str("k"))]));` `let client = test_sdk(Value::Noval, Value::Noval);` `let client = demo_sdk::test();` `let r = client.direct(jo(vec![("path", Value::str("/x"))])).unwrap();` `let fd = client.prepare(jo(vec![("path", Value::str("/x"))])).unwrap();` `let o = client.options_map();` `let u = client.get_utility();` `let p = client.planet(Value::Noval);` `let p = client.planet(Value::Noval).load(Value::Noval, Value::Noval).unwrap();`
- **evidence**: src/cmp/rust/fragment/Main.fragment.rs:25 `pub fn new(options: Value) -> Rc<ProjectNameSDK> {`; :95 `pub fn options_map(&self) -> Value {`; :99 `pub fn get_utility(&self) -> Rc<Utility> {`; :110 `pub fn prepare(&self, fetchargs: Value) -> Result<Value, ProjectNameError> {`; :212 `pub fn direct(&self, fetchargs: Value) -> Result<Value, ProjectNameError> {`; :409 `pub fn test_sdk(testopts: Value, sdkopts: Value) -> Rc<ProjectNameSDK> {`; src/cmp/rust/Main_rust.ts:222-228 `pub fn new() -> Rc<${model.const.Name}SDK> {` ... `pub fn test() -> Rc<...> { test_sdk(Value::Noval, Value::Noval) }`; MainEntity_rust.ts:27; tm/rust/core/types.rs:82 `fn load(self: &Rc<Self>, reqmatch: Value, ctrl: Value) -> Result<Rc<Self>, ProjectNameError>;`
- **old page**: The page documents test_sdk and the methods. It does not mention the crate-level `new()`/`test()` convenience functions.

### clojure

- **answer** (read and certain): Everything is a module-level function that takes the client or entity. The two state accessors are functions stored in the entity map. Constructor: `(api/make-sdk (vs/jm "apikey" k))`. Test: `(api/test-sdk nil nil)`. Direct: `(api/direct client (vs/jm "path" "/p" "method" "GET"))`. Prepare: `(api/prepare client (vs/jm "path" "/p"))`. Options: `(api/options-map client)`. Utility: `(sdk.client/get-utility client)`, which is not in sdk.api. Accessor: `(api/planet client nil)`. Op: `(e-planet/load (api/planet client nil) (vs/jm "id" "p1") nil)`, with `[sdk.entity.planet :as e-planet]` required, because ops are not re-exported by sdk.api.
- **evidence**: src/cmp/clojure/Main_clojure.ts:82-90 `(ns sdk.api (:require [sdk.client :as client]...)) (def make-sdk client/make-sdk) (def test-sdk client/test-sdk) (def direct client/direct) (def graphql client/graphql) (def prepare client/prepare) (def options-map client/options-map)`; client.clj:27 `(defn make-sdk [options]`; client.clj:212 `(defn test-sdk [testopts sdkopts]`; fragment/Entity.fragment.clj:203 `(defn load [ent reqmatch ctrl]`
- **old page**: REFERENCE.md:77 `(api/get-utility client)` is wrong: the var lives only in sdk.client.

### ocaml

- **answer** (read and certain): Constructors, direct and prepare are module functions in `Sdk_client` that take the client. Options and utility are record fields (or the helper `Sdk_helpers.client_options_map`). The accessor is a module function. An op is a closure in a field of the entity record, applied like a method. Constructor: `Sdk_client.make (jo [("apikey", Str k)])` (or `Sdk_client.make0 ()`). Tests: `Sdk_client.test ()` and `Sdk_client.test_with Noval Noval`. Direct: `Sdk_client.direct client (jo [("path", Str "/p")])`. Prepare: `Sdk_client.prepare client (jo [("path", Str "/p")])`. Options: `client.cl_options`. Utility: `client.cl_utility`. Accessor: `Sdk_client.planet client Noval`. Op: `(Sdk_client.planet client Noval).e_load (jo [("id", Str "p1")]) Noval`.
- **evidence**: src/cmp/ocaml/Main_ocaml.ts:168 `let make (options : value) : sdk_client =`; :175 `let make0 () : sdk_client = make Noval`; :178 `let test () : sdk_client =`; :185 `let test_with (testopts : value) (sdkopts : value) : sdk_client =`; :192 `let direct (client : sdk_client) (fetchargs : value) : value =`; :199 `let prepare (client : sdk_client) (fetchargs : value) : value =`; sdk_types.ml:214 `mutable e_load : value -> value -> entity_obj;`
- **old page**: README.md:203-233 agrees.


## 8. Fields or calls

### ts

- **answer** (read and certain): name, name_ and Name are fields (strings, read without a call). client(), data(), match(), deleted() and entopts() are methods. The backing fields _client, _data, _match, _deleted and _entopts exist as public properties, but by convention they are private.
- **evidence**: src/cmp/ts/fragment/EntityBase.fragment.ts:18-20 "name = ''" / "name_ = ''" / "Name = ''"; :74 "client() {"; :79 "data(this: any, data?: Partial<D>): D {"; :95 "match(this: any, match?: Partial<D>): Partial<D> {"; :65 "deleted(this: any): boolean {"; :70 "entopts() {"; Entity.fragment.ts:24-26 "this.name = 'entityname'" ...

### js

- **answer** (read and certain): Same as ts: name, name_ and Name are fields. client(), data(), match(), deleted() and entopts() are methods.
- **evidence**: src/cmp/js/fragment/Entity.fragment.js:12-14 "this.name = 'entityname'" / "this.name_ = 'entityname'" / "this.Name = 'EntityName'"; EntityBase.fragment.js:51 "deleted() {"; :60 "client() {"

### go

- **answer** (read and certain): All are methods; the entity exports no fields. name: `GetName()`; data: `Data()`; match: `Match()`; deleted mark: `Deleted()`. client and entity options: no accessor at all (unexported fields `client`, `entopts`). (The client struct itself does export fields `Mode` and `Features`.)
- **evidence**: Entity.fragment.go:12-21 "type EntyClass struct { name string; client *core.ProjectNameSDK; utility *core.Utility; entopts map[string]any; data any; match map[string]any; entctx *core.Context; deleted bool }"; :54 "func (e *EntyClass) GetName() string { return e.name }"; tm/go/core/types.go:26-34 Entity interface "GetName() string / Make() Entity / Data(data ...any) any / Match(match ...any) any / MarkDeleted() / Deleted() bool"; Main.fragment.go:11-16 "Mode string" ... "Features []Feature"
- **old page**: Consistent (lists GetName, Data, Match, Make as methods).

### c

- **answer** (read and certain): All are function calls; the public `struct Entity` has only `vt`. name: `e->vt->get_name(e)`; data: `e->vt->data(e, NULL)`; match: `e->vt->matchv(e, NULL)`; deleted: `e->vt->deleted(e)`. client and entity options: no accessor (private fields of the static per-entity struct).
- **evidence**: tm/c/core/sdk.h:369-372 "struct Entity {" / "const EntityVT* vt;" / "// subtype-specific state follows."; :347-353 "const char* (*get_name)(Entity*);" ... "bool (*deleted)(Entity*);"; Entity.fragment.c:8-19 "typedef struct entyvar_entity { Entity base; char* name; ProjectNameSDK* client; Utility* utility; voxgig_value* entopts; voxgig_value* data; voxgig_value* mtch; Context* entctx; bool deleted; } entyvar_entity;"
- **old page**: Consistent.

### py

- **answer** (read and certain): All entity members a program reads are methods, called with parentheses: name is `get_name()`, data is `data_get()`, match is `match_get()`, and the deleted mark is `deleted()`. The client and the entity options have no public member at all: `_client` and `_entopts` are private attributes. No public field exists.
- **evidence**: src/cmp/py/fragment/Entity.fragment.py:22-28 "self._name = ... self._client = client ... self._entopts = entopts ... self._deleted = False"; :37 "def get_name(self):"; :46 "def deleted(self):"; :61 "def data_get(self)"; :70 "def match_get(self)"
- **old page**: The old page lists get_name, data_get and match_get as methods. It does not mention deleted, client or entity options.

### rb

- **answer** (read and certain): All are methods: `get_name`, `data_get`, `match_get`, `deleted` and `to_h`. Ruby lets a caller write them without parentheses, so they read like fields, but each one is a method call. The client and the entity options have no reader: they are in the instance variables `@_client` and `@_entopts`.
- **evidence**: src/cmp/rb/fragment/Entity.fragment.rb:17-23 "@_name = ... @_client = client ... @_entopts = entopts"; :33 "def get_name"; :40 "def to_h"; :59 "def deleted"; :77 "def data_get"; :90 "def match_get"
- **old page**: Consistent with rb/README.md:229-239.

### php

- **answer** (read and certain): On the entity everything a program reads is a method: get_name(), data_get(), match_get() and deleted(). The client, the entity options and the deleted flag are private fields with no public read, except through deleted(). On the client, mode, features and options are public properties.
- **evidence**: fragment/Entity.fragment.php:13-20 "private string $_name; private $_client; ... private array $_entopts; private mixed $_data; private array $_match; ... private bool $_deleted = false;"; :48 "public function get_name(): string"; :85 "public function deleted(): bool"; Main.fragment.php:27-29 "public string $mode; public array $features; public ?array $options;"

### perl

- **answer** (read and certain): The documented members are all methods: get_name, data_get, match_get and deleted. The entity is a blessed hashref, so _name, _client, _entopts, _data, _match and _deleted are hash keys a program could read without a call, for example `$e->{_data}`. They are private by convention, have no accessor, and data read that way is not cloned.
- **evidence**: fragment/Entity.fragment.pm:30-38 "my $self = bless { _name => 'entityname', _client => $client, _utility => ..., _entopts => $entopts, _data => {}, _deleted => 0, _match => {}, }, $class;"; :50 "sub get_name {"; :84 "sub deleted {"

### lua

- **answer** (read and certain): Everything a program should read is a method: get_name(), data_get(), match_get(), deleted(). The entity has no client getter and no entity-options getter. The underlying values are plain table fields (_name, _client, _data, _match, _deleted, _entopts), readable without a call, but they are private by naming convention. On the client, `mode` is a plain field.
- **evidence**: Entity.fragment.lua:23-29: "self._name = \"entityname\"" / "self._client = client" / ... "self._entopts = entopts" / "self._data = {}" / "self._deleted = false" / "self._match = {}"; :42 "function EntyClass:get_name()"; :87 "function EntyClass:deleted()"; :100 data_get; :114 match_get; Main.fragment.lua:83: "self.mode = \"live\""
- **old page**: No disagreement found.

### elixir

- **answer** (read and certain): All are function calls on a module: Demo.Entity.<Name>.get_name(ent), data_get(ent), match_get(ent), and Demo.EntityBase.deleted(ent). The entity is an ETS-backed handle ({:vmap, id}), so it has no fields in Elixir's sense. _client, _entopts, _data, _match and _deleted are reached only through Voxgig.Struct.getprop(ent, "_..."). No client or entity-options getter exists.
- **evidence**: S/tm/elixir/lib/utility/struct/voxgig_struct.ex:11: "# tagged reference `{:vmap, id}` / `{:vlist, id}` whose contents live in the"; entity_base.ex:22-29: "ent = S.jm([])" / "S.setprop(ent, \"_module\", module)" ... "S.setprop(ent, \"_match\", S.jm([]))"; Entity.fragment.ex:14-19 function delegates
- **old page**: No disagreement found.

### java

- **answer** (read and certain): All are methods or inaccessible: name -> getName() method; data -> data() method; match -> match() method; deleted mark -> deleted() method (EntityBase only); client and entopts are protected fields with no public getter (not readable by a program).
- **evidence**: tm/java/core/Entity.java "String getName();" "Object data(Object... args);" "Object match(Object... args);"; src/cmp/java/fragment/EntityBase.fragment.java:30-33 "protected String name = \"\";" "protected SdkClient client;" "protected Map<String, Object> entopts;" :47 "public boolean deleted() {"
- **old page**: README table lists getName/data/match/make as methods; no deleted, client or entopts.

### kotlin

- **answer** (read and certain): name is a PROPERTY (override var name, read as entity.name, and publicly writable); data(), match(), deleted() are functions; client and entopts are protected vars, not readable. Differs from java on name (property vs getName()).
- **evidence**: tm/kotlin/core/Interfaces.kt:5 "val name: String" :9 "fun data(vararg args: Any?): Any?"; src/cmp/kotlin/fragment/EntityBase.fragment.kt:48 "override var name: String = \"\"" :49 "protected var client: SdkClient" :51 "protected var entopts: MutableMap<String, Any?>" :113 "fun deleted(): Boolean = this.deletedFlag"
- **old page**: README: "| `name` | `val: String` | The entity name. |" (it is a var in EntityBase).

### scala

- **answer** (read and certain): Every member a program reads is a method: `getName()`, `data()`, `matchArgs()` and `deleted()`. The client (`client`) and the entity options (`entopts`) are protected vars, so a program cannot read them at all.
- **evidence**: src/cmp/scala/fragment/EntityBase.fragment.scala:13-16 `protected var name: String = name0` `protected var client: SdkClient = client0` `protected var utility: Utility = null` `protected var entopts: JMap[String, Object] = null`; :39 `def getName(): String = this.name`; :41 `override def data(args: Object*): Object = {`; :52 `override def matchArgs(args: Object*): Object = {`; :72 `def deleted(): Boolean = deletedFlag`
- **old page**: README:232-234 lists data, matchArgs, make and getName as methods. That agrees.

### csharp

- **answer** (read and certain): Every member a program reads is a method: `GetName()`, `Data()`, `Match()` and `Deleted()`. The client (`client`) and the entity options (`entopts`) are protected fields, so a program cannot read them.
- **evidence**: src/cmp/csharp/fragment/EntityBase.fragment.cs:15-18 `protected string name;` `protected ProjectNameSDK client;` `protected Utility utility;` `protected Dictionary<string, object?> entopts;`; :66 `public string GetName() => name;`; :75 `public object? Data(object? newdata = null)`; :88 `public object? Match(object? newmatch = null)`; :33 `public bool Deleted()`
- **old page**: README:247-250 lists Data, Match, Make and GetName as methods. That agrees.

### swift

- **answer** (read and certain): Every entity member a program can read is a method: getName(), data(), matchv() and deleted(). The stored properties name, client, entopts, data and match have no access modifier, so they are internal and invisible to a program that imports the module. No entity-options or client accessor is public. On the client, mode and features are public stored properties, read without a call. options and utility are private.
- **evidence**: src/cmp/swift/fragment/EntityBase.fragment.swift:9-14 "var name: String" "var client: ProjectNameSDK" "var utility: Utility" "var entopts: VMap" "var data: Value = .map(VMap())" "var match = VMap()"; :35 "public func getName() -> String { name }"; :48 "public func data(_ newdata: Value?) -> Value {"; :58 "public func matchv(_ newmatch: Value?) -> Value {"; :100 "public func deleted() -> Bool {"; tm/swift/Sources/ProjectNameSDK/core/Types.swift:8-17 (the Entity protocol: getName, make, data, matchv); src/cmp/swift/fragment/Main.fragment.swift:20-23 "public var mode" "private var options" "private let utility" "public var features".
- **old page**: swift/README.md:248-253 lists data, matchv, make and getName as methods. Consistent, but deleted() is missing.

### cpp

- **answer** (read and certain): Both forms exist. The public fields, read without a call, are name_, client (SdkClient*), data_, match_, deleted_ and entopts; data_ and match_ are the live values, not clones. The methods are getName(), data(), match() and deleted(); the documented way is the methods. There is no entity-options method: entopts is only a field.
- **evidence**: tm/cpp/core/types.hpp:715-724 "public: std::string name_ = \"\"; bool deleted_ = false; SdkClient* client = nullptr; UtilityPtr utility; Value entopts ...; Value data_ ...; Value match_ ...;"; :728 "std::string getName() override { return name_; }"; :731 "bool deleted() override"; :738-739 "Value data(const Value& arg = Value::undef()) override; Value match(...)".
- **old page**: B/cpp/README.md:240-243 lists data, match, make and getName as methods. Consistent; the fields are not mentioned.

### zig

- **answer** (read and certain): Fields: zig struct fields are always accessible, so `name`, `client`, `entopts`, `data`, `mtch` and `deleted` are all fields read without a call, and they give the LIVE values. Methods: `is_deleted()` on the entity. The name, data and match getters are not methods of the entity struct itself: they are methods of the `Entity` interface reached through `asEntity()`, as in `e.asEntity().get_name()`, `e.asEntity().data(null)` (a clone) and `e.asEntity().matchv(null)` (a clone). `e.data(null)` would not compile, because `data` is a field.
- **evidence**: src/cmp/zig/fragment/Entity.fragment.zig:38-47 `pub const EntyClass = struct { name: []const u8 = "entityname", client: *sdk.ProjectNameSDK, utility: *Utility, entopts: Value, data: Value, mtch: Value, entctx: ?*Context = null, ... deleted: bool = false,`; :112 `pub fn is_deleted(self: *EntyClass) bool {`; :289 `pub fn asEntity(self: *EntyClass) Entity {`; :293 `fn data_impl(...)` (not pub); tm/zig/core/types.zig:61 `pub fn get_name(self: Entity) []const u8 {`; :67 `pub fn data(self: Entity, args: ?Value) Value {`; :70 `pub fn matchv(self: Entity, args: ?Value) Value {`
- **old page**: zig/README.md entity interface table lists `data`, `matchv` and `get_name` as entity methods. They are methods only via `asEntity()`, although the prose elsewhere does say `asEntity().data(null)`.

### rust

- **answer** (read and certain): All are methods. The struct fields `name`, `client`, `utility`, `entopts`, `data`, `mtch` and `deleted` are private (no `pub`). A program reads the name with `get_name()`, the data with `data(None)`, the match with `matchv(None)` and the deleted mark with `deleted()`. There is NO way to read the entity's client or its entity options.
- **evidence**: src/cmp/rust/fragment/Entity.fragment.rs:18-29 `pub struct EntyClass { name: String, ... client: Rc<ProjectNameSDK>, utility: Rc<Utility>, entopts: Value, data: RefCell<Value>, mtch: RefCell<Value>, ... deleted: RefCell<bool>, }`; tm/rust/core/types.rs:69-77 `pub trait Entity { fn get_name(&self) -> String; fn make(&self) -> Rc<dyn Entity>; fn data(&self, args: Option<&Value>) -> Value; fn matchv(...); fn mark_deleted(&self); fn deleted(&self) -> bool; }`
- **old page**: rust/README.md lists data, matchv, make and get_name as methods. Consistent. It does not mention `deleted()`.

### clojure

- **answer** (read and certain): The entity is a plain Clojure map. Fields read by keyword: `(:_name ent)`, `(:_client ent)`, `(:_entopts ent)`, and the atoms `(:_data ent)`, `(:_match ent)` and `(:_deleted ent)`, which hold the live values and need deref. Calls: `((:get-name ent))`, `((:data-get ent))`, `((:match-get ent))` and `((:make ent))`. The deleted mark is also read with the namespace function `(e-x/deleted ent)`. There is no entity-options call.
- **evidence**: fragment/Entity.fragment.clj:40-48 `ent {:_name "entityname" :_client client :_utility utility :_entopts entopts :_data data :_match match :_deleted deleted :_entctx entctx :get-name (fn [] "entityname") :make (fn [] ...)} ... :data-get (fn [] (ent-data-get ent)) ... :match-get (fn [] (ent-match-get ent))`; :74 `(defn deleted [ent] ...)`
- **old page**: README.md:247-252 lists the :data-get, :match-get, :make and :get-name fns. It does not mention the deleted mark.

### ocaml

- **answer** (read and certain): All are record fields of `entity_obj`, read without a call: `e_name`, `e_client`, `e_data` (live), `e_match` (live), `e_deleted` and `e_entopts`. The getters `e_data_get ()` and `e_match_get ()` are closures stored in fields and called with `()`; they return clones.
- **evidence**: tm/ocaml/sdk_types.ml:197-209 `and entity_obj = { mutable e_name : string; mutable e_client : sdk_client; mutable e_utility : utility; mutable e_entopts : value; mutable e_data : value; mutable e_match : value; ... mutable e_data_get : unit -> value; ... mutable e_match_get : unit -> value;`; :223 `mutable e_deleted : bool;`
- **old page**: README.md:233 lists `e_name` as a `string` field. e_deleted is mentioned at :240.


## 9. direct's result in four cases

### ts

- **answer** (read and certain): (a) 2xx: { ok: true, status, headers: fetched.headers, data: parsed JSON } with no err key. data is undefined for 204, 304, content-length 0, or an all-whitespace body. (b) non-2xx with a readable body: { ok: false, status, headers, data: parsed body } with NO err. (c) body not JSON (JSON.parse throws SyntaxError): { ok: false, status, headers, data: undefined, err }. On a 2xx, err is a ProjectNameError with code 'response_json_invalid' or 'response_content_type'. On a non-2xx, err is the 'request_status' error with the response detail appended. A body read that fails for a reason other than SyntaxError (for example a dropped connection) is rethrown, reaches the outer catch, and yields { ok: false, err } with no status or headers. (d) the request cannot be made: { ok: false, err }, holding the transport rejection or a 'request_aborted' error, or a returned Error such as fetch_mode_block, fetch_test_block or fetch_getonly_block, or 'direct_no_response'. A prepare failure (method not allowed, auth) and an allow.op denial also give { ok: false, err }. Failure channel: direct catches inside its try and never throws by design; the Promise resolves. The one exception is this.prepare(fetchargs), which is awaited OUTSIDE the try, so an exception thrown inside prepare would reject the Promise (inferred; I found no such path).
- **evidence**: src/cmp/ts/fragment/Main.fragment.ts:270-276 "ok: null == err && status >= 200 && status < 300," / "status," / "headers: fetched.headers," / "data: json," / "...(null == err ? {} : { err: utility.clean(ctx, err) }),"; :242 "const noBody = 204 === status || 304 === status || '0' === String(contentLength)"; :258-266 "if ('SyntaxError' !== parseErr?.name) {" / "throw parseErr" ... "err = unreadableBody(ctx, {" ... "failed: 200 <= status && status < 300 ? undefined :" / "ctx.error('request_status', ..."; :209-211 "const fetchdef = await this.prepare(fetchargs)" / "return { ok: false, err: utility.clean(this._rootctx, fetchdef) }"; :226-230 "return { ok: false, err: ctx.error('direct_no_response', 'response: undefined') }" / "return { ok: false, err: utility.clean(ctx, abortError(ctx, fetched)) }"; :278-279 "catch (err: any) {" / "return { ok: false, err: utility.clean(ctx, abortError(ctx, err)) }"; :187-191 allow.op denial "return {" / "ok: false," / "err: new Error(..."; tm/ts/src/utility/ResultBodyUtility.ts:75-78 "ctx.error('response_json_invalid', ..." / "ctx.error('response_content_type', ..."; tm/ts/src/utility/FetcherUtility.ts:50,59 "ctx.error('fetch_mode_block', ..." / "ctx.error('fetch_test_block', ..."
- **old page**: The old README says 'on failure `status` holds the HTTP status (for error responses) and `err` holds the error'. That is FALSE for case (b): a non-2xx with a readable body carries no err. It is the shape the graphql() comment at :303-307 relies on ('the raw path represents a non-2xx as { ok: false } with no err'). The old DirectResult block shows { ok, status, headers, data } and says 'On error, ok is false and an err property contains the error': also not true for (b).

### js

- **answer** (read and certain): Same as ts in all four cases. The code is line-for-line the same: ok is written `null == err && status >= 200 && status < 300`, so `true` or `false`. A non-2xx with a readable body gives { ok: false, status, headers, data } with no err. direct never throws, except through prepare, which is awaited outside the try.
- **evidence**: src/cmp/js/fragment/Main.fragment.js:268 "ok: null == err && status >= 200 && status < 300,"; :257 "throw parseErr"; :206-208 "const fetchdef = await this.prepare(fetchargs)" / "return { ok: false, err: utility.clean(this._rootctx, fetchdef) }"; :224 "direct_no_response"; :227, :276 "return { ok: false, err: utility.clean(ctx, abortError(ctx, ...)) }"
- **old page**: The same false claim about err on a non-2xx appears in out/old/B/js/README.md.

### go

- **answer** (read and certain): (a) 2xx: {ok: true, status, headers, data} - no err. (b) non-2xx readable: {ok: false, status, headers, data (the parsed body)} - no err key. (c) body not parseable as JSON (`unreadable`): {ok: false, status, headers, data: nil, err: response_json_invalid / response_content_type error (or request_status with detail when also non-2xx)}. A 204/304/content-length 0 skips parsing: data nil, ok by status. (d) request cannot be made (transport error, body read/decode error, prepare/auth failure, allow.op denied, nil response): {ok: false, err} only - no status/headers/data. ok is the Go bool `true`/`false`. The second return value (error) is ALWAYS nil from Direct: every failure is returned inside the map.
- **evidence**: Main.fragment.go:249-252 "fetchdef, err := sdk.Prepare(fetchargs)" / "return map[string]any{\"ok\": false, \"err\": sdk.cleanErr(sdk.rootctx, err)}, nil"; :276-277 "if fetchErr != nil {" / "return map[string]any{\"ok\": false, \"err\": sdk.cleanErr(ctx, fetchErr)}, nil"; :299 "noBody := status == 204 || status == 304 || contentLength == \"0\""; :309 "if unreadable, _ := vs.GetProp(fm, \"unreadable\").(bool); unreadable {"; :320-325 "\"ok\": bodyErr == nil && status >= 200 && status < 300," / "\"status\": status," / "\"headers\": headers," / "\"data\": jsonData,"; :326-327 "if bodyErr != nil {" / "out[\"err\"] = sdk.cleanErr(ctx, bodyErr)"; :222 "return sdk.opDenied(\"direct\"), nil"; tm/go/utility/fetcher.go:168-170 "unreadable := false" ... "unreadable = json.Unmarshal(bodyBytes, &jsonBody) != nil"; tm/go/core/response.go:96-97 "response_json_invalid"
- **old page**: README "Error handling": "`Direct` follows the same `(value, error)` convention: ... if err != nil { // handle err }" and how-to "if err != nil { panic(err) }" - misleading: Direct never returns a non-nil error, failures are only in result["ok"]/result["err"]. README Result shape lists only "ok", "status", "headers", "data" keys, omitting "err".

### c

- **answer** (read and certain): (a) 2xx: map {ok: true, status, headers, data}. (b) non-2xx readable: {ok: false, status, headers, data} - no err. (c) body not valid JSON: {ok: false, status, headers, data undefined (voxgig_new_undef), err: a STRING message (cleaned)}; 204/304/content-length 0 skip parsing. (d) request cannot be made (transport error, prepare/auth error, op denied, no response, non-map response): {ok: false, err: string message} only. ok is written `v_bool(true)`/`v_bool(false)` (a voxgig bool). Unlike Go, `err` in the map is a string, not an error object. The out-parameter `PNError** err` is set to NULL on entry and never set to an error by sdk_direct in any case.
- **evidence**: src/cmp/c/fragment/Main.fragment.c:173-174 "static voxgig_value* err_map(const char* msg) {" / "return cmap(2, \"ok\", v_bool(false), \"err\", v_str(msg));"; :202-204 "voxgig_value* fetchdef = sdk_prepare(sdk, fetchargs, &perr);" / "if (perr) {" / "return err_map(perr->msg);"; :220-221 "if (ferr) {" / "return err_map(clean_str(ctx, ferr->msg));"; :243-247 "if (no_body) {" / "json_data = voxgig_new_undef();" ... "json_data = voxgig_is_func(jf) ? call_json(jf) : voxgig_new_undef();"; :264-270 "\"ok\", v_bool(NULL == body_err && status >= 200 && status < 300)," ... "setp(out, \"err\", v_str(clean_str(ctx, body_err->msg)));"; :281-282 "voxgig_value* sdk_direct(...)" / "*err = NULL;"; :198 "*err = NULL;"; tm/c/utility/http.c:1273 "voxgig_value* parsed = valid ? voxgig_parse_json(text + bom, len - bom) : voxgig_new_undef();"; :1281 "\"unreadable\", v_bool(!blank && !valid));"
- **old page**: c/README.md: "A non-2xx response carries status + data (the error body); a transport-level failure carries err instead. Only one is present." - false for an unreadable body, where status and err are both present. "`sdk_direct()` never sets `*err` for a non-2xx response" - true but understated: it never sets *err at all. Result-shape table omits err; "On error, `ok` is `false` and `err` carries the error value" does not say it is a string.

### py

- **answer** (read and certain): (a) 2xx: {"ok": True, "status": <int>, "headers": <dict>, "data": <parsed JSON, or None for 204/304/content-length 0>}, with no err key. (b) Non-2xx with a readable body: {"ok": False, status, headers, "data": <parsed body>}, with no err key. (c) Unreadable (non-JSON) body: "ok": False even for a 2xx, plus status, headers and "data": None. "err" is a cleaned error: `response_json_invalid` or `response_content_type` for a 2xx, or a `request_status` error with the response described for a non-2xx. (d) The request could not be made: {"ok": False, "err": <cleaned STRING>}. The default transport returns `str(e)`, so err is a str, not an exception; there are no status, headers or data. If prepare fails, the result is {"ok": False, "err": <cleaned exception>}. `ok` is written `True`/`False`. Failure channel: direct catches every Exception from prepare and returns a dict. It can still raise when a caller-supplied `system.fetch` raises, because the fetcher call is outside any try.
- **evidence**: src/cmp/py/fragment/Main.fragment.py:236-242 "try: fetchdef = self.prepare(fetchargs) / except Exception as err: ... return {\"ok\": False, \"err\": utility.clean(self._rootctx, err)}"; :256 "fetched, fetch_err = utility.fetcher(ctx, url, fetchdef)"; :258-259 "if fetch_err is not None: return {\"ok\": False, \"err\": utility.clean(ctx, fetch_err)}"; :289-294 unreadable handling; :296-304 "\"ok\": body_err is None and status >= 200 and status < 300, ... if body_err is not None: out[\"err\"] = ..."; tm/py/pkg/utility/fetcher.py:105 "return None, str(e)"; :117 "unreadable = True"; tm/py/pkg/utility/result_body.py:44-48 response_json_invalid / response_content_type
- **old page**: py/README.md: direct 'Returns a result dict ... does not raise'. That holds except when a custom system.fetch raises. The old pages do not say that err can be a plain string.

### rb

- **answer** (read and certain): (a) 2xx: { "ok" => true, "status", "headers", "data" => parsed JSON (nil for no body) }, with no "err". (b) Non-2xx readable: "ok" => false, status, headers, "data" => parsed body, with no err. (c) Unreadable body: "ok" => false, status, headers, "data" => nil, and "err" => a cleaned ProjectNameError: response_json_invalid or response_content_type, or the request_status error with detail for a non-2xx. When the failed error is not a ProjectNameError, err is a plain RuntimeError. (d) Not made: { "ok" => false, "err" => cleaned String "<ExceptionClass>: <message>" }. `ok` is written `true`/`false`. Failure channel: raw_request rescues ONLY ProjectNameError from prepare (py rescues every Exception), so any other StandardError raised in prepare propagates. A raising system.fetch also propagates.
- **evidence**: src/cmp/rb/fragment/Main.fragment.rb:211-215 "begin / fetchdef = prepare(fetchargs) / rescue ProjectNameError => err / return { \"ok\" => false, \"err\" => err }"; :228 "return { \"ok\" => false, \"err\" => utility.clean.call(ctx, fetch_err) } if fetch_err"; :258-263 unreadable; :266-272 "\"ok\" => body_err.nil? && status >= 200 && status < 300"; tm/rb/utility/fetcher.rb:224 "return nil, \"#{e.class}: #{e.message}\""; tm/rb/utility/result_body.rb:32 "return RuntimeError.new(message) unless failed.is_a?(ProjectNameError)"
- **old page**: rb/REFERENCE.md:84-86: '`{ "ok" => ..., "status" => ..., "data" => ..., "err" => ... }`; it does not raise'. The page omits headers, and 'does not raise' holds only for ProjectNameError. The prepare-failure err is also not passed through clean in rb, unlike py.

### php

- **answer** (read and certain): (a) 2xx with a readable body: ['ok'=>true,'status'=>int,'headers'=>array,'data'=>parsed JSON], with no err. (b) Non-2xx with a readable body: ok false, plus status, headers and data (the parsed error body), with no err. (c) A body that is not valid JSON (`unreadable`): ok false even on a 2xx, status, headers, data null, and err set to a cleaned ProjectNameError. On a 2xx that error is response_json_invalid or response_content_type; on a non-2xx it is request_status with the detail. 204, 304 and content-length 0 skip parsing, so data is null and ok follows the status. (d) The request cannot be made: ['ok'=>false,'err'=>...] with no status, headers or data. With the default transport that err is a plain STRING (the curl_error text or the stream warning), not an object. A prepare failure gives ['ok'=>false,'err'=>Throwable]. direct's own failure channel: it catches only prepare's throw. A throwing custom system.fetch, or the fetcher, is not caught, so the exception escapes direct. ok is written as true or false.
- **evidence**: fragment/Main.fragment.php:259-263 "try { $fetchdef = $this->prepare($fetchargs); } catch (\Throwable $err) { return ["ok" => false, "err" => $err]; }"; :274 "[$fetched, $fetch_err] = ($utility->fetcher)($ctx, $url, $fetchdef);" (not in try); :276-277 "if ($fetch_err) { return ["ok" => false, "err" => ($utility->clean)($ctx, $fetch_err)];"; :308-317 unreadable -> ProjectNameResultBody::unreadable; :322 "\"ok\" => null === $body_err && $status >= 200 && $status < 300,"; :327-328 "if (null !== $body_err) { $out[\"err\"] = ..."; tm/php/utility/Fetcher.php:296-306 "$err = curl_error($ch) ?: 'curl_exec failed'; return [[ 'status' => 0, ...], $err,];"; :216-217 "$warning = error_get_last()['message'] ?? 'request failed'; return [null, preg_replace(...)]"; :329-331 "$decoded = json_decode($response_body, true); if (json_last_error() === JSON_ERROR_NONE) {...} else { $unreadable = true; }"; tm/php/utility/ResultBody.php:55-60 response_json_invalid / response_content_type
- **old page**: The old page says `ok` is `true if the HTTP status is 2xx`, which is false for a 2xx with an unreadable body. It says err "holds a transport error", but err is also set for an unreadable body. Its example calls `$err->getMessage()`, which is a fatal error when err is the plain string the default transport returns.

### perl

- **answer** (read and certain): (a) 2xx: {ok=>1,status,headers,data=>parsed JSON}, with no err. (b) Non-2xx with a readable body: {ok=>0,status,headers,data=>error body}, with no err. (c) A body that is not valid JSON: {ok=>0,status,headers,data=>undef,err=>cleaned error}, also on a 2xx. On a non-2xx the error is request_status with the detail; on a 2xx it comes from unreadable_body. 204, 304 and content-length 0 skip parsing. (d) The request cannot be made: {ok=>0, err=>...}, with no status, headers or data. With the default transport err is a plain STRING: the die text, or HTTP::Tiny's 599 content. A prepare failure gives err=>$@. ok is written as 1 or 0. Failure channel: direct traps only prepare's die (in an eval). The fetcher call is not in an eval, so a dying custom system.fetch propagates out of direct. _op_denied's err is a plain string here, where PHP uses a ProjectNameError.
- **evidence**: fragment/Main.fragment.pm:243-246 "my $fetchdef = eval { $self->prepare($fetchargs) }; if (my $prep_err = $@) { return { 'ok' => 0, 'err' => $prep_err };"; :258 "my ($fetched, $fetch_err) = $utility->{fetcher}->($ctx, $url, $fetchdef);"; :260 "return { 'ok' => 0, 'err' => $utility->{clean}->($ctx, $fetch_err) } if $fetch_err;"; :289-295 unreadable -> unreadable_body; :300 "'ok' => (!defined $body_err && $status >= 200 && $status < 300) ? 1 : 0,"; :305 "$out->{err} = $utility->{clean}->($ctx, $body_err) if defined $body_err;"; :227 "'err' => \"ProjectNameSDK: $op: operation not allowed by\""; tm/perl/utility/fetcher.pm:155-158 "my $e = (defined $@ && length $@) ? \"$@\" : 'request failed'; ... return (undef, $e);"; :163-167 599 -> "return (undef, $reason);"; :189-191 "my $parsed = eval { $json_body = Voxgig::Struct::parse_json($content); 1 }; $unreadable = 1 unless $parsed;"
- **old page**: The old page says `ok` is "True if the HTTP status is 2xx", which is false for a 2xx with an unreadable body. Its how-to comment says "A non-2xx response carries status + data (the error body); a transport-level failure carries err instead. Only one is present", but an unreadable body carries status and err together.

### lua

- **answer** (read and certain): direct returns a table and a second value that is always nil. (a) 2xx with JSON: {ok = true, status, headers, data = parsed body}, no err. A 204/304 or content-length 0 response gives data nil. (b) non-2xx with a readable JSON body: {ok = false, status, headers, data = parsed body}, no err key. (c) unreadable (non-JSON) body: {ok = false, status, headers, data = nil, err = cleaned error}. The error code is response_json_invalid or response_content_type, or request_status with details when the status is not 2xx, so a 2xx with an unreadable body is ok = false. (d) request cannot be made: {ok = false, err = cleaned transport error}, with no status, headers or data. A prepare failure gives {ok = false, err = err} without cleaning, and a denied allow.op gives {ok = false, err = string}. The second return value is never set. An error() raised inside a custom system.fetch is not caught by pcall and propagates as a Lua error. That last point is read and inferred.
- **evidence**: S/src/cmp/lua/fragment/Main.fragment.lua:298-300: "local fetchdef, err = self:prepare(fetchargs)" / "if err ~= nil then" / "return { ok = false, err = err }, nil"; :312: "local fetched, fetch_err = utility.fetcher(ctx, url, fetchdef)"; :314-315: "if fetch_err ~= nil then" / "return { ok = false, err = utility.clean(ctx, fetch_err) }, nil"; :335: "local no_body = status == 204 or status == 304 or tostring(content_length) == \"0\""; :348-355: "if vs.getprop(fetched, \"unreadable\") == true then" ... "body_err = unreadable_body(...)"; :359-368: "ok = body_err == nil and status >= 200 and status < 300," ... "out.err = utility.clean(ctx, body_err)" / "return out, nil"; S/tm/lua/utility/fetcher.lua:281-282: "if not res then" / "return nil, code"; :304-309 unreadable on JSON decode failure; S/tm/lua/utility/unreadable_body.lua:62-67 response_json_invalid / response_content_type
- **old page**: README.md:59-68: '`direct` follows the same `(value, err)` convention' with 'if err then error(err) end'. That is false: the second value is always nil, and failures are in result.ok/result.err. README.md:248-249 lists only ok, status, headers, data and omits err.

### elixir

- **answer** (read and certain): direct returns one struct-map node, read with Voxgig.Struct.getprop. There is no tuple. (a) 2xx: "ok" true, status, headers, data = parsed JSON, no err. 204/304/content-length 0 gives data nil. (b) non-2xx with a readable body: "ok" false, status, headers, data = parsed body, no err. (c) unreadable body: "ok" false, status, headers, data nil, err = cleaned error (response_json_invalid / response_content_type, or request_status when not 2xx). A 2xx with an unreadable body is ok false. (d) transport failure: {"ok" false, "err" cleaned error}, which is the inspect() of the :httpc reason for the default transport. A prepare failure, which raises, is rescued into {"ok" false, "err" exception struct} without cleaning. No second return exists and direct does not raise for these cases. The fetcher call is not inside a try, so an exception raised by a custom system.fetch would propagate. That last point is read and inferred.
- **evidence**: S/src/cmp/elixir/fragment/Main.fragment.ex:207-216: "try do" / "prepare(client, fetchargs)" / "rescue" / "err -> {:direct_err, err}" ... "S.jm([\"ok\", false, \"err\", err])"; :224: "{fetched, fetch_err} = Utility.fetcher(ctx, url, fetchdef)"; :227-228: "fetch_err != nil ->" / "S.jm([\"ok\", false, \"err\", Utility.clean(ctx, fetch_err)])"; :240: "no_body = status in [204, 304] or to_string(content_length) == \"0\""; :273-276: "S.jm([\"ok\", body_err == nil and status >= 200 and status < 300," ... "if body_err != nil, do: S.setprop(out, \"err\", Utility.clean(ctx, body_err))"; S/tm/elixir/lib/projectname/utility.ex:2580-2581: "{:error, reason} ->" / "{nil, inspect(reason)}"
- **old page**: README.md:276: '`ok` ... `true` if the HTTP status is 2xx'. That is incomplete: a 2xx with an unreadable body gives ok false with err. README.md:281: 'On error, `ok` is `false` and `err` carries the error value'. A readable non-2xx has no err. README.md:106 and REFERENCE.md:83 say 'never raises', which holds for prepare and transport errors.

### java

- **answer** (read and certain): (a) 2xx: ok=true, status, headers, data (parsed JSON; null for 204/304/content-length 0); no err key. (b) non-2xx readable: ok=false, status, headers, data (the error body); no err. (c) unreadable body: ok=false (even if 2xx), status, headers, data=null, err = cleaned SdkError response_json_invalid / response_content_type (for non-2xx: request_status with detail appended). (d) cannot be made (prepare throws, fetcher throws incl. fetch_mode_block, invalid url, IO): only ok=false and err (cleaned); also null response -> err direct_no_response, non-map -> direct_invalid; allow.op denial -> ok=false, err direct_allow. ok is written `true`/`false` (Java Boolean). direct itself never throws: every failure is caught into the map; there is no second channel.
- **evidence**: tm/java/core/SdkClient.java:310-316 "fetchdef = this.prepare(fetchargs);" "catch (RuntimeException err) {" "out.put(\"ok\", false);" "out.put(\"err\", utility.clean.apply(ctx, err));"; :325-327; :331-333 "out.put(\"err\", ctx.makeError(\"direct_no_response\", \"response: undefined\"));"; :351 "boolean noBody = status == 204 || status == 304 || \"0\".equals(contentLength);"; :361-366 "if (Boolean.TRUE.equals(Struct.getprop(fm, \"unreadable\"))) {"; :370-376 "out.put(\"ok\", bodyErr == null && status >= 200 && status < 300);" "out.put(\"status\", status);" "out.put(\"headers\", headers);" "out.put(\"data\", jsonData);" "if (bodyErr != null) {" "out.put(\"err\", utility.clean.apply(ctx, bodyErr));"; tm/java/utility/Fetcher.java:164-170 parse failure sets "unreadable = true;"; tm/java/core/Context.java:270-271 makeError returns, does not throw
- **old page**: README how-to: "A non-2xx response carries status + data (the error body); a transport-level failure carries err instead. Only one is present" - false for case (c), where status AND err are both present. README result table: "`ok` ... `true` if the HTTP status is 2xx." - false for a 2xx with an unreadable body (ok false).

### kotlin

- **answer** (read and certain): Identical logic to java: (a) ok=true,status,headers,data; (b) ok=false,status,headers,data, no err; (c) ok=false,status,headers,data=null,err; (d) ok=false,err only. ok written `true`/`false`. direct never throws.
- **evidence**: tm/kotlin/core/SdkClient.kt:287-292 "fetchdef = this.prepare(fetchargs)" "} catch (err: RuntimeException) {" "out[\"ok\"] = false" "out[\"err\"] = utility.clean(ctx, err)"; :297-302; :305-307; :335-340 "if (true == Struct.getprop(fm, \"unreadable\")) {"; :343-349 "out[\"ok\"] = bodyErr == null && status in 200..299" "out[\"status\"] = status" "out[\"headers\"] = headers" "out[\"data\"] = jsonData" "if (bodyErr != null) {" "out[\"err\"] = utility.clean(ctx, bodyErr)"
- **old page**: Same false 'Only one is present' comment (README:104-105) and '`ok` true if the HTTP status is 2xx' (README:246).

### scala

- **answer** (read and certain): (a) 2xx: ok = java.lang.Boolean.valueOf(true), status = the Integer code, headers = the response header map, data = parsed JSON (null for 204, 304, content-length 0 or an empty body); there is no err. (b) Non-2xx with a readable body: ok = FALSE, status, headers, and data = the parsed body; there is NO err. (c) Unreadable body (not JSON): ok = FALSE, status, headers, data = null, and err = a SdkError: `response_json_invalid` or `response_content_type` for a 2xx, or `request_status` with detail added for a non-2xx. (d) The request cannot be made (prepare throws, for example on a method allow, or the fetcher throws on a network error, a mode block or the test block): only ok = FALSE and err (the cleaned throwable; a network failure is a RuntimeException('fetch: ...')). There is no status, headers or data. A null fetch result gives err `direct_no_response`, and a non-map result gives `direct_invalid`. A denied `allow.op` gives ok FALSE and err SdkError('direct_allow'). Failure channel: direct returns a map and does not throw on any of these paths. The one call outside a try is the `json` Supplier (:296), which can throw only if a custom system.fetch supplies a throwing Supplier.
- **evidence**: tm/scala/core/SdkClient.scala:258-262 `try this.prepare(fetchargs)` `catch { case NonFatal(err) =>` `out.put("ok", java.lang.Boolean.FALSE); out.put("err", cleanErr(ctx, err)); return out`; :265-269 (same for utility.fetcher); :271-274 `out.put("err", ctx.makeError("direct_no_response", "response: undefined"))`; :290 `val noBody = status == 204 || status == 304 || "0" == contentLength`; :296 `case jf: Supplier[_] => jsonData = jf.asInstanceOf[Supplier[Object]].get()`; :299-303 `if (java.lang.Boolean.TRUE == Struct.getprop(fm, "unreadable")) {` ... `bodyErr = Response.unreadableBody(...)`; :307 `out.put("ok", java.lang.Boolean.valueOf(bodyErr == null && status >= 200 && status < 300))`; :308-311 status, headers, data, `if (bodyErr != null) out.put("err", cleanErr(ctx, bodyErr))`; :176 `out.put("err", new SdkError(op + "_allow",`; tm/scala/utility/Fetcher.scala:106 `catch { case e: Exception => throw new RuntimeException("fetch: " + e.getMessage, e) }`; :122 `catch { case _: RuntimeException => unreadable = true; null }`; tm/scala/core/Response.scala:57-62 response_json_invalid / response_content_type
- **old page**: README:249 says '`ok` ... `true` if the HTTP status is 2xx', which is false for a 2xx with an unreadable body. README:254 and README:72-73 say 'On error, `ok` is `false` and `err` contains the error value', which is false for a non-2xx with a readable body: there is no err. REFERENCE:88-90 says '`data` (or `err` on failure)', which is wrong in the same way.

### csharp

- **answer** (read and certain): The same shape as Scala. (a) 2xx: ok = `true` (a boxed bool), status = the int, headers = the Dictionary, data = parsed JSON (null for 204, 304, content-length 0 or a blank body); there is no err. (b) Non-2xx with a readable body: ok = `false`, status, headers, data = the parsed body; there is NO err. (c) Unreadable body: ok = `false`, status, headers, data = null, err = a ProjectNameError from UnreadableBody (`request_status` for a non-2xx). (d) The request cannot be made (Prepare throws, or the fetcher throws, for example an HttpRequestException, a fetch_mode_block or a fetch_test_block): only ok = `false` and err (the cleaned Exception). A null result gives `direct_no_response`, and a non-dictionary result gives `direct_invalid`. A denied allow.op gives ok false and err = a plain `System.Exception` with no code (Scala uses SdkError 'direct_allow'). Failure channel: Direct returns a Dictionary and does not throw on these paths. The `json` Func call (:312) is outside a try and would throw only if a custom fetch supplied a throwing Func.
- **evidence**: src/cmp/csharp/fragment/Main.fragment.cs:244-254 `fetchdef = Prepare(fetchargs);` `catch (Exception err)` ... `["ok"] = false,` `["err"] = CleanErr(_rootctx, err),`; :271-281 the same for `utility.Fetcher`; :289 `["err"] = ctx.MakeError("direct_no_response", "response: undefined"),`; :306 `var noBody = status == 204 || status == 304 || contentLength == "0";`; :312 `jsonData = jf();`; :316-322 unreadable to `Response.UnreadableBody`; :325-335 `["ok"] = bodyErr == null && status >= 200 && status < 300,` `["status"] = status,` `["headers"] = headers,` `["data"] = jsonData,` ... `direct["err"] = CleanErr(ctx, bodyErr);`; :229 `["err"] = new Exception("ProjectNameSDK: " + op +`
- **old page**: README:264 says '`true` if the HTTP status is 2xx' and :269 'On error, `ok` is `false` and `err` contains the error value'. Both are false in the same cases as Scala: an unreadable 2xx gives ok false, and a readable non-2xx has no err. README:74-77 says the same and shows a TypeScript block.

### swift

- **answer** (read and certain): (a) 2xx with a readable body: ok `.bool(true)`, status `.int(...)`, headers, data (the parsed JSON, or `.noval` for 204/304/content-length 0), and no err key. (b) Non-2xx with a readable body: ok `.bool(false)`, status, headers, and data (the parsed error body). There is no err key. (c) Unreadable body: the transport marks unreadable=true, and json() returns `.noval`. The result has ok `.bool(false)`, even for a 2xx status, plus status, headers, data `.noval`, and err `.nat(error)`. The error is response_json_invalid or response_content_type, or a request_status error with the body described when the status is non-2xx. (d) Request cannot be made: if prepare throws or the fetcher throws (URL unparseable, URLSession error, mode/test block, GET-only guard), the result is only ok `.bool(false)` and err `.nat(error)`, with no status, headers or data. A nil response gives err direct_no_response, and a non-map response gives direct_invalid. The function's own failure channel: direct is not declared `throws`, so it never throws and never uses a second return value. A denied allow.op also comes back as ok false plus err.
- **evidence**: src/cmp/swift/fragment/Main.fragment.swift:162 "public func direct(_ fetchargsIn: ProjectNameSdk.VMap?) -> ProjectNameSdk.VMap {" (no throws); :196-202 "fetchdef = try prepare(fetchargsIn) } catch { ... r.entries[\"ok\"] = .bool(false) r.entries[\"err\"] = utility.clean(rootctx, .nat(error))"; :213-219 (fetcher catch, same shape); :247 "if !noBody, gp(fm, \"unreadable\") == .bool(true) {"; :258 "r.entries[\"ok\"] = .bool(bodyErr == nil && status >= 200 && status < 300)"; :259-263 (status, headers, data, err only when bodyErr); tm/swift/Sources/ProjectNameSDK/utility/Fetcher.swift:189-190 "if let parsed = try? JSON.parse(bodyText) { jsonBody = parsed } else { unreadable = true }"; :171 "if let e = box.err { throw e }"; core/Response.swift:57-60 (response_json_invalid / response_content_type).
- **old page**: B/swift/README.md:265 "`ok` | `Bool` | `true` if the HTTP status is 2xx." This is false for case (c). README.md:118-120 "A non-2xx response carries status + data ...; a transport-level failure carries err instead. Only one is present" is false for case (c), where status and err are both present.

### cpp

- **answer** (read and certain): (a) 2xx with a readable body: ok `Value(true)`, status `Value(int)`, headers, data (the JSON injector's result, or undef for 204/304/content-length 0), and no err. (b) Non-2xx with a readable body: ok `Value(false)`, status, headers, data (the error body), and no err. (c) Unreadable body (fetched.unreadable == true): ok `Value(false)`, even for a 2xx status, plus status, headers, data (whatever json() returned), and err. (d) Request cannot be made: if prepare or the fetcher throws an SdkErrorPtr, the result is only ok `Value(false)` and err; a nullish response gives direct_no_response, and a non-map response gives direct_invalid. Live requests always land in (d) unless options.system.fetch is supplied: the runtime has no built-in HTTP transport, and the fetcher throws fetch_no_transport. Unlike Swift, err is a plain map {"message": string}, not an error object, and carries no code. The function's own failure channel: direct returns Value, has no out-parameter, and normally does not throw. It catches only `const SdkErrorPtr&`, so a std::exception thrown from inside, such as one raised by a system.fetch callable, would propagate out of direct (inferred).
- **evidence**: tm/cpp/core/types.hpp:1231-1236 "try { fetchdef = this->prepare(fetchargs); } catch (const SdkErrorPtr& err) { map_put(out, \"ok\", Value(false)); map_put(out, \"err\", vmap({{\"message\", Value(err->msg)}}));"; :1241-1246 (fetcher catch, same shape); :1278 "if (!noBody && ur.is_bool() && ur.as_bool()) {"; :1289 "map_put(out, \"ok\", Value(!bodyErr && status >= 200 && status < 300));"; :1290-1293 (status, headers, data, err only if bodyErr); tm/cpp/utility/pipeline.hpp:610-613 "// No live HTTP transport is built into the generated C++ SDK; supply a system.fetch callable ... throw ctx->makeError(\"fetch_no_transport\",".
- **old page**: B/cpp/README.md:120-123 "A non-2xx response carries status + data ...; a transport-level failure carries err instead. Only one is present." This is false for case (c). README.md:252 "`ok` | `bool` | `true` if the HTTP status is 2xx." is false for (c). README.md:127 "it never throws" is true only for SdkErrorPtr failures.

### zig

- **answer** (read and certain): direct returns a bare `Value` and has no failure channel at all. (a) 2xx: {ok: h.vbool(true), status, headers, data: the parsed JSON, or JSON null for 204/304/content-length 0}. (b) Non-2xx with a readable body: {ok: h.vbool(false), status, headers, data: the parsed body}, with no err. (c) Unreadable body: {ok: h.vbool(false) even on a 2xx, status, headers, data (what the json thunk gives), err: a cleaned message}. (d) Cannot be made: {ok: false, err: the pending_err message, or "fetch failed"/"prepare failed"}, with no status, headers or data.
- **evidence**: src/cmp/zig/fragment/Main.fragment.zig:237 `pub fn direct(self: *ProjectNameSDK, fetchargs_in: Value) Value {`; :268-272 `const fetchdef = self.prepare(fetchargs_in) catch { return h.jo(&.{ .{ "ok", h.vbool(false) }, .{ "err", h.vstr(if (self.rootctx.?.pending_err) |e| e.msg else "prepare failed") },`; :290-294 `... catch { return h.jo(&.{ .{ "ok", h.vbool(false) }, .{ "err", h.vstr(if (ctx.pending_err) |e| ... else "fetch failed") },`; :315 `const json_data: Value = if (no_body) h.vnull() else blk: {`; :320-332 unreadable branch returns ok false, status, headers, data, err; :335-340 `.{ "ok", h.vbool(200 <= status and status < 300) }, .{ "status", h.vnum(status) }, .{ "headers", headers }, .{ "data", json_data },`
- **old page**: zig/README.md: "The `direct()` escape hatch returns a result `Value` map directly (no error union)". Correct. Its comment "Only one is present" is false for (c).

### rust

- **answer** (read and certain): direct always returns `Ok(map)`; its `Err` channel is never set by direct itself (every path returns `Ok`). (a) 2xx: {ok: Value::Bool(true), status, headers, data: the parsed JSON, or Value::Noval for 204/304/content-length 0}, with no err. (b) Non-2xx with a readable body: {ok: Value::Bool(false), status, headers, data: the parsed error body}, with no err. (c) Body not parseable as JSON (`unreadable`): {ok: Value::Bool(false) EVEN FOR A 2xx, status, headers, data: Value::Noval, err: a cleaned message ("response: body is not valid JSON (...)" or "response: expected JSON, got ... (...)", or for a non-2xx "request: <status>: <text> (...)")}. A body that fails to READ as text (an IO error) comes back from the fetcher as Err and is reported like (d). (d) Cannot be made (transport error, prepare failure, mode block): {ok: Value::Bool(false), err: message}, with no status, headers or data. When allow.op denies direct, the result is {ok:false, err}.
- **evidence**: src/cmp/rust/fragment/Main.fragment.rs:212-218 `pub fn direct(...) -> Result<Value, ProjectNameError> {` `return Ok(self.op_denied("direct"));` `self.raw_request(fetchargs)`; :245-251 prepare Err -> `return Ok(jo(vec![("ok", Value::Bool(false)), ("err", Value::str(err.msg.clone())),]))`; :272-277 fetch Err -> `("ok", Value::Bool(false)), ("err", Value::str(utility.clean_str(&ctx, &err.msg)))`; :300 `let no_body = status == 204 || status == 304 || content_length == "0";`; :313 `let body_err = if !no_body && getp(&fetched, "unreadable") == Value::Bool(true) {`; :327 `("ok", Value::Bool(body_err.is_none() && (200..300).contains(&status))),`; :330 `("data", json_data),`; :332-333 `if let Some(err) = body_err { out.push(("err", ...`; tm/rust/utility/fetcher.rs:140-141 `resp.into_string().map_err(|e| ProjectNameError::new("fetch_body", ...))?`; :150-151 `let unreadable = parsed.is_err();` `let json_body = parsed.unwrap_or(Value::Noval);`; tm/rust/core/response.rs:77-86 the two messages
- **old page**: rust/README.md: "A non-2xx response carries status + data (the error body); a transport-level failure carries err instead. Only one is present." This is false for (c), where status, headers, data and err are all present, and ok is false even on a 2xx. It also says: "The `direct()` escape hatch resolves to `Ok` even on a non-2xx response". That is correct; in fact it is always Ok.

### clojure

- **answer** (read and certain): The result is a java Map with string keys. (a) 2xx: `ok` true, plus `status`, `headers` and `data` (the parsed JSON, or nil for 204/304/content-length 0); no `err`. (b) Non-2xx with a readable body: `ok` false, `status`, `headers`, `data` holding the error body; no `err`. (c) Unreadable body (transport flag `unreadable`): `ok` false, `status`, `headers`, `data` nil, and `err` holding a cleaned SDK error map (response_json_invalid, response_content_type, or request_status with details). This happens even when the status is 2xx. (d) The request cannot be made: if prepare fails, or the fetcher returns an error such as fetch_transport, fetch_mode_block or fetch_test_block, the result is `{ok false, err}` with no status, headers or data. Nil and non-map responses give direct_no_response and direct_invalid. A denied op gives `{ok false, err <string>}`. `ok` is written as Clojure `true`/`false`. Failure channel: direct does not throw for these cases (prepare's ExceptionInfo is caught). It does not catch other Throwables, such as one thrown by a caller's system.fetch, so those propagate.
- **evidence**: tm/clojure/src/sdk/client.clj:130-131 `pr (try {:fd (prepare client fetchargs)} (catch clojure.lang.ExceptionInfo e {:err (core/ex->sdk e)}))`; :135 `(vs/jm "ok" false "err" (core/ucall (core/client-root-ctx client) :clean (:err pr)))`; :142 `fetch-err (vs/jm "ok" false "err" (core/ucall ctx :clean fetch-err))`; :143 `(nil? fetched) (vs/jm "ok" false "err" (core/ctx-error ctx "direct_no_response" "response: undefined"))`; :152 `body-err (when (and (not no-body) (true? (vs/getprop fetched "unreadable")))`; :158-160 `out (vs/jm "ok" (and (nil? body-err) (>= status 200) (< status 300)) "status" status "headers" headers "data" json-data)] (when body-err (vs/setprop out "err" ...))`; :162 `"direct_invalid" "invalid response type"`; core.clj:1883-1885 sets `"unreadable" unreadable`
- **old page**: README.md:116-117 says 'A non-2xx response carries status + data (the error body); a transport-level failure carries err instead. Only one is present.' Case (c) is false: status and err are both present. REFERENCE.md:83 and README.md:264 say 'never raises', which overstates it (see above).

### ocaml

- **answer** (read and certain): The result is a struct `value` Map. (a) 2xx: `ok` = `Bool true`, plus `status` (Num), `headers` and `data`; no err. (b) Non-2xx with a readable body: `ok` = `Bool false`, `status`, `headers`, `data` holding the error body; no `err`. (c) Unreadable body: `ok` = `Bool false`, `status`, `headers`, `data` Noval, and `err`, a cleaned `{code, message}` map. This happens even for 2xx. (d) The request cannot be made: `{ok: Bool false, err}` only. NOTE that without `options.system.fetch` or the test feature, EVERY live request is case (d). The runtime bundles no HTTP transport, and the fetcher returns `fetch_no_transport`. A prepare failure, a mode or test block, and a nil or non-map response are also case (d). A denied op gives `err` as a `Str`. Failure channel: direct catches `Sdk_error_exc` from prepare and returns the map. It does not catch other OCaml exceptions, such as one raised inside a caller's system.fetch `Func`; those propagate.
- **evidence**: tm/ocaml/sdk_features.ml:1786-1787 `match (try `Ok (prepare client fetchargs) with Sdk_error_exc e -> `Err e) with | `Err e -> jo [("ok", Bool false); ("err", err_to_value e)]`; :1793 `| Some fe -> jo [("ok", Bool false); ("err", u.u_clean ctx (err_to_value fe))]`; :1806-1810 `let body_err = if not no_body && getp fetched "unreadable" = Bool true then ...`; :1812-1817 `| Some e -> jo [("ok", Bool false); ("status", vint_of status); ("headers", headers); ("data", json_data); ("err", ...)] | None -> jo [("ok", Bool (status >= 200 && status < 300)); ...`; tm/ocaml/sdk_runtime.ml:148-149 `let err_to_value (e : sdk_error) : value = jo [("code", Str e.err_code); ("message", Str e.err_msg)]`; sdk_runtime.ml:1573-1579 `(* No live HTTP transport is bundled (dependency-free build) ... *) ... (Noval, Some (ctx_make_error ctx "fetch_no_transport" "No live HTTP transport in this build; provide options.system.fetch."))`
- **old page**: README.md:104-105 says 'A non-2xx response carries status + data ...; a transport failure carries err instead', which is false for case (c). README.md:243 says 'never raises', which overstates it. The pages never say that there is no live transport.


## 10. The test constructor without the test feature

### ts

- **answer** (read and inferred): It fails, with no fallback to BaseFeature. DemoSDK.test() sets sdkopts.feature.test = { active: true, ... } and calls new DemoSDK(sdkopts). makeOptions puts 'test' first in __derived__.featureorder. The constructor loop finds fopts.active true. The hasFeature skip applies only when an extend instance carries that name, so it calls config.makeFeature('test'). FEATURE_CLASS has no 'test' entry in an SDK generated without the feature, so `new fc()` evaluates `new undefined()` and throws a TypeError ('fc is not a constructor'). The error propagates synchronously out of the constructor and out of DemoSDK.test() (and tester()).
- **evidence**: src/cmp/ts/fragment/Main.fragment.ts:334-337 "setprop(testopts, 'active', true)" / "setpath(sdkopts, 'feature.test', testopts)" / "const testsdk = new ProjectNameSDK(sdkopts)"; :76-87 "for (const fname of featureorder) {" ... "if (!this._rootctx.config.hasFeature(fname) &&" / "extend.some((f: any) => fname === f.name)) {" ... "featureAdd(this._rootctx, this._rootctx.config.makeFeature(fname))"; tm/ts/src/utility/MakeOptionsUtility.ts:101-105 "let names = Object.keys(opts.feature || {}).sort()" ... "['test'].concat(...)"; src/cmp/ts/fragment/Config.fragment.ts:18-21 "makeFeature(this: any, fn: string) {" / "const fc = FEATURE_CLASS[fn]" / "const fi = new fc()"; Config_ts.ts:103-106 FEATURE_CLASS is filled only from targetFeatures(model, target) "Line(` ${f.name}: ${nom(f, 'Name')}Feature,`)"
- **old page**: out/old/no-test/ts/README.md:125-141 still documents '### Use test mode' with `DemoSDK.test()` and `client.tester()`, and no-test/ts/REFERENCE.md:32-47 says it returns 'DemoSDK instance in test mode'. In such an SDK both throw. The no-test root README also keeps the 'Offline unit testing' section.

### js

- **answer** (read and inferred): Same as ts: makeFeature('test') does `new FEATURE_CLASS['test']()` with an undefined class, which throws a TypeError ('fc is not a constructor'). There is no BaseFeature fallback. A comment even reads 'TODO: errors etc'.
- **evidence**: src/cmp/js/fragment/Config.fragment.js:29-33 "makeFeature(fn) {" / "const fc = FEATURE_CLASS[fn]" / "const fi = new fc()" / "// TODO: errors etc"; Main.fragment.js:81 "featureAdd(this._rootctx, this._rootctx.config.makeFeature(fname))"; :334 "static test(testoptsarg, sdkoptsarg) {"
- **old page**: out/old/no-test/js/README.md:131-147 documents `DemoSDK.test()` / `client.tester()`.

### go

- **answer** (read and inferred): It does not fail at construction: makeFeature has no case for "test" and falls back to the base (no-op) feature. Trace: TestSDK sets testopts active=true at sdkopts.feature.test, calls NewDemoSDK, then sets Mode "test"; the constructor sets Mode "test" too and calls makeFeature("test"), whose `default:` returns NewBaseFeatureFunc(). No mock transport is installed, so every operation/Direct reaches the real fetcher, which refuses: error code `fetch_mode_block` ("Request blocked by mode: \"test\" ...") - an op returns it as its error; Direct returns {ok:false, err}.
- **evidence**: Main.fragment.go:400 "testopts[\"active\"] = true"; :402 "vs.SetPath(sdkopts, []any{\"feature\", \"test\"}, testopts)"; :404-405 "sdk := NewProjectNameSDK(sdkopts)" / "sdk.Mode = \"test\""; :39-40 "if vs.GetPath(sdk.options, []any{\"feature\", \"test\", \"active\"}) == true {" / "sdk.Mode = \"test\""; :59 "sdk.utility.FeatureAdd(sdk.rootctx, makeFeature(fname))"; Config_go.ts:259 "func makeFeature(name string) Feature {"; :266 "case \"${f.name}\":" (one per model feature only); :274-276 "default:" / "if NewBaseFeatureFunc != nil {" / "return NewBaseFeatureFunc()"; tm/go/feature/base_feature.go:45 "func (f *BaseFeature) Init(ctx *core.Context, options map[string]any)  {}"; tm/go/utility/fetcher.go:221-222 "if ctx.Client.Mode != \"live\" {" / "return nil, ctx.MakeError(\"fetch_mode_block\","
- **old page**: no-test/go/README.md:141 "Create a mock client for unit testing — no server required:" and :221 "Creates a test-mode client with mock transport." - false in an SDK without the test feature: there is no mock transport and every request fails with fetch_mode_block.

### c

- **answer** (read and inferred): Same as Go: no failure at construction; make_feature falls back to the base feature for "test". Trace: test_sdk clones opts, sets feature.test {active:true}, calls demo_sdk_new, then sets mode "test"; the constructor also sets mode "test" and calls make_feature("test"), which has no strcmp branch for it (branches only for model features) and returns feature_base_new(). With no mock transport, every request hits fetcher_util, which refuses with code `fetch_mode_block`: an op returns NULL with *err set; sdk_direct returns {ok:false, err:"...Request blocked by mode..."}.
- **evidence**: Main.fragment.c:349 "setp(testopts, \"active\", v_bool(true));"; :353 "voxgig_setpath(sdkopts, path, testopts, NULL);"; :355-357 "ProjectNameSDK* sdk = projectname_sdk_new(sdkopts);" ... "sdk->mode = strdup(\"test\");"; :66 "feature_add_util(rootctx, make_feature(fname));"; src/cmp/c/Config_c.ts:452 "Feature* make_feature(const char* name) {"; :455 "if (strcmp(name, \"${fname}\") == 0) return feature_${fname}_new();"; :459 "return feature_base_new();"; tm/c/utility/fetcher.c:200-205 "const char* mode = client->mode;" / "if (strcmp(mode, \"live\") != 0) {" ... "*err = context_make_error(ctx, \"fetch_mode_block\", buf);"
- **old page**: c/README.md "### test_sdk ... Creates a test-mode client with mock transport." - false in an SDK generated without the test feature (no-test model; not separately read for C).

### py

- **answer** (read and inferred): `DemoSDK.test()` sets feature.test = {active: True} in sdkopts (lines 366-368) and constructs the client. Validation passes, because the generated feature optspec is an OPEN map whose children accept any name. `featureorder` puts "test" first. The constructor calls `_make_feature("test")`, and with no TestFeature class the factory falls back to `BaseFeature()`, a no-op. Construction succeeds and mode is "test". But there is no mock transport: every request then fails in the fetcher with `fetch_mode_block` ('Request blocked by mode: "test"'). So ops raise ProjectNameError, and direct returns {ok: False, err}.
- **evidence**: src/cmp/py/fragment/Main.fragment.py:366-371 "testopts[\"active\"] = True / vs.setpath(sdkopts, \"feature.test\", testopts) / sdk = cls(sdkopts) / sdk.mode = \"test\""; :81 "utility.feature_add(self._rootctx, _make_feature(fname))"; src/cmp/py/Main_py.ts:191-195 "def _make_feature(name): / factory = _FEATURES.get(name) ... return _FEATURES[\"base\"]()"; ts/src/helpers/optspec.ts:56-58 "const feature = { [S_CHILD]: { [S_OPEN]: true, active: false,"; tm/py/pkg/utility/fetcher.py:133-134 "if ctx.client.mode != \"live\": return None, ctx.make_error(\"fetch_mode_block\","
- **old page**: no-test/py/README.md:127 'Create a mock client for unit testing — no server required' and :202 'Creates a test-mode client with mock transport'. Both are false in a no-test SDK: there is no mock, and every call is blocked.

### rb

- **answer** (read and inferred): The same path as py. `self.test` sets feature.test active (rb lines 333-335) and calls `new`. The open feature optspec validates. The constructor calls `ProjectNameFeatures.make_feature("test")`, whose `case` falls to `else BaseFeature.new`. The client is built in test mode with no mock. The fetcher refuses every request with `fetch_mode_block`.
- **evidence**: src/cmp/rb/fragment/Main.fragment.rb:333-338 "testopts[\"active\"] = true / VoxgigStruct.setpath(sdkopts, \"feature.test\", testopts) / sdk = ProjectNameSDK.new(sdkopts) / sdk.mode = \"test\""; :61 "utility.feature_add.call(@_rootctx, ProjectNameFeatures.make_feature(fname))"; src/cmp/rb/Main_rb.ts:137-138 "else / ${model.const.Name}BaseFeature.new"; tm/rb/utility/fetcher.rb:229-230 "if ctx.client.mode != \"live\" / return nil, ctx.make_error(\"fetch_mode_block\","
- **old page**: no-test/rb/README.md:199 shows `DemoSDK.test(testopts, sdkopts)` described as a mock test client, which is false without the feature.

### php

- **answer** (read and inferred): The factory falls back to a base feature, so construction does not fail. test() sets feature.test.active=true and calls new. make_options keeps the key, because the feature optspec is open, and orders test first. The constructor's has_feature('test') is false, but no extend instance carries the name, so it still calls make_features('test'). Its switch has no 'test' case, so the default branch returns a BaseFeature. mode is 'test', both from the options and from test() itself. The first operation or direct then fails in Fetcher::call with fetch_mode_block ("Request blocked by mode: \"test\""): an operation throws ProjectNameError, and direct returns ok false with that err.
- **evidence**: fragment/Main.fragment.php:402-411 "$testopts[\"active\"] = true; ... $sdk = new ProjectNameSDK($sdkopts); $sdk->mode = \"test\";"; :55-56 "if (Struct::getpath($this->options, \"feature.test.active\") === true) { $this->mode = \"test\";"; :85-93 "if (!ProjectNameFeatures::has_feature($fname)) {...} ($utility->feature_add)($this->_rootctx, ProjectNameFeatures::make_feature($fname));"; src/cmp/php/Main_php.ts:141-142 "default: return new ${model.const.Name}BaseFeature();"; tm/php/utility/Fetcher.php:351-353 "if ($ctx->client->mode !== 'live') { return [null, $ctx->make_error('fetch_mode_block',"
- **old page**: The old no-test PHP README still documents `DemoSDK::test(...)` as a mock client (out/old/no-test/php/README.md:132). In that SDK every call fails.

### perl

- **answer** (read and inferred): The factory falls back to a base feature, so construction succeeds. test() clones the options, sets feature.test.active to JTRUE and calls $class->new. new adds features in featureorder, with test first, and calls make_feature('test'). With no test case generated, the trailing `return ...BaseFeature->new` runs. mode is 'test', so the fetcher refuses every request with fetch_mode_block: an operation dies with that error, and direct returns {ok=>0, err=>...}.
- **evidence**: fragment/Main.fragment.pm:373-378 "$testopts->{active} = Voxgig::Struct::JTRUE(); Voxgig::Struct::setpath($sdkopts, 'feature.test', $testopts); my $sdk = $class->new($sdkopts); $sdk->{mode} = 'test';"; :77-79 "if ($fopts && ProjectNameHelpers::is_true($fopts->{active})) { $utility->{feature_add}->($self->{_rootctx}, ProjectNameFeatures::make_feature($fname));"; src/cmp/perl/Main_perl.ts:158 "return ${model.const.Name}BaseFeature->new;"; tm/perl/utility/fetcher.pm:240-242 "if ('live' ne $mode) { return (undef, $ctx->make_error('fetch_mode_block',"; tm/perl/utility/make_options.pm:218-219 test-first order
- **old page**: The old no-test Perl README still documents `DemoSDK->test(undef, undef)` as a mock client (out/old/no-test/perl/README.md:139).

### lua

- **answer** (read and inferred): The call succeeds and the factory falls back to the base feature. SDK.test sets feature.test.active = true and calls new. The option spec accepts any feature name (open child with active:false default). new sets mode "test" because feature.test.active is true, then adds _make_feature("test"), which returns features.base() when the generated features table has no "test" entry. With no mock transport installed, the first request fails in the fetcher with fetch_mode_block ('Request blocked by mode: "test"'). An operation returns that as (nil, err), and direct puts it in result.err.
- **evidence**: Main.fragment.lua:444-448: "testopts[\"active\"] = true" / "vs.setpath(sdkopts, \"feature.test\", testopts)" / "local sdk = ProjectNameSDK.new(sdkopts)"; :102-103: "if vs.getpath(self.options, \"feature.test.active\") == true then" / "self.mode = \"test\""; :70-75: "local factory = features_factory[name]" ... "return features_factory.base()"; S/src/cmp/lua/Main_lua.ts:209-218 generates features.base and one entry per target feature only; P/base32/sdkgen/ts/src/helpers/optspec.ts:56-60: "[S_CHILD]: {" / "[S_OPEN]: true," / "active: false,"; S/tm/lua/utility/fetcher.lua:383-386: "if ctx.client.mode ~= \"live\" then" / "return nil, ctx:make_error(\"fetch_mode_block\","
- **old page**: Not checked in the no-test model output.

### elixir

- **answer** (read and inferred): The call succeeds and the factory falls back to the base feature. Demo.test sets feature.test active and calls new. new sets mode "test" and calls Demo.Features.make_feature("test"), whose case ends in `_ -> Demo.Feature.new()`. The first request then fails in fetcher_impl with fetch_mode_block. An operation raises it by default, and direct returns it in "err".
- **evidence**: Main.fragment.ex:94-99: "S.setprop(testopts, \"active\", true)" / "S.setpath(sdkopts, \"feature.test\", testopts)" / "client = new(sdkopts)"; :42: "if S.getpath(opts, \"feature.test.active\") == true, do: S.setprop(client, \"mode\", \"test\")"; :59: "Utility.feature_add(rootctx, ProjectName.Features.make_feature(fname))"; S/src/cmp/elixir/Main_elixir.ts:130: "_ -> ${Name}.Feature.new()"; S/tm/elixir/lib/projectname/utility.ex:2446-2449: "if mode != \"live\" do" / "{nil," / "Context.make_error(ctx, \"fetch_mode_block\","
- **old page**: Not checked in the no-test output.

### java

- **answer** (read and inferred): Construction succeeds; nothing fails until a request. testSDK -> testOptions sets feature.test.active=true -> constructor: makeOptions validates (the feature optspec has an open CHILD, so an unknown 'test' key passes) and puts 'test' first in featureorder -> Config.makeFeature("test") has no case and falls back to `new BaseFeature()`. mode is 'test'. No mock transport is installed, so the first load/list reaches Fetcher.fetcher, which throws SdkError fetch_mode_block ("Request blocked by mode: \"test\""); an op throws it, direct returns ok=false with it as err.
- **evidence**: src/cmp/java/fragment/Main.fragment.java:30-31 "ProjectNameSDK sdk = new ProjectNameSDK(SdkClient.testOptions(testopts, sdkopts));" "sdk.mode = \"test\";"; tm/java/core/SdkClient.java:396-398 "topts.put(\"active\", true);" "Struct.setpath(sopts, List.of(\"feature\", \"test\"), topts);"; :73 "Feature f = Config.makeFeature(fname);"; sdkgen/ts/src/helpers/optspec.ts:56-60 "[S_CHILD]: {" "[S_OPEN]: true,"; tm/java/utility/MakeOptions.java:244-245 "if (names.contains(\"test\")) {" "featureorder.add(\"test\");"; src/cmp/java/Config_java.ts:207-208 "default:" "return new ${javapackage}.feature.BaseFeature();"; tm/java/utility/Fetcher.java:272-273 "if (!\"live\".equals(ctx.client.mode)) {" "throw ctx.makeError(\"fetch_mode_block\","
- **old page**: no-test java README:131-140 "Create a mock client for unit testing — no server required" ... "data() reads the entity's mock record" and README:208 "Creates a test-mode client with mock transport." - false without the test feature: the load throws fetch_mode_block.

### kotlin

- **answer** (read and inferred): Same chain as java: testSDK -> testOptions(feature.test.active=true) -> init -> Config.makeFeature("test") falls to `else -> BaseFeature()` -> mode 'test' -> first request throws SdkError fetch_mode_block.
- **evidence**: src/cmp/kotlin/fragment/Main.fragment.kt:23-24 "val sdk = ProjectNameSDK(testOptions(testopts, sdkopts))" "sdk.mode = \"test\""; tm/kotlin/core/SdkClient.kt:59-60 "if (fname != null && fopts != null && fopts[\"active\"] == true) {" "val f = Config.makeFeature(fname)"; src/cmp/kotlin/Config_kotlin.ts:170 "else -> ${kotlinpackage}.feature.BaseFeature()"; tm/kotlin/utility/Fetcher.kt:235-237 "if (\"live\" != ctx.client!!.mode) {" "throw ctx.makeError(" "\"fetch_mode_block\","
- **old page**: no-test kotlin README:130-134 shows testSDK and "data() reads the entity's mock record" - false without the test feature.

### scala

- **answer** (read and inferred): It falls back to a base feature; it does not fail. `testSDK` builds options with feature.test.active = true and sets mode 'test'. The client constructor also sets mode 'test' from that option, then calls `Config.makeFeature("test")` for every active name in featureorder. In an SDK without the test feature, the generated match has no `"test"` case, so `case _ => new BaseFeature()` is returned and added. Option validation collects errors rather than throwing, and the feature child spec is open, so construction succeeds. No mock transport is installed, so the first request reaches `Fetcher.fetcher`, which throws SdkError `fetch_mode_block` because mode != 'live'. The operation raises (or returns the fallback under throw false), and direct returns ok FALSE with that err.
- **evidence**: src/cmp/scala/fragment/Main.fragment.scala:23-24 `val sdk = new ProjectNameSDK(SdkClient.testOptions(testopts, sdkopts))` `sdk.mode = "test"`; tm/scala/core/SdkClient.scala:337-339 `topts.put("active", java.lang.Boolean.TRUE)` ... `Struct.setpath(sopts, java.util.List.of("feature", "test"), topts)`; :35-37 `... "feature", "test", "active"))) {` `this.mode = "test"`; :56-57 `val f = Config.makeFeature(fname)` `if (f != null) this.utility.featureAdd(this.rootctx, f)`; src/cmp/scala/Config_scala.ts:159-165 `if (f.name !== 'base') {` ... `Content(`    case _ => new ${scalapackage}.feature.BaseFeature()`; tm/scala/utility/Make.scala:401 `// Errors are collected, not thrown, so a mistyped option is not rejected.`; tm/scala/utility/Fetcher.scala:205-207 `if ("live" != ctx.client.mode) {` `throw ctx.makeError("fetch_mode_block",`
- **old page**: out/old/no-test/scala/README.md:127-138 still says 'Create a mock client for unit testing — no server required' and shows `client.ambient(null).load(null, null)` reading a mock record. In that SDK the load raises fetch_mode_block.

### csharp

- **answer** (read and inferred): It falls back to a base feature; it does not fail. `TestSDK` sets feature.test.active = true in the cloned sdkopts, calls `new DemoSDK(sdkopts)` and sets Mode = "test". The constructor also sets Mode "test" from that option and calls `SdkConfig.MakeFeature("test")`. Without the test feature, the generated switch has no `case "test"`, so `default: return new Feature.BaseFeature();` is added. Validation does throw on invalid options here, but the feature child spec is open with `active` boolean, so `{active:true}` passes; that part is inferred from the spec builder. No mock transport is installed. The first request reaches `FetcherUtil`, which throws ProjectNameError `fetch_mode_block` because Mode != "live". The op raises it, and Direct returns ok false with that err.
- **evidence**: src/cmp/csharp/fragment/Main.fragment.cs:422-429 `testopts["active"] = true;` ... `var sdk = new ProjectNameSDK(sdkopts)` `Mode = "test",`; :45-48 `...Jt("feature", "test", "active")), true))` `Mode = "test";`; :72 `_utility.FeatureAdd(_rootctx, global::ProjectNameSdk.SdkConfig.MakeFeature(fname));`; src/cmp/csharp/Config_csharp.ts:230-238 `if (f.name !== 'base') {` ... `default:` `return new Feature.BaseFeature();`; ts/src/helpers/optspec.ts:56-60 `[S_CHILD]: {` `[S_OPEN]: true,` `active: false,`; tm/csharp/utility/Fetcher.cs:225-227 `if (ctx.Client!.Mode != "live")` `throw ctx.MakeError("fetch_mode_block",`
- **old page**: out/old/no-test/csharp/REFERENCE.md:36-38 still says 'Create a test client with mock features active', and README:137-142 says 'Use test mode'. In a no-test SDK there is no mock, and the first request raises fetch_mode_block.

### swift

- **answer** (read and inferred): testSDK clones the options and sets feature.test.active = true (Main.fragment.swift:333-336). It then calls the constructor and sets mode = "test". The constructor also sets mode = "test" when feature.test.active is true. makeOptions validates against an option spec whose `feature` entry accepts any child name as an open map, so the unknown `test` entry passes validation and lands first in featureorder. For each active name, the constructor calls SdkConfig.makeFeature(fname). The generated switch has no case for test, so it falls back to `default: return BaseFeature()`, whose hooks are all no-ops. Construction therefore succeeds, but no mock transport is installed. The first operation or direct call reaches fetcherUtil, which throws fetch_mode_block because mode is "test". An operation throws that error; direct returns ok false with that error in err.
- **evidence**: src/cmp/swift/fragment/Main.fragment.swift:334 "testopts.entries[\"active\"] = .bool(true)"; :339 "sdk.mode = \"test\""; :45-46 (mode = "test"); :62 "utility.featureAdd(rootctx, SdkConfig.makeFeature(fname))"; src/cmp/swift/Config_swift.ts:111 "case \"${f.name}\": return ${fname}Feature()" and :116 "default: return BaseFeature()"; ts/src/helpers/optspec.ts:56-60 "[S_CHILD]: { [S_OPEN]: true, active: false, }"; tm/swift/Sources/ProjectNameSDK/utility/MakeOptions.swift:158-159 "if names.contains(\"test\") { featureorder.append(.string(\"test\"))"; tm/swift/Sources/ProjectNameSDK/feature/BaseFeature.swift:23-30 (no-op hooks); utility/Fetcher.swift:205-207 "if ctx.client!.mode != \"live\" { throw ctx.makeError(\"fetch_mode_block\"".
- **old page**: no-test/swift/README.md:142 "Create a mock client for unit testing — no server required" and :219 "Creates a test-mode client with mock transport." Both are false in an SDK without the test feature: there is no mock, and calls fail with fetch_mode_block.

### cpp

- **answer** (read and inferred): Same outcome as Swift. testSDK calls SdkClient::testOptions, which clones the options and sets feature.test.active = true. It then calls make_shared<DemoSDK>, and the constructor sets mode = "test". The option spec admits the unknown test entry: validate would throw options_invalid on a closed spec, but the feature child is open. makeOptions puts test first in featureorder. The constructor calls makeFeature("test"); the generated chain of if statements has no test branch, so it returns std::make_shared<BaseFeature>(), whose hooks are all no-ops. Construction succeeds with no mock transport. The first operation throws an SdkErrorPtr wrapping fetch_mode_block; direct returns ok false with err {message: ...fetch_mode_block...}.
- **evidence**: src/cmp/cpp/fragment/Main.fragment.cpp:28-29 "auto sdk = std::make_shared<ProjectNameSDK>(SdkClient::testOptions(testopts, sdkopts)); sdk->mode = \"test\";"; tm/cpp/core/types.hpp:993 "map_put(topts, \"active\", Value(true));"; :945-946 (mode = "test"); :963 "FeaturePtr f = makeFeature(fnamev.as_string());"; src/cmp/cpp/Config_cpp.ts:330 "if (name == \"${f.name}\") return std::make_shared<${fname}Feature>();" and :335 "return std::make_shared<BaseFeature>();"; ts/src/helpers/optspec.ts:56-60 (open feature child); tm/cpp/utility/pipeline.hpp:2116-2117 "bool hasTest = ...; if (hasTest) featureOrder.push_back(\"test\");"; :589-590 "if (ctx->client->mode != \"live\") { throw ctx->makeError(\"fetch_mode_block\","; tm/cpp/feature/base.hpp:12-30 (no-op BaseFeature).
- **old page**: no-test/cpp/README.md:147-150 "Use test mode ... The test feature installs an in-memory mock transport". False in that SDK.

### zig

- **answer** (read and inferred): It works with the real mock. Zig does not trim feature source (trim: false), and `test` is in BUILTIN_FEATURES, which make_feature always names. The trace: `test_sdk` sets `feature.test.active = true`. Then `new` puts "test" first in featureorder (make_options) and calls `make_feature("test")`, which returns `@import("../feature/test.zig").TestFeature.make()`, a real TestFeature that sets mode "test" and installs the mock transport. The fallback `BaseFeature.make()` is reached only for a name outside the list.
- **evidence**: ts/project/.sdk/model/target/zig.aontu:44-46 `main: kit: target: zig: feature: {` `trim: false`; src/cmp/zig/Config_zig.ts:159-165 `Content(` if (std.mem.eql(u8, name, "${name}")) return @import("../feature/${name}.zig").${fname}Feature.make();` ... `return @import("../feature/base.zig").BaseFeature.make();`; :172-180 `// The features tm/zig/feature/ ships UNGATED` `const BUILTIN_FEATURES = [ ... 'retry', 'streaming', 'telemetry', 'test', 'timeout', ]`; src/cmp/zig/fragment/Main.fragment.zig:421-428; :104-105 `if (h.get_bool(fopts, "active") orelse false) { sdk.sdkUtility.feature_add(rootctx, config.make_feature(fname));`; tm/zig/core/utility.zig:877 `if (has_test) feature_order.array.append(h.vstr("test")) catch {};`; tm/zig/feature/test.zig:53 `if (ctx.client) |client| client.mode = "test";`
- **old page**: out/old/no-test/zig/README.md:138 "Create a mock client for unit testing — no server required". True for zig, by the reading above.

### rust

- **answer** (read and inferred): The factory falls back silently, and the client fails only at request time. Rust trims feature source (trim: true), so a no-test SDK has no `feature::test` module, and `make_feature` has no "test" arm. The trace: `test_sdk` sets `feature.test.active = true`, then `DemoSDK::new` sets mode "test", walks featureorder and calls `make_feature("test")`. That hits `_ => BaseFeature::new()`, a no-op feature named "base", which is added. `test_sdk` sets mode "test". No mock transport is installed, so the first request reaches `fetcher_util` and fails with `fetch_mode_block` "Request blocked by mode: \"test\"" (returned as Err from an op, or as {ok:false, err} from direct).
- **evidence**: ts/project/.sdk/model/target/rust.aontu:50 `trim: true`; src/cmp/rust/Config_rust.ts:171-179 `each(feature, ...)` emits `"${f.name}" => ...` per targetFeatures, then `_ => Rc::new(RefCell::new(crate::feature::base::BaseFeature::new())),`; src/cmp/rust/fragment/Main.fragment.rs:419-428 `setp(&testopts, "active", Value::Bool(true));` ... `vs::set_path(&sdkopts, ... "feature", "test" ...)`; :53-54 mode test; :73-74 `if get_bool(&fopts, "active") == Some(true) { sdk.utility.feature_add(&rootctx, make_feature(&fname)); }`; :431 `*sdk.mode.borrow_mut() = "test".to_string();`; tm/rust/feature/base.rs:20 `name: "base".to_string(),`; tm/rust/utility/fetcher.rs:205-213 `if mode != "live" { return Err(ctx.make_error("fetch_mode_block", ...`
- **old page**: out/old/no-test/rust/README.md:129 "Create a mock client for unit testing — no server required" and :197 "Creates a test-mode client with mock transport." Both are false in a no-test SDK: there is no mock, and every request is blocked.

### clojure

- **answer** (read and inferred): It works with the full mock. `test-sdk` sets `feature.test.active` true and calls `make-sdk`. make-options puts `test` first in the feature order, and the option spec accepts any feature name. `make-sdk` then calls `features/make-feature "test"`. features.clj is one template holding every feature, and clojure is not trimmed, so the case form maps "test" to `test-feature` even when the model lacks the test feature. The base fallback (`(base-feature)`) is used only for a name with no case and no feature-extra entry.
- **evidence**: client.clj:215-217 `(.put ^java.util.Map testopts "active" true) (vs/setpath sdkopts "feature.test" testopts) (let [sdk (make-sdk sdkopts)]`; client.clj:52-55 `(doseq [fname feature-order] ... ((core/uget rootctx :feature-add) rootctx (features/make-feature fname))`; core.clj:1781 `(when (some #(= % "test") names) (.add ^java.util.List order "test"))`; tm/clojure/src/sdk/features.clj:1604-1608 `(defn make-feature [name] (case name "base" (base-feature) "log" (log-feature) "test" (test-feature)`; :1625-1628 `(if-let [ctor (get config/feature-extra name)] (ctor) (base-feature))`; model/target/clojure.aontu:45 `trim: false`; ts/src/helpers/featureSource.ts:163 `false === target.feature?.trim) { return [] }`; ts/src/helpers/optspec.ts:55-58 feature `[S_CHILD]: { [S_OPEN]: true, active: false }`
- **old page**: The no-test README.md:136-145 shows test-sdk as a mock client. That is consistent with the code for clojure. I did not run it.

### ocaml

- **answer** (read and inferred): Construction succeeds, but there is no mock, and every operation then fails. `Sdk_client.test ()` calls `sdk_test`, which sets `feature.test.active` true and calls `make_client_base`. That calls the generated `Sdk_config.make_feature "test"`. Without the test feature, the factory has no `| "test"` case and falls to `| _ -> base_feature ()`. `sdk_test` sets `cl_mode <- "test"`, so the unwrapped `fetcher_util` refuses every request with `fetch_mode_block` ("Request blocked by mode: \"test\" ..."). An op raises `Sdk_error_exc` with that code; `direct` returns `{ok false, err}`. This differs from clojure, where the mock is still present.
- **evidence**: src/cmp/ocaml/Main_ocaml.ts:178-182 `let test () : sdk_client = sdk_test ~config:(Sdk_config.make_config ()) ~make_feature:Sdk_config.make_feature Noval Noval`; tm/ocaml/sdk_features.ml:1872-1879 `setp testopts "active" (Bool true); ignore (setpath sdkopts (Str "feature.test") testopts); let sdk = make_client_base ~config ~make_feature sdkopts in sdk.cl_mode <- "test";`; sdk_features.ml:1723 `if getp fopts "active" = Bool true then utility.u_feature_add rootctx (make_feature fname)`; src/cmp/ocaml/Config_ocaml.ts:250-254 `each(feature, (f: any) => { if (f.name !== 'base' && OCAML_FEATURES.includes(f.name)) { Content(`  | "${ocamlString(f.name)}" -> ${f.name}_feature ()` ...`; :260 `Content(`  | _ -> base_feature ()`; sdk_runtime.ml:1554-1558 `if client.cl_mode <> "live" then (Noval, Some (ctx_make_error ctx "fetch_mode_block" ...`; model/target/ocaml.aontu:45 `trim: true`
- **old page**: no-test/ocaml/README.md:124-130 still says 'Create a mock client for unit testing — no server required' and shows `Sdk_client.test ()` loading a record. For a no-test SDK that is false.


## 11. ctrl.explain

### ts

- **answer** (read and inferred): explain is an OBJECT the pipeline fills in place: spec, fetchdef, result and err (plus test.query and netsim from features). Steps test `if (ctx.ctrl.explain)` and then assign properties on it. Passing `true` passes the truthy test, and then `true.spec = ...` throws a TypeError in strict mode. The ts SDK is strict: tsconfig strict:true, so the compiled output is strict. The op's catch then calls _unexpected, which also assigns `ctrl.explain.err`, so the operation rejects with a raw TypeError ('Cannot create property ... on boolean true') instead of doing the work. On direct, only the test and netsim features touch explain, so with true and live transport nothing reads it (inferred).
- **evidence**: tm/ts/src/utility/MakeSpecUtility.ts:61-62 "if (ctx.ctrl.explain) {" / "ctx.ctrl.explain.spec = ctx.spec"; MakeRequestUtility.ts:45-46 "ctx.ctrl.explain.fetchdef = fetchdef"; MakeResultUtility.ts:47-48 "ctx.ctrl.explain.result = result"; MakeErrorUtility.ts:49-50 "ctx.ctrl.explain.err = {"; DoneUtility.ts:23-24 "const explain = ctx.ctrl.explain" / "if (null == explain || 'object' !== typeof explain) {"; src/cmp/ts/fragment/EntityBase.fragment.ts:258-259 "if (null == ctrl.explain.err) {" / "ctrl.explain.err = cleanerr"; tm/ts/src/tsconfig.json "\"strict\": true"; node check: "'use strict'; x.explain.spec=1" -> "Cannot create property 'spec' on boolean 'true'"
- **old page**: The old REFERENCE fetchargs.ctrl row reads "Control options (e.g. `{ explain: true }`)." The code takes an object (`{ explain: {} }`), so the documented example is wrong.

### js

- **answer** (read and inferred): Same contract (an object filled in place), but true behaves DIFFERENTLY from ts. The utility steps are plain functions in CommonJS files without 'use strict', so `true.spec = ...` is silently ignored and a successful op proceeds as if explain were off. Class bodies are always strict, though, so on any error path EntityBase._unexpected's `ctrl.explain.err = cleanerr` throws a TypeError that replaces the real error. In test mode TestFeature.buildArgs (a class method) assigns `ctx.ctrl.explain.test` and throws as well.
- **evidence**: tm/js/src/utility/MakeSpecUtility.js:67-68 "if (ctx.ctrl.explain) {" / "ctx.ctrl.explain.spec = ctx.spec" (no 'use strict' at the top of the file: lines 1-5 are requires); src/cmp/js/fragment/EntityBase.fragment.js (_unexpected, a class method) "ctrl.explain.err = cleanerr"; tm/js/src/feature/test/TestFeature.js:49 "class TestFeature extends BaseFeature {" and :362-363 "if (ctx.ctrl.explain) {" / "ctx.ctrl.explain.test = { query: q }"; node check: a sloppy assignment raised no error, a strict one threw
- **old page**: js REFERENCE presumably carries the same `{ explain: true }` example. Not checked line by line.

### go

- **answer** (read and certain): A map the runtime fills (`Control.Explain map[string]any`); the caller passes a map and reads spec, fetchdef, result, err etc. from it afterwards (cleaned in Done). Passing `true` is silently ignored: the type assertion to map fails, Explain stays nil, nothing is recorded and no error is raised.
- **evidence**: ts/project/.sdk/tm/go/core/control.go:6 "Explain map[string]any"; tm/go/core/context.go:73-75 "if e, ok := cm[\"explain\"]; ok {" / "if em, ok := e.(map[string]any); ok {" / "ctx.Ctrl.Explain = em"; tm/go/utility/make_spec.go:81-82 "if ctx.Ctrl.Explain != nil {" / "ctx.Ctrl.Explain[\"spec\"] = ctx.Spec"; tm/go/utility/done.go:19 "// The explain map IS the caller's (`ctrl[\"explain\"]`)"
- **old page**: go/REFERENCE.md:101 "`fetchargs[\"ctrl\"]` | `map[string]any` | Control options (e.g. `map[string]any{\"explain\": true}`)." - the example value `true` does nothing in Go; it must be a map.

### c

- **answer** (read and certain): A map the runtime fills (`Control.explain`, "Map when supplied, else Noval"). Passing true is silently ignored: only a map is taken, otherwise explain stays undefined and nothing is recorded.
- **evidence**: tm/c/core/sdk.h:156 "voxgig_value* explain; // Map when supplied, else Noval"; tm/c/core/context.c:115-116 "voxgig_value* explain = getp(cs.ctrl, \"explain\");" / "if (voxgig_is_map(explain)) c->explain = explain;"; tm/c/core/control.c:19 "bool control_has_explain(Control* c) { return c && voxgig_is_map(c->explain); }"
- **old page**: No explain mention found in C README/REFERENCE.

### py

- **answer** (read and certain): `explain` is a map that the pipeline fills. The context copies `ctrl["explain"]` into the control ONLY when it is a dict. Passing `True` is silently ignored: explain stays None and nothing is recorded or raised. With a dict, the pipeline writes fetchdef, spec, result and err into it in place, and it is cleaned at done.
- **evidence**: tm/py/pkg/core/context.py:53-54 "if isinstance(ctrl_raw.get(\"explain\"), dict): / self.ctrl.explain = ctrl_raw[\"explain\"]"; tm/py/pkg/utility/make_request.py:34-35 "if ctx.ctrl.explain is not None: ctx.ctrl.explain[\"fetchdef\"] = fetchdef"; tm/py/pkg/utility/done.py:18-25 clean_explain_util
- **old page**: The py REFERENCE direct parameter table has no ctrl row. Nothing found.

### rb

- **answer** (read and certain): A Hash that the pipeline fills. The context sets it only when it `is_a?(Hash)`, so `true` is silently ignored.
- **evidence**: tm/rb/core/context.rb:37 "@ctrl.explain = ctrl_raw[\"explain\"] if ctrl_raw[\"explain\"].is_a?(Hash)"; tm/rb/utility/done.rb:18-21 "explain = ctx.ctrl.explain / return unless explain.is_a?(Hash)"
- **old page**: rb/REFERENCE.md:97 "| `fetchargs[\"ctrl\"]` | `Hash` | Control options (e.g. `{ \"explain\" => true }`). |". The code contradicts this: true is ignored, and a Hash must be passed.

### php

- **answer** (read and certain): explain must be an array, filled with spec, fetchdef, result and err. true, or any other non-array, is ignored silently. An empty array [] is falsy in PHP, so `explain => []` records nothing; it takes a non-empty array such as ['on'=>true]. Because PHP arrays are copied by value, the record is filled on the context's copy, and the caller's own array never receives it. The code says so in a comment.
- **evidence**: tm/php/core/Context.php:55-56 "if (isset($ctrl_raw['explain']) && is_array($ctrl_raw['explain'])) { $this->ctrl->explain = $ctrl_raw['explain'];"; tm/php/utility/MakeSpec.php:83 "if ($ctx->ctrl->explain) {"; tm/php/utility/Done.php:21-22 "The record is an array the context owns (the caller's copy is its own)"; src/cmp/php/TestClean_php.ts:522-523 "What the caller passed and keeps; an array, so the call cannot change it"

### perl

- **answer** (read and certain): explain must be a hashref, and the runtime fills the caller's OWN hash in place: spec, fetchdef, result, err and unexpected, cleaned and written back into the same hash. A true scalar such as 1 is ignored silently because it is not a map. Unlike PHP, an empty {} works, because a reference is always true, and the caller reads the record afterwards from its own variable.
- **evidence**: tm/perl/core/context.pm:47 "$self->{ctrl}{explain} = $ctrl_raw->{explain} if Voxgig::Struct::ismap($ctrl_raw->{explain});"; tm/perl/utility/done.pm:30-32 "The caller's own hash is the explain record ... so the cleaned copy is written back INTO it"; :40 "%$explain = %$cleaned;"; tm/perl/utility/make_spec.pm:89 "$ctx->{ctrl}{explain}{spec} = $ctx->{spec} if $ctx->{ctrl}{explain};"

### lua

- **answer** (read and certain): explain must be a table that the pipeline fills in (spec, fetchdef, result, err). The context copies ctrl.explain only when it is a table, so explain = true is silently ignored: nothing is recorded and no error is raised.
- **evidence**: S/tm/lua/core/context.lua:53-55: "if type(ctrl_raw.explain) == \"table\" then" / "self.ctrl.explain = ctrl_raw.explain"; S/tm/lua/utility/make_spec.lua:83-84: "if ctx.ctrl.explain ~= nil then" / "ctx.ctrl.explain[\"spec\"] = ctx.spec"
- **old page**: REFERENCE.md:94: '`fetchargs.ctrl` | `table` | Control options (e.g. `{ explain = true }`)'. The code contradicts this: true is ignored.

### elixir

- **answer** (read and certain): explain must be a map node that the pipeline fills in. The context copies it only when S.ismap(ex), so true is silently ignored.
- **evidence**: S/tm/elixir/lib/projectname/context.ex:71-72: "ex = S.getprop(ctrl_raw, \"explain\")" / "if S.ismap(ex), do: S.setprop(ctrl, \"explain\", ex)"; utility.ex:1172-1173: "explain = S.getprop(ctrl, \"explain\")" / "if explain != nil, do: S.setprop(explain, \"spec\", spec)"
- **old page**: The Elixir pages do not mention explain (REFERENCE.md:88-95 lists no ctrl key).

### java

- **answer** (read and certain): explain must be a Map the runtime fills (spec, fetchdef, result, err keys). Passing true is silently ignored: Context only accepts a Map, so ctrl.explain stays null and nothing is recorded; no error.
- **evidence**: tm/java/core/Control.java:13 "public Map<String, Object> explain;"; tm/java/core/Context.java:69-71 "Object e = cm.get(\"explain\");" "if (e instanceof Map) {" "this.ctrl.explain = (Map<String, Object>) e;"; tm/java/utility/MakeSpec.java:85-86 "if (ctx.ctrl.explain != null) {" "ctx.ctrl.explain.put(\"spec\", ctx.spec);"
- **old page**: Not mentioned.

### kotlin

- **answer** (read and certain): Same: a MutableMap it fills; true is ignored (explain stays null).
- **evidence**: tm/kotlin/core/Control.kt:11 "var explain: MutableMap<String, Any?>? = null"; tm/kotlin/core/Context.kt:65-67 "val e = cm[\"explain\"]" "if (e is MutableMap<*, *>) {" "this.ctrl.explain = e as MutableMap<String, Any?>"
- **old page**: Not mentioned.

### scala

- **answer** (read and certain): `explain` must be a java.util.Map, which the pipeline fills (spec, fetchdef, result, err). Passing `true` (a java.lang.Boolean) matches no case and is silently ignored: `ctrl.explain` stays null and nothing is recorded.
- **evidence**: tm/scala/core/Control.scala:13 `var explain: JMap[String, Object] = null`; tm/scala/core/Context.scala:48 `m.get("explain") match { case e: JMap[_, _] => ctrl.explain = e.asInstanceOf[JMap[String, Object]]; case _ => }`; tm/scala/utility/MakeSpec.scala:71 `if (ctx.ctrl.explain != null) ctx.ctrl.explain.put("spec", ctx.spec)`
- **old page**: Not found in the B scala pages.

### csharp

- **answer** (read and certain): `Explain` is a `Dictionary<string, object?>` that the pipeline fills. Passing `true` fails the `is Dictionary` pattern and is silently ignored: Explain stays null and nothing is recorded.
- **evidence**: tm/csharp/core/Control.cs:9 `public Dictionary<string, object?>? Explain;`; tm/csharp/core/Context.cs:66-68 `if (cm.TryGetValue("explain", out var e) && e is Dictionary<string, object?> em)` `Ctrl.Explain = em;`
- **old page**: Not found in the B csharp pages.

### swift

- **answer** (read and certain): A map, VMap?. The context copies ctrl["explain"] only if it is a map, and the pipeline fills that caller-owned map with spec, fetchdef, result and err records. Passing `.bool(true)` is silently ignored: asMap is nil, ctrl.explain stays nil, nothing is recorded, and nothing fails.
- **evidence**: tm/swift/Sources/ProjectNameSDK/core/Control.swift:10 "public var explain: VMap? = nil"; core/Context.swift:56 "if let e = cm.entries[\"explain\"]?.asMap { ctrl.explain = e }"; utility/Make.swift:241-242 "if let explain = ctx.ctrl.explain { explain.entries[\"spec\"] = .nat(ctx.spec!)".
- **old page**: Not found in the old swift README or REFERENCE.

### cpp

- **answer** (read and certain): A map. Control::explain is a Value that the context fills only when ctrl["explain"].is_map(), and the pipeline writes spec, result and err records into it. Passing Value(true) is silently ignored: explain stays undef, nothing is recorded, and nothing fails.
- **evidence**: tm/cpp/core/types.hpp:156 "Value explain = Value::undef(); // map when explain-capture is active"; :790-791 "Value e = getp(cs.ctrlMap, \"explain\"); if (e.is_map()) ctrl->explain = e;"; tm/cpp/utility/pipeline.hpp:435-439 "if (ctx->ctrl->explain.is_map()) { ... map_put(ctx->ctrl->explain, \"err\", errRecord);".
- **old page**: Not found in the old cpp pages.

### zig

- **answer** (read and certain): The same as rust: `explain` must be an `.object` map, which is filled in place. `h.vbool(true)` is ignored silently.
- **evidence**: tm/zig/core/context.zig:97 `if (h.getp(cm, "explain") == .object) c.explain = h.getp(cm, "explain");`; tm/zig/core/control.zig:10-13 `// explain / paging are Value maps when supplied (.null otherwise)...` `explain: Value = .{ .null = {} },`; :23-24 `pub fn has_explain(self: *const Control) bool { return self.explain == .object;`
- **old page**: Not found.

### rust

- **answer** (read and certain): `explain` must be a map (a `Value::Map`), which the runtime fills in place: make_spec writes `spec`, make_request writes `fetchdef`, make_result writes `result`, and make_error writes `err`. The map is cleaned at done. Passing `Value::Bool(true)` is silently ignored: the context copies explain only when it is a Map, `has_explain()` is false, and nothing is recorded.
- **evidence**: tm/rust/core/context.rs:92-94 `if let Value::Map(_) = getp(cm, "explain") { c.explain = getp(cm, "explain"); }`; tm/rust/core/control.rs:8-11 `// explain / paging are Value maps when supplied (Noval otherwise). They are the caller's own maps (reference-shared)` `pub explain: Value,`; :27-28 `pub fn has_explain(&self) -> bool { matches!(self.explain, Value::Map(_))`; tm/rust/utility/make_spec.rs:93-94 `if c.has_explain() { setp(&c.explain, "spec", ...`; make_request.rs:40-41 `setp(&c.explain, "fetchdef", ...`; make_result.rs:53-54 `setp(&c.explain, "result", ...`
- **old page**: Not found on the old page.

### clojure

- **answer** (read and certain): A map that the runtime fills. make-context copies `explain` only when `(vs/ismap ...)`. The pipeline then `.put`s "spec", "fetchdef", "result" and "err" into the caller's own map, and it is cleaned in place. Passing `true` is silently ignored: nothing is recorded and nothing fails.
- **evidence**: core.clj:347 `(when (vs/ismap (mget ctrl-raw "explain")) (oset! c :explain (mget ctrl-raw "explain")))`; core.clj:1328 `(when-let [ex (oget (oget ctx :ctrl) :explain)] (.put ^java.util.Map ex "spec" spec))`; core.clj:1430 `... (.put ^java.util.Map ex "fetchdef" fetchdef))`; core.clj:705 `;; The explain map is the CALLER's, so it is cleaned in place`
- **old page**: Not mentioned.

### ocaml

- **answer** (read and certain): A map that the runtime fills. The ctrl parse keeps `explain` only when it is a `Map`. The pipeline `setp`s "spec", "fetchdef", "result" and "err" into it and cleans it in place. Passing `Bool true` is silently ignored.
- **evidence**: tm/ocaml/sdk_runtime.ml:207 `(match getp cr "explain" with Map _ as m -> c.ctrl_explain <- m | _ -> ());`; :1333 `(match ctx.c_ctrl.ctrl_explain with Map _ -> setp ctx.c_ctrl.ctrl_explain "spec" (spec_to_value sp) | _ -> ());`; :1450 `... "fetchdef" fetchdef ...`; sdk_types.ml:46 `mutable ctrl_explain : value;   (* Map when explain is on, else Noval *)`
- **old page**: Not mentioned.


## 12. What a standalone program must import

### ts

- **answer** (read and inferred): (a) From ts/: package.json has main dist/DemoSDK.js, type commonjs, no 'exports' field and no runtime dependencies. A standalone .js file can use `const { DemoSDK } = require('.')` or `require('./dist/DemoSDK')`. A .ts file run by a type-stripping runner can use `import { DemoSDK } from './src/DemoSDK'` (or './dist/DemoSDK'). (b) From the repository root: `const { DemoSDK } = require('./ts')`, which resolves through ts/package.json main, or `require('./ts/dist/DemoSDK')`. dist/ is committed (Gitignore_ts says so), so no build is needed. The package name '@voxgig-sdk/demo-sdk' resolves only where the package is installed in a node_modules. With no 'exports' field there is no self-reference either. The old root README's TypeScript quick start printed `import { DemoSDK } from '@voxgig-sdk/demo-sdk'` with top-level `await client.Ambient().load()`. From the repository root without installing it, that import would not resolve (inferred).
- **evidence**: src/cmp/ts/Package_ts.ts:75-77 "main: `dist/${SdkName}SDK.js`," / "type: 'commonjs'," / "types: `dist/${SdkName}SDK.d.ts`,"; Main_ts.ts:76 "File({ name: model.const.Name + 'SDK.' + target.name }"; Gitignore_ts.ts:16 "# dist/ and dist-test/ are COMMITTED, not ignored"; model/target/ts.aontu deps: only 'typescript' and '@types/node' with kind: dev; out/old/B/README.md:267 "import { DemoSDK } from '@voxgig-sdk/demo-sdk'"
- **old page**: Root quick start (out/old/B/README.md:264-283): a package-name import plus top-level await. It does not run from the repository root as printed. The ts README Install says `npm install ./demo-sdk/ts` first.

### js

- **answer** (read and inferred): (a) From js/: package.json main is src/DemoSDK.js, type commonjs, no exports, dev deps only. Use `const { DemoSDK } = require('.')` or `require('./src/DemoSDK')`. (b) From the root: `const { DemoSDK } = require('./js')` or `require('./js/src/DemoSDK')`. There is no build step. The old root README's JavaScript quick start printed `const { DemoSDK } = require('@voxgig-sdk/demo-sdk-js')` followed by a top-level `await client.Ambient().load()`. From the root the package name does not resolve without an install. In a CommonJS .js file a top-level await is also a SyntaxError, so the snippet fails as a standalone file even after installing (inferred from Node semantics; not run).
- **evidence**: src/cmp/js/Package_js.ts:75-76 "main: `src/${SdkName}SDK.js`," / "type: 'commonjs',"; :81 "files: ['src', 'README.md', 'REFERENCE.md'],"; model/target/js.aontu:26-27 "deps: {" / "'dotenv': { active: true, version: '^17.4.2', kind: dev }"; out/old/B/README.md:506 "const { DemoSDK } = require('@voxgig-sdk/demo-sdk-js')" and :513 "const ambient = await client.Ambient().load()"
- **old page**: The root README JS quick start mixes require() with top-level await and a package name. It would not run from the repository root.

### go

- **answer** (read and inferred): The module is rooted at go/: go.mod there declares `module github.com/voxgig-sdk/demo-sdk/go` (from goModule: main.kit.target.go.module.path, else <repo host>/<repo path>/go) with no external requires (struct is vendored at utility/struct). The root package is in go/ itself, so a program must be `package main` in its own directory (e.g. go/cmd/demo/main.go; `go run file.go` naming one file also works). (a) from go/: `package main\nimport (\n  "fmt"\n  sdk "github.com/voxgig-sdk/demo-sdk/go"\n)\nfunc main() { client := sdk.NewDemoSDK(map[string]any{...}); ... }` run with `go run ./cmd/demo` - the import resolves to the main module itself. (b) from the repository root: there is no go.mod or go.work at the root (go.work is even gitignored), so the same file is outside any module and the import would be fetched from the network (fails until published); it needs its own go.mod with `require github.com/voxgig-sdk/demo-sdk/go v0.0.0` + `replace github.com/voxgig-sdk/demo-sdk/go => ./go`, or `go run -C go ./cmd/demo`. The old root README quick start printed `import sdk "github.com/voxgig-sdk/demo-sdk/go"` followed by bare statements (`client := sdk.NewDemoSDK(...)`, `fmt.Println(...)`, `os.Getenv`) with no `package main`, no `func main`, and no fmt/os imports: it does not compile anywhere as printed, and from the root it would also lack a module.
- **evidence**: ts/project/.sdk/src/cmp/go/Package_go.ts:23-24 "File({ name: 'go.mod' }, () => {" / "Content(`module ${gomodule}"; ts/src/helpers/packageMeta.ts:128-136 "function goModule(model: any, target: string): string {" ... "return `${host}/${path}/${target}`"; ts/project/.sdk/model/target/go.aontu:25 "deps: {}"; Entity_go.ts:70 "'\"github.com/voxgig/struct\"': `\"${gomodule}/utility/struct\"`,"; Main_go.ts:141-142 "File({ name: model.name + '.' + target.ext }, () => {" / "Content(`package ${gopackage}"; src/cmp/go/Gitignore_go.ts:36 "go.work"; out/old/B/README.md:346-365 (Golang quickstart: "import sdk \"github.com/voxgig-sdk/demo-sdk/go\"" then "client := sdk.NewDemoSDK(map[string]any{" ... "fmt.Println(ambient.(sdk.Entity).Data())")
- **old page**: go/README.md Quickstart is a complete program (package main, imports fmt, os, sdk) - correct for a separate module that has the SDK as a dependency; it says `go get ...@latest`, and `go mod edit -replace ...=../demo-sdk/go` for a checkout.

### c

- **answer** (read and inferred): There is no package: the program compiles against the c/ tree and links libsdk.a, built by `make` in c/ (which also writes core/prefix_api.h, needed by sdk.h). core/api.h includes "sdk.h" (same dir), which includes "prefix_api.h" and "voxgig_struct.h" (needs -I utility/struct). (a) From c/: `#include "core/api.h"` (+ <stdio.h>, <stdlib.h>), `int main(void){ DemoSDK* client = demo_sdk_new(cmap(1, "server", cmap(2, "tenant", v_str("t"), "region", v_str("r")))); ... }`, built with `make && cc -std=c11 -I utility/struct myapp.c libsdk.a $(make -s ldlibs) -o myapp` (the quoted include resolves relative to myapp.c in c/). (b) From the repository root: `#include "core/api.h"` needs `-I c` (plus `-I c/utility/struct`): `cc -std=c11 -I c -I c/utility/struct myapp.c c/libsdk.a $(make -s -C c ldlibs) -o myapp`; or keep `-I c/core` and write `#include "api.h"`. The old root README C quick start printed `#include "core/api.h"` then bare statements (`DemoSDK* client = demo_sdk_new(cmap(1, "apikey", v_str(getenv("DEMO_APIKEY"))));` ... `printf(...)`) with no main and no stdio/stdlib includes, so it does not compile as printed; and since it passes no `server` while the API base is `https://{tenant}.example.com/{region}`, construction would abort() at runtime outside test mode.
- **evidence**: src/cmp/c/EntityBase_c.ts:33-39 "File({ name: 'api.h' }, () => {" ... "#include \"sdk.h\""; tm/c/core/sdk.h:31 "#include \"prefix_api.h\""; :34 "#include \"voxgig_struct.h\""; tm/c/Makefile:22 "INC := -I core -I utility/struct -I feature ..."; :101 "API_PREFIX_H := core/prefix_api.h"; :142 "build: libsdk.a"; :31 "LDLIBS := -lm"; tm/c/utility/make_options.c:124-128 "fprintf(stderr, \"%s: the server variable '%s' is required: ...\"" ... "abort();"; out/old/B/README.md:399-415 C quickstart; out/old/B/README.md:969 "- Upstream API: `https://{tenant}.example.com/{region}`"
- **old page**: c/README.md Install: "cc -I c/core -I c/utility/struct myapp.c c/libsdk.a $(make -s -C c ldlibs) -o myapp" together with "include `core/api.h`" - with only -I c/core, `#include "core/api.h"` from a root-level myapp.c is not found (it would look for ./core/api.h and c/core/core/api.h).

### py

- **answer** (read and inferred): The package is the directory `py/demo_sdk/`, named `<name lowercased>_sdk` by pyPackageDir. It uses absolute imports (`from demo_sdk.…`), and pyproject's setuptools finds `demo_sdk*`. (a) For a script inside `py/`: `from demo_sdk import DemoSDK`, then `client = DemoSDK({...})`. This works because Python puts the script's own directory on sys.path. (b) For a script at the repository root: either `pip install -e py` first and then the same import, or `import sys; sys.path.insert(0, "py")` before `from demo_sdk import DemoSDK`. Live HTTP also needs `requests`, imported lazily. The old root README's quick start printed `import os` / `from demo_sdk import DemoSDK` / `client = DemoSDK({...})`, and its offline block had no import at all. From the repository root that fails with ModuleNotFoundError unless the package was installed.
- **evidence**: src/cmp/py/utility_py.ts:11-12 "function pyPackageDir(model: any): string { / return model.const.Name.toLowerCase() + '_sdk'"; src/cmp/py/Main_py.ts:63 "Folder({ name: pkgdir }, () => {"; :76 "File({ name: '__init__.' + target.ext }"; src/cmp/py/Package_py.ts:67-68 "[tool.setuptools.packages.find] / include = [\"${...}_sdk*\"]"; src/cmp/py/fragment/Main.fragment.py:3 "from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs"; out/old/B/README.md:313-314 "import os / from demo_sdk import DemoSDK"; :56 "client = DemoSDK.test()" (no import)
- **old page**: Root README.md:314 'from demo_sdk import DemoSDK' does not run from the repository root without an install or a path change.

### rb

- **answer** (read and inferred): The main file is `rb/Demo_sdk.rb` (rbSdkFile = `<Name>_sdk`), at the root of `rb/`. It loads everything else with require_relative, and the gemspec has `require_paths = ["."]`. (a) For a file inside `rb/`: `require_relative "Demo_sdk"`, then `client = DemoSDK.new({ "apikey" => ENV["DEMO_APIKEY"] })`. (b) For a file at the repository root: `require_relative "rb/Demo_sdk"`, or `$LOAD_PATH.unshift File.join(__dir__, "rb"); require "Demo_sdk"`, or for an installed gem `require "Demo_sdk"`. require_relative resolves against the requiring FILE's directory, not the working directory. The old root README printed `require_relative "Demo_sdk"`, which fails with LoadError in a file at the repository root.
- **evidence**: src/cmp/rb/utility_rb.ts:21-22 "function rbSdkFile(model: any): string { / return model.const.Name + '_sdk'"; src/cmp/rb/Main_rb.ts:62 "File({ name: rbSdkFile(model) + '.' + target.ext }"; src/cmp/rb/Package_rb.ts:68 "spec.require_paths = [\".\"]"; src/cmp/rb/fragment/Main.fragment.rb:3 "require_relative 'utility/struct/voxgig_struct'"; out/old/B/README.md:370 "require_relative \"Demo_sdk\""
- **old page**: Root README.md:370, rb/README.md:37 and rb/REFERENCE.md:11 all use require_relative "Demo_sdk". That is right only for a file inside rb/.

### php

- **answer** (read and inferred): The main file is `<name>_sdk.php` at the root of php/, for example demo_sdk.php. It loads core, config and features through __DIR__ paths, and the entities load lazily the same way. (a) From php/: `<?php require_once 'demo_sdk.php'; $client = new DemoSDK([...]);`, which resolves through include_path '.' or the script's own directory. After `composer install` you can use `require 'vendor/autoload.php';` instead: composer.json autoload lists files ["demo_sdk.php"] plus a classmap. (b) From the repository root: `require_once 'php/demo_sdk.php';` or `require_once __DIR__ . '/php/demo_sdk.php';`. The old root README's live quick start printed `require_once 'demo_sdk.php';`, which fails from the repository root unless the script itself sits in php/. Its test quick start has no require line at all, so run alone it ends in "Class DemoSDK not found".
- **evidence**: src/cmp/php/Main_php.ts:59 "File({ name: model.const.Name.toLowerCase() + '_sdk.' + target.ext }"; fragment/Main.fragment.php:6 "require_once __DIR__ . '/utility/struct/Struct.php';"; MainEntity_php.ts:42 "require_once __DIR__ . '/entity/${entity.name}_entity.php';"; src/cmp/php/Package_php.ts:68-70 "\"autoload\": { \"files\": [\"${...}_sdk.php\"], \"classmap\": [...]"; out/old/B/README.md:334 "require_once 'demo_sdk.php';"; out/old/B/README.md:63-68 (test quick start, no require)

### perl

- **answer** (read and inferred): The main module is perl/lib/DemoSDK.pm. It finds core/, utility/, config.pm and features.pm through Cwd::abs_path(__FILE__), so only the lib directory has to be on @INC. (a) From perl/: `use lib 'lib'; use DemoSDK; my $client = DemoSDK->new({...});`. (b) From the repository root: `use lib 'perl/lib'; use DemoSDK;`. A relative `use lib` resolves against the current directory, not the script's location. There is a Makefile.PL with VERSION_FROM lib/DemoSDK.pm, but the README says the SDK is not on CPAN, and the module reaches ../core outside lib. The old root README printed `use lib 'perl/lib'; use DemoSDK;` for both quick starts, which runs from the repository root, and from nowhere else.
- **evidence**: src/cmp/perl/Main_perl.ts:70-71 "Folder({ name: 'lib' }, () => { File({ name: model.const.Name + 'SDK.pm' }"; fragment/Main.fragment.pm:15 "BEGIN { $DIR = File::Basename::dirname(Cwd::abs_path(__FILE__)) }"; :18 "require(Cwd::abs_path(\"$DIR/../core/helpers.pm\"));"; fragment/Entity.fragment.pm:12 "require(Cwd::abs_path(\"$__dir/../lib/Voxgig/Struct.pm\"));"; src/cmp/perl/Package_perl.ts:55 "VERSION_FROM     => 'lib/${Name}SDK.pm',"; out/old/B/README.md:187 and :550 "use lib 'perl/lib';"

### lua

- **answer** (read and inferred): (a) From lua/: `local sdk = require("demo_sdk")`. This works because the module is the file <name>_sdk.lua at lua/ and Lua's default package.path includes ./?.lua, which also resolves the SDK's own requires (core.helpers, utility.struct.struct, features, config_shared). dkjson must be installed (rockspec dependency). (b) From the repository root, prepend the path first: `package.path = "lua/?.lua;lua/?/init.lua;" .. package.path` then `local sdk = require("demo_sdk")`. Without it, require fails with module not found. The old root README's Lua quick start (README.md:90-95) prints `local client = sdk.test()` with no require line, so `sdk` is an undefined global and the snippet fails as a standalone file from any directory. The Lua section of 'Quickstart in other languages' (README.md:384-397) has require("demo_sdk"), which would not resolve from the root without the package.path line.
- **evidence**: S/src/cmp/lua/Main_lua.ts:137: "File({ name: model.name + '_sdk.' + target.ext }, () => {"; S/src/cmp/lua/Package_lua.ts:137: "[\"${model.name}_sdk\"] = \"${model.name}_sdk.lua\"," and :97: "\"dkjson >= 2.5\","; Main.fragment.lua:3-7: "local json = require(\"dkjson\")" / "local vs = require(\"utility.struct.struct\")" / "local Utility = require(\"core.utility_type\")"; S/tm/lua/Makefile:17: "busted --no-auto-insulate -p _test test/" (run from lua/, no path setup); P/base32/out/old/B/README.md:93: "local client = sdk.test()"; :385: "local sdk = require(\"demo_sdk\")"
- **old page**: lua/README.md:16-19 says to add `path/to/lua/?.lua;path/to/lua/?/init.lua;;` to LUA_PATH, which agrees with (b).

### elixir

- **answer** (read and inferred): No import line is needed: modules are global once compiled, and `alias Demo.Helpers, as: H` is only a convenience. (a) From elixir/, put the code in a file and run it with `mix run file.exs`. mix.exs defines app :demo with elixirc_paths ["lib"] and extra_applications [:inets, :ssl]. (b) From the repository root there is no mix.exs, so `mix run` cannot load the project. A standalone file would need `Mix.install([{:demo, path: "elixir"}])` and be run with `elixir file.exs`, or be run as `cd elixir && mix run ../file.exs`. The old root README's Elixir quick start (README.md:139-148) prints `alias Demo.Helpers, as: H` / `sdk = Demo.test()` / ... with no setup, so from the repository root with `elixir file.exs` it would fail with an undefined module Demo.
- **evidence**: S/src/cmp/elixir/Package_elixir.ts: "app: :${app},", "elixirc_paths: elixirc_paths(Mix.env()),", "def application, do: [extra_applications: [:inets, :ssl]]", "defp elixirc_paths(_), do: [\"lib\"]"; Main.fragment.ex:7: "defmodule ProjectName do"; P/base32/out/old/B/README.md:142-144: "alias Demo.Helpers, as: H" / "sdk = Demo.test()"
- **old page**: elixir/README.md:20-40 documents adding {:demo, path: "../demo-sdk/elixir"} as a mix dependency and running mix deps.get, which is consistent.

### java

- **answer** (read and inferred): Package root is <org>.<name>sdk (B: voxgig.demosdk), classes in .core/.entity. A file needs `import java.util.Map; import voxgig.demosdk.core.DemoSDK; import voxgig.demosdk.core.SdkEntity;` plus a class with `public static void main(String[] args)`; to call deleted() also `import voxgig.demosdk.entity.EntityBase;`. The SDK is not on Maven Central; pom.xml compiles core/utility/feature/entity from the java/ dir (sourceDirectory = basedir) with no runtime deps. (a) from java/: `mvn -q compile` then `javac -cp target/classes Main.java && java -cp target/classes:. Main` (or `mvn install` and depend on com.voxgig:demo-sdk... from a Maven project). (b) from repo root: same imports, classpath `java/target/classes`. The imports do not change; only the classpath does. Old root README quick start (B/README.md:482-501) prints imports followed by top-level statements with no class or main: it does not compile as a .java file from anywhere (only as a jshell snippet with the classpath set); the offline block at :150-156 has no imports at all.
- **evidence**: src/cmp/java/utility_java.ts:29-37 "function javaPackage(model: any): string {" ... "return org + '.' + name + 'sdk'"; src/cmp/java/Package_java.ts:94 "<sourceDirectory>\${project.basedir}</sourceDirectory>" :102-106 "<include>core/**/*.java</include>" ...; tm/java/Makefile "build:" "mvn -q -DskipTests compile"; out/old/B/README.md:485-495 "import java.util.Map;" "import voxgig.demosdk.core.DemoSDK;" ... "DemoSDK client = new DemoSDK(options);"
- **old page**: java README Install: "cd java && mvn install" - plausible (installs to the local Maven repo). Root quick start not a compilable program.

### kotlin

- **answer** (read and inferred): Package voxgig.demosdk (same rule as java). A file needs `import voxgig.demosdk.core.DemoSDK` and `import voxgig.demosdk.core.SdkEntity` and a `fun main() { ... }`. build.gradle.kts compiles core/utility/feature/entity into a jar (kotlin jvm plugin; no maven-publish, so nothing installs to a local repo). (a) from kotlin/: `gradle build` then `kotlinc Main.kt -cp build/libs/<artifact>-<version>.jar -include-runtime -d main.jar` (or kotlinc -script for .kts). (b) from root: same imports, path kotlin/build/libs/... Old root README quick start (B/README.md:519-530) has imports and top-level statements with no main - not compilable as a .kt file - AND omits the server map: model B's base is https://{tenant}.example.com/{region}, so in live mode the constructor throws SdkError server_var_required (the java block passes tenant/region; kotlin's does not).
- **evidence**: src/cmp/kotlin/utility_kotlin.ts:27-35 "function kotlinPackage(model: any): string {"; src/cmp/kotlin/Package_kotlin.ts:48 "rootProject.name = \"${artifactId}\"" :82 "sourceSets[\"main\"].kotlin.setSrcDirs(listOf(\"core\", \"utility\", \"feature\", \"entity\"))"; tm/kotlin/utility/MakeOptions.kt:176-178 "else -> throw SdkError(\"server_var_required\"," "\"$sdkname: the server variable '$name' is required"; out/old/B/README.md:523-525 "val client = DemoSDK(mutableMapOf<String, Any?>(" "\"apikey\" to System.getenv(\"DEMO_APIKEY\")," "))"; out/old/B/README.md:969 "- Upstream API: `https://{tenant}.example.com/{region}`"
- **old page**: kotlin README Install: "cd kotlin && gradle build". Root quick start would throw server_var_required (inferred: assumes no server defaults in config).

### scala

- **answer** (read and inferred): The SDK is a scala-cli project. The only build file is `project.scala` (`//> using scala "3.7.3"`), and scala-cli compiles every .scala/.java file under the directory. The classes are in package `<org>.<name>sdk.core`, here `voxgig.demosdk.core`. (a) From `scala/`: put the program inside the project directory, as an object with a main method or an @main, with `import voxgig.demosdk.core.{DemoSDK, SdkEntity}`, and run `scala-cli run . --main-class <Main>`, which is how the Makefile runs its own mains. (b) From the repository root: the same import, with the SDK directory passed as an input, for example `scala-cli run scala Prog.scala --main-class <Main>`. That is inferred from scala-cli's directory inputs; no packaging names a published artifact. The old root README's test-mode block (README.md:207-211) printed `val client = DemoSDK.testSDK(null, null)` / `val ambient = client.ambient(null).load(null, null).asInstanceOf[SdkEntity]` / `println(ambient.data())` with no import and as top-level statements. It would not compile as a .scala file from the root or anywhere else: it lacks the import, and a top-level `println` is not allowed outside a script. The live quick start (README.md:580-590) does carry the two imports.
- **evidence**: src/cmp/scala/Package_scala.ts:13-14 `File({ name: 'project.scala' }, () => {` `Content(`//> using scala "3.7.3"`; tm/scala/Makefile:3-8 `# .scala/.java file under the project directory` ... `scala-cli compile .`; tm/scala/Makefile:24 `scala-cli run . --main-class SdkTestMain`; src/cmp/scala/utility_scala.ts:24-32 `function scalaPackage(model: any): string {` ... `return org + '.' + name + 'sdk'`; src/cmp/scala/fragment/Main.fragment.scala:1 `package SCALAPACKAGE.core`; out/old/B/README.md:207-211 (quoted in the answer); out/old/B/README.md:580-582 `import voxgig.demosdk.core.DemoSDK` `import voxgig.demosdk.core.SdkEntity`
- **old page**: Root README:207-211 has no import (see the answer). scala/README explanation section (around :943) says 'package `voxgig.demosdk.core`' and 'dependency-free scala-cli project', which agrees.

### csharp

- **answer** (read and inferred): The SDK is a class library: `DemoSDK.csproj` (net8.0, ImplicitUsings, no OutputType, so a Library) compiles every .cs file except test/**. Namespaces are `DemoSdk` (RootNamespace `${Name}Sdk`) and `Voxgig.Struct` for StructUtils. A program file dropped into `csharp/` would be compiled into the library, where top-level statements are not allowed, so a standalone program needs its own console project. (a) Next to the SDK, `dotnet new console` plus `<ProjectReference Include="../csharp/DemoSDK.csproj" />`. (b) From the repository root, the same with the path `csharp/DemoSDK.csproj`, which is what the README install text shows as `dotnet add reference`. In both cases the file needs `using DemoSdk;` and `using Voxgig.Struct;`. The old root README's test-mode block (README.md:133-135) printed `var client = DemoSDK.TestSDK(null, null);` / `var ambient = (IEntity)client.Ambient().Load(null)!;` / `Console.WriteLine(StructUtils.Jsonify(ambient.Data()));` with no `using` lines. ImplicitUsings does not bring in DemoSdk or Voxgig.Struct, so it would not compile from the root or anywhere else. The live quick start (README.md:454-455) does carry both `using` lines.
- **evidence**: src/cmp/csharp/Package_csharp.ts:54-62 `File({ name: Name + 'SDK.csproj' }, () => {` ... `<TargetFramework>net8.0</TargetFramework>` ... `<ImplicitUsings>enable</ImplicitUsings>` ... `<RootNamespace>${Name}Sdk</RootNamespace>`; :74-76 `<Compile Remove="test/**" />`; src/cmp/csharp/fragment/Main.fragment.cs:7 `namespace ProjectNameSdk;`; tm/csharp/utility/struct/Struct.cs:46 `namespace Voxgig.Struct`; src/cmp/csharp/ReadmeInstall_csharp.ts:17 `dotnet add reference ../${model.const.Name}SDK/${model.const.Name}SDK.csproj`; out/old/B/README.md:133-135 (quoted in the answer)
- **old page**: The root README test-mode block has no `using` lines. The live block has them. ReadmeInstall:17 names `../DemoSDK/DemoSDK.csproj`, but the generated directory is `csharp/` (ReadmeInstall:32 `cd csharp && dotnet build`), so that path is likely wrong (unsure).

### swift

- **answer** (read and inferred): The module is `<Name>Sdk` (DemoSdk for model B), a SwiftPM library product of the package whose Package.swift is in `swift/`. A standalone file needs `import DemoSdk`. It also needs `import Foundation` when it uses ProcessInfo, because the SDK does not re-export Foundation (there is no @_exported import anywhere in the runtime). Swift cannot run a lone file against the package with plain `swift file.swift`. The file has to be a target in a SwiftPM package that depends on the DemoSdk product. (a) From `swift/`, that means a separate package with `.package(path: "..")` or similar; the generated Package.swift itself is regenerated, so adding an executable target to it does not survive. (b) From the repository root, a package with `.package(path: "swift")` and `.product(name: "DemoSdk", package: ...)`. The import lines are the same in both cases. The old root README's Swift quick start prints `import DemoSdk`, then builds VMap options with an apikey read from ProcessInfo, and no `server`. That would not compile as written, because ProcessInfo needs Foundation. Even with Foundation imported, it would not run for model B: B's base URL is templated and requires server.tenant and server.region (see the ts README). makeOptions throws server_var_required, and because the initializer cannot throw it calls fatalError, so the program traps at construction. The old root README's test quick start has no import line at all. The old swift README's install advice of `.package(url: "<repo-url>", exact: ...)` points SwiftPM at a repository whose Package.swift is in swift/, not the root, so it would not resolve; this point is inferred from SwiftPM's rule that the manifest sits at the repository root.
- **evidence**: src/cmp/swift/Package_swift.ts:93 "name: \"${Name}Sdk\","; :103 ".library(name: \"${Name}Sdk\", targets: ${products}),"; src/cmp/swift/ReadmeTopQuick_swift.ts:32 "const MODULE = model.const.Name + 'Sdk'" and :41 "import ${MODULE}"; src/cmp/swift/ReadmeExamplesTest_swift.ts:31 "import Foundation" (the doc-example test supplies Foundation itself, which hides the gap). A search for @_exported in tm/swift and src/cmp/swift finds nothing. tm/swift/Sources/ProjectNameSDK/utility/MakeOptions.swift:148 "fatalError(errMessage(error))"; :224 "throw ProjectNameError(\"server_var_required\","; out/old/B/README.md:597 "import DemoSdk" and :599-602 (options with apikey only); out/old/B/ts/README.md:222 "`server` | `object` | **Required.**"; src/cmp/swift/ReadmeInstall_swift.ts:42 ".package(url: \"<repo-url>\", exact: ...)".
- **old page**: B/README.md:596-611 prints `import DemoSdk`, then VMap options with apikey from ProcessInfo, then `DemoSDK(options)` and `try client.Ambient().load(nil, nil)`. It would not run from the repository root: it is not a package target, Foundation is missing, and B has no server variables, so construction traps.

### cpp

- **answer** (read and inferred): The SDK is header-only, and the umbrella header is core/sdk.hpp. That header includes types.hpp, ../utility/pipeline.hpp, ../feature/base.hpp, config.hpp, ../entity/entities.hpp and client.hpp by relative quoted paths, so only one include directory is needed. Everything sits in namespace sdk. (a) From cpp/: `#include "core/sdk.hpp"` and `using namespace sdk;` (plus `<iostream>`/`<cstdlib>` for std::cout/getenv), compiled with `g++ -std=c++17 -I. app.cpp`. The Makefile uses -std=c++17 and -pthread. The code must sit inside `int main() { ... }`. (b) From the repository root: the same lines with `-Icpp`, or `#include "cpp/core/sdk.hpp"`. A program that does only this cannot make live calls: no HTTP transport is built in, and the fetcher throws fetch_no_transport unless options.system.fetch holds a callable. The old root README's live C++ quick start prints `#include <cstdlib>`, `#include "core/sdk.hpp"` and `using namespace sdk;`, then statements outside any function. Run from the root it would not compile: the include needs -Icpp, there is no main() (a `std::cout <<` statement at namespace scope is ill-formed), and <iostream> is not included (unsure whether it arrives transitively). Even fixed, it would fail at construction for model B, whose templated base requires server variables: resolveServerBase throws server_var_required from the constructor. The load after that would fail with fetch_no_transport. The test quick start (B/README.md:125-129) has no include, no namespace and no main().
- **evidence**: tm/cpp/core/sdk.hpp:9-14 "#include \"types.hpp\" ... #include \"client.hpp\""; src/cmp/cpp/fragment/Main.fragment.cpp:13 "namespace sdk {"; tm/cpp/Makefile:12 "CXXFLAGS ?= -std=c++17 -O0 -g -Wall -Wextra -Wno-unused-parameter -pthread"; src/cmp/cpp/ReadmeTopQuick_cpp.ts:40-41 "#include <cstdlib>\n#include \"core/sdk.hpp\""; tm/cpp/utility/pipeline.hpp:612-613 "throw ctx->makeError(\"fetch_no_transport\", \"live HTTP transport not available; provide options.system.fetch\");"; :1936 "throw std::make_shared<SdkError>(\"server_var_required\","; out/old/B/README.md:435-438 "#include <cstdlib>" "#include \"core/sdk.hpp\"" "using namespace sdk;"; out/old/B/README.md:126 "auto client = DemoSDK::testSDK();".
- **old page**: B/README.md:432-447 and B/cpp/README.md:19-38 ("put it on your compiler's include path", "-Ithird_party/demo-sdk/cpp"). The include path advice is right; the snippets are not standalone programs, and no page mentions system.fetch.

### zig

- **answer** (read and inferred): The packaging is `build.zig`, which declares a named module "sdk" rooted at `root.zig` with the module "voxgig-struct" imported. It declares no executable. `build.zig.zon` lists the package paths. `root.zig` re-exports the client, `test_sdk` and the helpers as `h`. A program writes `const std = @import("std"); const sdk = @import("sdk"); const h = sdk.h;` and, inside `pub fn main() void { const client = sdk.test_sdk(h.vnull(), h.vnull()); ... }`. `@import("sdk")` resolves only when a build wires the module. (a) From `zig/`: edit or extend `build.zig` with an executable whose root module does `addImport("sdk", sdk_mod)`; a plain `zig run quick.zig` cannot resolve "sdk", and an `@import("root.zig")` path import fails because the SDK sources themselves import "voxgig-struct" by module name. (b) From the repository root: no root build.zig is generated, so the program needs its own build.zig.zon with a path dependency on `zig` (`.sdk = .{ .path = "zig" }`) and `b.dependency("sdk", .{}).module("sdk")`. This is inferred from zig build semantics: `b.addModule` exposes the module to dependents. The old root README quick start printed `const std = @import("std"); const sdk = @import("sdk"); const h = sdk.h;` followed by a top-level `const client = sdk.test_sdk(...)` and a top-level `switch`. That is not a valid standalone program (no `main`, and runtime work at container level), and from the repository root "sdk" does not resolve.
- **evidence**: src/cmp/zig/fragment/Build.fragment.zig:28-29 `const struct_mod = b.addModule("voxgig-struct", .{` `.root_source_file = b.path("utility/voxgigstruct/struct.zig"),`; :46-51 `const sdk_mod = b.addModule("sdk", .{` `.root_source_file = b.path("root.zig"),` ... `sdk_mod.addImport("voxgig-struct", struct_mod);`; :54-103 test steps only, no addExecutable; src/cmp/zig/Package_zig.ts:26-44 `File({ name: 'build.zig.zon' }` ... `.paths = .{ "build.zig", "build.zig.zon", "root.zig", "core", ...`; src/cmp/zig/fragment/Root.fragment.zig:18-21 `pub const ProjectNameSDK = sdk.ProjectNameSDK;` ... `pub const test_sdk = sdk.test_sdk;`; :74 `pub const h = helpers;`; src/cmp/zig/fragment/Main.fragment.zig:4 `const vs = @import("voxgig-struct");`; out/old/B/README.md:225-233 "const sdk = @import(\"sdk\");" ... "const client = sdk.test_sdk(h.vnull(), h.vnull());" "switch (client.ambient(h.vnull()).load(h.vnull(), h.vnull())) {"
- **old page**: zig/README.md Install shows a `build.zig.zon` dependency `.sdk = .{ .url = ... }` and `cd zig && zig build`. It never says how to wire the module into an executable.

### rust

- **answer** (read and inferred): The packaging is a Cargo package whose library target is named `<model>_sdk`, with its root at `lib.rs` (`[lib] name = "${crateIdent}"`, `path = "lib.rs"`); the package name is crateName (`<origin-without-sdk>-<sdkname>`). Every needed name is re-exported at the crate root. Operations are trait methods, so the program must import `DemoEntityBase` (ops) and `Entity` (data). (a) From `rust/`: the file must be a Cargo target of this package, for example `rust/examples/quick.rs` run with `cargo run --example quick` (Cargo's example discovery; inferred, not stated in this repository), with `use demo_sdk::{test_sdk, DemoEntityBase, Entity, Value};` and a `fn main() { let client = test_sdk(Value::Noval, Value::Noval); let a = client.ambient(Value::Noval).load(Value::Noval, Value::Noval).unwrap(); println!("{:?}", a.data(None)); }`. (b) From the repository root: nothing is generated there (no root Cargo.toml or workspace), so the program needs its own crate whose Cargo.toml has `<crateName> = { path = "rust" }`, and then the same `use demo_sdk::{...}` lines. The old root README quick start printed `use demo_sdk::{jo, test_sdk, DemoEntityBase, Entity, Value};` followed by bare `let client = ...` statements with no `fn main`, so it is not a standalone program from anywhere. From the repository root there is no Cargo project to run it in.
- **evidence**: src/cmp/rust/Package_rust.ts:27-36 `[package]` `name = "${crateName(model)}"` ... `[lib]` `name = "${crateIdent(model)}"` `path = "lib.rs"`; src/cmp/rust/utility_rust.ts:47-49 `function crateName(model: any): string { const org = (model.origin || 'voxgig-sdk').replace(/-sdk$/, '')` `return `${org}-${sdkName(model.name)}`...`; :55-56 `function crateIdent(model: any): string { return `${model.name}_sdk`...`; src/cmp/rust/Main_rust.ts:207 `pub use crate::core::sdk::{test_sdk, ${model.const.Name}SDK};` and :209-213 trait re-exports; tm/rust/core/types.rs:81-82 ops are trait methods; out/old/B/README.md:197-201 "use demo_sdk::{jo, test_sdk, DemoEntityBase, Entity, Value};" / "let client = test_sdk(Value::Noval, Value::Noval);"
- **old page**: rust/README.md Install: `voxgig-demo-sdk = { path = "../rust" }`, while the root README Packages table names the Rust package `voxgig-sdk-demo-sdk`. The two pages disagree; which name Cargo.toml holds depends on model.origin, which I did not verify.

### clojure

- **answer** (read and inferred): The packaging is a tools.deps `deps.edn` with `:paths ["src"]` and only org.clojure/clojure as a dependency. voxgig.struct is vendored at src/voxgig/struct.clj. (a) From clojure/, a file needs `(require '[sdk.api :as api] '[voxgig.struct :as vs])`, plus `'[sdk.entity.<name> :as e-<name>]` to call an op, and runs with `clojure -M prog.clj`. (b) The repository root has no deps.edn that I found, so the same file needs `clojure -Sdeps '{:paths ["clojure/src"]}' -M prog.clj`, or a `{:local/root "clojure"}` dependency. The old root quick start printed the three requires, `(api/test-sdk nil nil)` or `(api/make-sdk (vs/jm "apikey" ...))`, and `(e-ambient/load (api/ambient client nil) nil nil)`. It gave no run command. Run from the root with plain `clojure`, the require of sdk.api would fail because it is not on the classpath (inferred).
- **evidence**: src/cmp/clojure/Package_clojure.ts:24 `const roots = ['src', ...extraFeatures(model, target).map((f: any) => f.path)]`; :28-29 `{:paths [${roots...}] :deps {org.clojure/clojure {:mvn/version "1.12.5"}}`; tm/clojure/src/voxgig/struct.clj (vendored file present); out/old/B/README.md:113-120 ```(require '[sdk.api :as api] '[sdk.entity.ambient :as e-ambient] '[voxgig.struct :as vs]) (def client (api/test-sdk nil nil)) (def ambient (e-ambient/load (api/ambient client nil) nil nil))```
- **old page**: README.md:32-36 gives a `{:local/root "../clojure"}` dependency, which is the right mechanism. The root README gives no run instruction.

### ocaml

- **answer** (read and inferred): No library is built or installed: no .cma, no dune, and the opam file runs `make build` with no install step. `make build` only runs `ocamlc -c` on the sources, which leaves .cmo/.cmi files beside them. A program must therefore be compiled and linked with every SDK module, in the Makefile's fixed order. (a) From ocaml/: `ocamlc -I utility -I . utility/vregex.ml utility/voxgig_struct.ml sdk_json.ml sdk_types.ml sdk_helpers.ml sdk_schema.ml sdk_prepare_auth.ml sdk_runtime.ml sdk_features.ml sdk_config.ml sdk_entity_*.ml sdk_client.ml sdk_error.ml prog.ml -o prog`. The file itself needs `open Voxgig_struct` (Str, Noval, stringify, empty_map), `open Sdk_helpers` (jo) and `open Sdk_types` (the e_* fields). (b) From the root: the same, with every path prefixed `ocaml/` and `-I ocaml -I ocaml/utility`. The old root quick start: the live block (B/README.md:535-543) has the three opens and `Sdk_client.make ...`, but it gives no compile command, and with no system.fetch its e_load would fail with fetch_no_transport. The test block (B/README.md:177-182) has NO open lines, yet uses `empty_map` and `stringify`, so it does not compile anywhere, root or SDK directory (inferred: unbound values).
- **evidence**: tm/ocaml/Makefile:77-79 `RUNTIME = utility/vregex.ml utility/voxgig_struct.ml sdk_json.ml \ sdk_types.ml sdk_helpers.ml sdk_schema.ml sdk_prepare_auth.ml \ sdk_runtime.ml sdk_features.ml $(FEATURE_SRC)`; :87 `SDK = $(RUNTIME) sdk_config.ml $(ENTITIES) sdk_client.ml sdk_error.ml`; :166-168 `build: lint` / `lint:` / `$(OCAMLC) $(INC) -c $(SDK)`; src/cmp/ocaml/Package_ocaml.ts:59-61 `build: [ [make "build"] ]`; src/cmp/ocaml/ReadmeTopTest_ocaml.ts:33-36 ```ocaml\nlet () =\n  let client = Sdk_client.test () in```; ReadmeTopQuick_ocaml.ts:37-40 ```ocaml\nopen Voxgig_struct\nopen Sdk_helpers\nopen Sdk_types```; tm/ocaml/sdk_helpers.ml:14 `let jo (pairs ...`; utility/voxgig_struct.ml:137 `let empty_map () = Map { entries = [] }`
- **old page**: README.md:24-26 'cd ocaml && make build' is presented as the install, but it type-checks only. Nothing tells a program how to link.


## 13. Old page statements the code contradicts

### ts

- **answer** (read and certain): Contradictions between the old ts pages and the code: (1) utility() is called a 'Deep copy' or 'copy', but it returns the live instance. (2) The entity accessor is documented as `Ambient(data?)` with 'Initial entity data', but the argument is entopts. (3) direct: 'on failure ... err holds the error', but a non-2xx with a readable body has no err. (4) The ctrl example `{ explain: true }` makes ts ops throw a TypeError; explain must be an object. (5) In the no-test SDK the pages document DemoSDK.test() and tester(), which throw. (6) The entity method table omits deleted() and stream().
- **evidence**: out/old/B/ts/README.md:235 "| `utility()` | `Utility` | Deep copy of the SDK utility object. |"; :239 "| `Ambient(data?)` | `AmbientEntity` | Create an Ambient entity instance. |"; :74-76 "The low-level `direct()` method does **not** throw — it returns the result envelope. Branch on `ok`; on failure `status` holds the HTTP status (for error responses) and `err` holds the error"; out/old/B/ts/REFERENCE.md:162 "| `fetchargs.ctrl` | `object` | Control options (e.g. `{ explain: true }`). |"; out/old/no-test/ts/README.md:130 "const client = DemoSDK.test()"
- **old page**: see answer

### js

- **answer** (read and certain): The same contradictions as ts on the js pages: utility() is called a 'Deep copy', `Ambient(data?)`, the no-test test() and tester(). In addition the root README JS quick start uses top-level await in a require()-based (CommonJS) snippet.
- **evidence**: out/old/B/js/README.md:227 "| `utility()` | `Utility` | Deep copy of the SDK utility object. |"; :230 "| `Ambient(data?)` | `AmbientEntity` | Create an Ambient entity instance. |"; out/old/no-test/js/README.md:136 "const client = DemoSDK.test()"; out/old/B/README.md:506,513
- **old page**: see answer

### go

- **answer** (read and certain): Contradictions in the old Go pages: (1) accessor documented as taking initial data (`Pass nil for no initial data`) - the map is entity options; (2) Direct documented as following `(value, error)` with `if err != nil` - the error is always nil; (3) Result shape omits the `err` key of Direct's map; (4) REFERENCE ctrl example `{"explain": true}` is ignored - must be a map; (5) the no-test page promises a mock client with no server - TestSDK there blocks every request (fetch_mode_block); (6) root README Go quick start is a fragment without package/main/imports.
- **evidence**: see questions 1, 9, 11, 10, 12 evidence; out/old/B/go/REFERENCE.md "Pass `nil` for no initial data."; out/old/B/go/README.md "`Direct` follows the same `(value, error)` convention:"; out/old/B/go/REFERENCE.md:101 "(e.g. `map[string]any{\"explain\": true}`)"

### c

- **answer** (read and certain): Contradictions in the old C pages: (1) "Error handling" shows TypeScript try/catch and `await client.Ambient().load()` - C has no exceptions; failures are a NULL return plus *err; (2) the direct how-to says a non-2xx carries status+data and a transport failure err, "Only one is present" - an unreadable body carries both status and err; (3) the install cc line uses -I c/core with `#include "core/api.h"`, which does not resolve from the root; (4) the tutorial, quick starts (C README and root README) construct the client without the `server` variables the templated base requires - make_options aborts the process outside test mode; (5) test_sdk is described as a mock-transport client unconditionally; (6) the README entity vtable table omits `deleted`/`mark_deleted`; (7) the runtime table lists sdk_direct's failure as `error parameter PNError**`, but sdk_direct never sets it.
- **evidence**: out/old/B/c/README.md "Entity operations reject on failure, so wrap them in `try` / `catch`:" followed by a ```ts block; README "Only one is present."; Main.fragment.c:264-270 (status and err both set); tm/c/utility/make_options.c:124-128 abort; out/old/B/c/README.md:54-57 "DemoSDK* client = demo_sdk_new(cmap(1," / "\"apikey\", v_str(getenv(\"DEMO_APIKEY\"))));"; base32/runtime-table.md (## c) "| sdk_direct | ... | error parameter PNError** |"

### py

- **answer** (read and certain): (1) The accessor's argument is documented as `data` but becomes entity options (Q1). (2) The no-test README promises a mock client from `test()`, but every request is blocked (Q10). (3) The root quick start's import does not resolve from the repository root (Q12). (4) The REFERENCE does not say that direct's err can be a plain string, or that a custom system.fetch that raises escapes direct (Q9).
- **evidence**: See Q1, Q9, Q10 and Q12. py/REFERENCE.md: 'Pass `None` for no initial data' wording parallels rb; no-test/py/README.md:202 'Creates a test-mode client with mock transport.'

### rb

- **answer** (read and certain): (1) rb/REFERENCE.md:97 gives `{ "explain" => true }` as an example, but true is ignored (Q11). (2) 'Pass `nil` for no initial data' is wrong: the argument is entopts (Q1). (3) direct's 'does not raise' holds only for ProjectNameError (Q9), and the documented result shape omits headers. (4) The no-test README promises a mock (Q10). (5) require_relative fails in a file at the repository root (Q12).
- **evidence**: rb/REFERENCE.md:97 "(e.g. `{ \"explain\" => true }`)"; rb/REFERENCE.md:62 "Create a new `Planet` entity instance. Pass `nil` for no initial data."; rb/REFERENCE.md:84-86 direct return shape; src/cmp/rb/fragment/Main.fragment.rb:213 "rescue ProjectNameError => err"

### php

- **answer** (read and certain): Contradictions in the old PHP pages: (1) The accessor is described as "Create an Ambient entity instance", but with no argument it returns a cached one, and its `$data` argument is used as entity options, not data. (2) `ok` is "true if the HTTP status is 2xx", but a 2xx with a non-JSON body is ok=false with err. (3) err is said to hold "a transport error", but it also holds a body-parse error. (4) The direct example calls `$err->getMessage()`, but the default transport's err is a string. (5) The no-test README offers DemoSDK::test as a mock client, and in that SDK every call is blocked.
- **evidence**: out/old/B/php/README.md:222 "| `Ambient` | `($data): AmbientEntity` | Create an Ambient entity instance. |"; :257 "| `ok` | `bool` | `true` if the HTTP status is 2xx. |"; :68-69 "`err` holds a transport error"; :80 "($err ? $err->getMessage() : ..."; code as in Q1, Q9, Q10
- **old page**: see answer

### perl

- **answer** (read and certain): Contradictions in the old Perl page: (1) Its error-handling section and its Entity state example are TypeScript (`const result = await client.direct({...})`, `client.Ambient()`, `ambient.data()`), not Perl. Those methods do not exist in Perl, where the record is read with data_get. (2) `ok` is described as "True if the HTTP status is 2xx", which is false for an unreadable 2xx. (3) The comment says only one of status and err is present, but an unreadable body has both. (4) The no-test page offers test() as a mock client.
- **evidence**: out/old/B/perl/README.md:82 "const result = await client.direct({"; :978-983 (ts block: "const ambient = client.Ambient()", "ambient.data()"); :260 "| `ok` | `boolean` | True if the HTTP status is 2xx. |"; :113-115 "a transport-level failure carries err instead. Only one is present"; code as in Q9
- **old page**: see answer

### lua

- **answer** (read and certain): (1) README.md:59-68 says direct follows the (value, err) convention and shows `if err then error(err) end`, but direct's second value is always nil. (2) REFERENCE.md:94 gives `{ explain = true }` as a ctrl example, but true is ignored. (3) README.md:248-249 says the envelope has ok, status, headers, data and leaves out err.
- **evidence**: Main.fragment.lua:300,315,368: every return ends ", nil"; context.lua:53: "if type(ctrl_raw.explain) == \"table\" then"; out/old/B/lua/README.md:59: "`direct` follows the same `(value, err)` convention:"; REFERENCE.md:94: "| `fetchargs.ctrl` | `table` | Control options (e.g. `{ explain = true }`). |"
- **old page**: see answer

### elixir

- **answer** (read and certain): (1) The Elixir README's 'Error handling' (README.md:76-100) and 'Entity state' (README.md:1004-1010) blocks are TypeScript code (```ts, client.Ambient().load(), await) on the Elixir page. (2) README.md:276 says ok is true if the status is 2xx, but a 2xx with an unreadable body is ok false. (3) README.md:281 says on error ok is false and err carries the error, but a readable non-2xx has no err.
- **evidence**: out/old/B/elixir/README.md:76: "```ts", :78: "const ambient = await client.Ambient().load()"; :1004: "```ts"; Main.fragment.ex:273: "S.jm([\"ok\", body_err == nil and status >= 200 and status < 300,"
- **old page**: see answer

### java

- **answer** (read and certain): Contradictions in the old java page: (1) direct how-to says only one of status/err is present - both are present for an unreadable body. (2) 'ok true if the HTTP status is 2xx' - a 2xx with an unreadable body gives ok false. (3) no-test page promises a mock transport/mock record from testSDK - load throws fetch_mode_block. (4) 'Error handling' section in the java README uses ts code (client.Ambient().load(), await). (5) remove 'marked as deleted' but the mark (deleted()) is undocumented and not on SdkEntity.
- **evidence**: out/old/B/java/README.md:110-112 "// A non-2xx response carries status + data (the error body); a" "// transport-level failure carries err instead. Only one is present, so"; :254 "| `ok` | `Boolean` | `true` if the HTTP status is 2xx. |"; :64-72 "```ts" "const ambient = await client.Ambient().load()"; tm/java/core/SdkClient.java:370 "out.put(\"ok\", bodyErr == null && status >= 200 && status < 300);"
- **old page**: see answer

### kotlin

- **answer** (read and certain): Same direct contradictions as java (Only one is present; ok iff 2xx), the no-test mock promise, and the root quick start omitting required server variables. README says name is `val`, it is `override var` (writable).
- **evidence**: out/old/B/kotlin/README.md:104-105 "// A non-2xx response carries status + data (the error body); a" "// transport-level failure carries err instead. Only one is present, so"; :246 "| `ok` | `Boolean` | `true` if the HTTP status is 2xx. |"; :232 "| `name` | `val: String` | The entity name. |"; src/cmp/kotlin/fragment/EntityBase.fragment.kt:48 "override var name: String = \"\""
- **old page**: see answer

### scala

- **answer** (read and inferred): Contradictions met: (1) direct's result table: ok is 'true if 2xx' (false for an unreadable 2xx), and 'On error ... err contains the error' (no err for a readable non-2xx). (2) The 'Error handling' and 'Entity state' sections of scala/README.md show TypeScript blocks (`await client.direct({...})`, `client.Ambient()`), which are not this runtime's API: Scala uses `client.ambient(null)` with no await. (3) The live quick start (root README:580-590) constructs `new DemoSDK(options)` with only apikey. For model B the TypeScript quick start says the server URL is templated and `server` is required, and Make.scala throws `server_var_required` at construction outside test mode, so the Scala quick start would throw. (4) The no-test page's 'Use test mode' example cannot work (Q10). (5) The README entity table omits `patch` and `deleted()`.
- **evidence**: out/old/B/scala/README.md:249 `| \`ok\` | \`Boolean\` | \`true\` if the HTTP status is 2xx. |`; :254 `On error, \`ok\` is \`false\` and \`err\` contains the error value.`; :77 `const result = await client.direct({`; out/old/B/README.md:272-275 `// Required: this API's server URL is templated on these.` `server: {`; tm/scala/utility/Make.scala:446 `else throw new SdkError("server_var_required",`

### csharp

- **answer** (read and inferred): Contradictions met: (1) direct's result: 'ok true if 2xx' and 'On error ... err' are wrong for the unreadable-2xx and readable-non-2xx cases. (2) csharp/README.md 'Error handling' (:72-90) and 'Entity state' (:966-) show TypeScript code (`await client.direct({...})`, `client.Ambient(); await ambient.load()`) on a C# page; C# is synchronous. (3) REFERENCE.md:36 shows `TestSDK(testopts = null, sdkopts = null)`, but the code has no defaults. (4) The live quick start (root README:454-462) passes only apikey. Model B's base is templated (the TypeScript quick start says server variables are required), and MakeOptions throws `server_var_required` at construction outside test mode, so that example would throw. (5) The no-test page still describes TestSDK as a mock client (Q10). (6) The deny err for direct/graphql is a plain Exception with no code, unlike Scala's SdkError.
- **evidence**: out/old/B/csharp/README.md:264 `| \`ok\` | \`bool\` | \`true\` if the HTTP status is 2xx. |`; :269 `On error, \`ok\` is \`false\` and \`err\` contains the error value.`; :79 `const result = await client.direct({`; out/old/B/csharp/REFERENCE.md:36 `#### \`DemoSDK.TestSDK(testopts = null, sdkopts = null)\``; tm/csharp/utility/MakeOptions.cs:258 `// THROWS: this is construction-time misconfiguration.`; out/old/B/README.md:272 `// Required: this API's server URL is templated on these.`

### swift

- **answer** (read and certain): Contradictions in the old swift pages. (1) The direct result table says ok is true "if the HTTP status is 2xx" (README.md:265); a 2xx with an unreadable body gives ok false. (2) "Only one is present" for status versus err (README.md:118-120) is false in the unreadable-body case. (3) In the no-test SDK, testSDK "Creates a test-mode client with mock transport" (no-test/swift/README.md:219); there is no mock, and calls fail with fetch_mode_block. (4) The quick start and tutorial (B/README.md:596-611, swift/README.md:45-50) omit `import Foundation` for ProcessInfo and omit the required server variables, so construction traps through fatalError. (5) The Swift README's Error handling and Entity state sections show TypeScript code (```ts, `await client.Ambient().load()`, `ambient.match()`): Swift has no match(), its getter is matchv(). (6) Install advice `.package(url: "<repo-url>", ...)` would not resolve, because Package.swift is in swift/, not at the repository root (inferred).
- **evidence**: See questions 9, 10 and 12. out/old/B/swift/README.md:265 "| `ok` | `Bool` | `true` if the HTTP status is 2xx. |"; :120 "// an absent key simply reads as .noval." with :118-119 "Only one is present"; :985 "// ambient.match() returns the last match criteria" vs src/cmp/swift/fragment/EntityBase.fragment.swift:58 "public func matchv(".
- **old page**: As quoted.

### cpp

- **answer** (read and certain): Contradictions in the old cpp pages. (1) The tutorial, the root quick start and "Run live tests" present a live client as working (`std::make_shared<DemoSDK>(vmap({{"apikey",...}}))` then load). The runtime has no built-in HTTP transport and throws fetch_no_transport unless options.system.fetch is set, and no page says so. (2) The direct table's "`true` if the HTTP status is 2xx" and "Only one is present" are both false for an unreadable body. (3) "direct() ... never throws" holds only for SdkErrorPtr errors; other exceptions are not caught (inferred). (4) The no-test README says testSDK installs a mock transport; it falls back to BaseFeature. (5) "err contains the error value": err is a map holding only `message`, not an SdkError. (6) The root quick start omits B's required server variables and main().
- **evidence**: tm/cpp/utility/pipeline.hpp:610-613 (fetch_no_transport); out/old/B/cpp/README.md:52-58 (live client tutorial); :252 "`ok` | `bool` | `true` if the HTTP status is 2xx."; :123 "transport-level failure carries err instead. Only one is present."; :127 "`direct()` is the escape hatch: it never throws"; tm/cpp/core/types.hpp:1233 "} catch (const SdkErrorPtr& err) {" and :1235 "map_put(out, \"err\", vmap({{\"message\", Value(err->msg)}}));".
- **old page**: As quoted.

### zig

- **answer** (read and certain): Contradictions on the old zig page: (1) The tutorial uses `std.posix.getenv("DEMO_APIKEY")`, but the generator's own syntax provider says Zig 0.16 has no free-standing getenv, and the build targets 0.16. (2) The entity table lists `data`, `matchv` and `get_name` as entity methods; on the entity struct `data` is a FIELD and these are reached only through `asEntity()`. (3) The 'Entity state' section says to call `make()`, but zig spells it `makeEnt()` on the Entity interface (`v_make` is private), and it shows a TypeScript code block. (4) The direct comment says "Only one is present", but an unreadable body carries status, data and err together, and ok is false even on a 2xx. (5) The module tree says `feature/ -- Built-in features (base, test, log)`, but zig ships every builtin feature ungated.
- **evidence**: src/cmp/zig/Syntax_zig.ts:78 `// Zig 0.16 has no free-standing getenv: the process environment belongs`; src/cmp/zig/fragment/Build.fragment.zig:11 `// TOOLCHAIN: zig 0.16.`; out/old/B/zig/README.md:51 `.{ "apikey", h.vstr(std.posix.getenv("DEMO_APIKEY") orelse "") },`; tm/zig/core/types.zig:64 `pub fn makeEnt(self: Entity) Entity {`; Entity.fragment.zig:43 `data: Value,` and :266 `fn v_make(p: *anyopaque) Entity {`; out/old/B/zig/README.md:1046 "Call `make()` to create a fresh instance"; Main.fragment.zig:320-332 unreadable branch; out/old/B/zig/README.md:115-116 "Only one is present."; Config_zig.ts:172-180 BUILTIN_FEATURES
- **old page**: As quoted in the evidence.

### rust

- **answer** (read and certain): Contradictions on the old rust page: (1) The direct comment says "Only one is present", but an unreadable body carries status, headers, data and err, with ok false even on a 2xx. (2) In the no-test model, the page promises "mock transport" for `test_sdk`; in fact `make_feature("test")` falls back to BaseFeature and every request is blocked with fetch_mode_block. (3) The page does not mention `deleted()`, the only way to see the removed mark. (4) The 'Entity state' section shows a TypeScript block. (5) The module tree says `feature/ (base, test, log)`, which is the wrong set in either direction because rust trims to the model's features. The Cargo package name differs between rust/README (`voxgig-demo-sdk`) and the root README table (`voxgig-sdk-demo-sdk`); I did not verify which matches the generated Cargo.toml.
- **evidence**: src/cmp/rust/fragment/Main.fragment.rs:313-334; out/old/B/rust/README.md:106-107 "a transport-level failure carries err instead. Only one is present."; src/cmp/rust/Config_rust.ts:179 `_ => Rc::new(RefCell::new(crate::feature::base::BaseFeature::new())),`; out/old/no-test/rust/README.md:197 "Creates a test-mode client with mock transport."; tm/rust/utility/fetcher.rs:206-208 `if mode != "live" {` `return Err(ctx.make_error(` `"fetch_mode_block",`; out/old/B/rust/README.md:22 `voxgig-demo-sdk = { path = "../rust" }`; out/old/B/README.md:257 "| Rust | `voxgig-sdk-demo-sdk` |"
- **old page**: As quoted.

### clojure

- **answer** (read and certain): Contradictions in the old clojure pages: (1) `(api/get-utility client)` is documented, but sdk.api does not define it. (2) The accessor argument is called 'initial data', but it is entopts. (3) 'Only one is present' for direct, which is false for an unreadable body. (4) The 'Error handling' and 'Entity state' sections print TypeScript (`client.Ambient().load()`) in the clojure README. (5) 'Call `make()`' should be `((:make ent))`. (6) A removed entity 'keeps the data it held' (code comment) is untrue when the response has data. (7) REFERENCE options table lists `headers`, while README lists `extend`; not checked against the optspec.
- **evidence**: Main_clojure.ts:85-90 (no get-utility); fragment/Entity.fragment.clj:54 and :32; client.clj:152-160; old B/clojure/README.md:73-80 ```ts try { const ambient = await client.Ambient().load()```; README.md:967-976 `const ambient = client.Ambient()`
- **old page**: see answer

### ocaml

- **answer** (read and certain): Contradictions in the old ocaml pages: (1) The quick start, tutorial and 'Run live tests' imply live calls work, but the runtime has no live HTTP transport (`fetch_no_transport` unless `system.fetch` is given). (2) The root README's test snippet lacks its opens. (3) 'keeps the data it held' after remove is false when the response has data. (4) The direct comment 'transport failure carries err instead', which is false for case (c). (5) The 'Error handling' section prints TypeScript. (6) The no-test README still promises a mock client. (7) 'make build' is presented as installation but produces no library.
- **evidence**: sdk_runtime.ml:1573-1579 (no transport); ReadmeTopTest_ocaml.ts:33-36; EntityOperation_ocaml.ts:245-246; sdk_features.ml:1812-1814; old B/ocaml/README.md:61-68 ```ts try { const ambient = await client.Ambient().load()```; old B/ocaml/README.md:151-163 'Run live tests ... DEMO_TEST_LIVE=TRUE'
- **old page**: see answer


## Where a pair of runtimes differs, what surprised the readers, what they did not get to

### ts and js

- (differences) ctrl.explain = true: in ts every pipeline step's `ctrl.explain.X = ...` throws a TypeError, because the compiled code is strict (tsconfig strict:true). In js the utility steps are sloppy-mode CommonJS functions and silently ignore the assignment, so a successful op works. Only the class-method sites (EntityBase._unexpected on an error path, TestFeature.buildArgs in test mode) throw. Same template logic, different observable behaviour.
- (differences) Packaging: the ts entry is dist/DemoSDK.js (compiled, committed); the js entry is src/DemoSDK.js (no build). Root-relative require paths therefore differ: './ts/dist/DemoSDK' and './js/src/DemoSDK' (or './ts' and './js' through main).
- (differences) Otherwise ts and js are line-for-line ports: Main, EntityBase, the op fragments, Config, MakeRequest, ResultBody, MakeFetchDef, Fetcher, Control, MakeError and Done differ only in types, imports and comments (checked with diff).
- (surprises) client.utility() returns the LIVE Utility object, not a copy: struct.clone passes class instances through by reference. I confirmed this by running the vendored js clone in node. Every entity's _utility is therefore the client's own Utility, and custom utilities set through options.utility mutate it (MakeOptionsUtility.ts:48-51 setprop(utility, key, val)).
- (surprises) The old REFERENCE's own example `{ explain: true }` breaks ts operations with a TypeError.
- (surprises) direct() returns { ok: false } with NO err for a non-2xx readable response. The graphql() comment depends on this, but the README says err holds the error on failure.
- (surprises) A body-read failure that is not a SyntaxError (a dropped connection) loses status and headers in direct (rethrown to the outer catch). The entity-op path instead keeps the status, through bodyReadError's 'response_body_read'.
- (surprises) The entity constructor mutates the caller's entopts object (sets .active).
- (not_done) I did not generate or run an SDK. Q10 (TypeError on test() in no-test) and Q11 (explain:true behaviour) are traced from code plus node checks of the language semantics, not from executing a generated client.
- (not_done) I did not check the js REFERENCE.md line by line for the `{ explain: true }` example. I assumed it mirrors ts.
- (not_done) I did not confirm what resdata a 204 remove produces through TransformResponseUtility (whether data is kept or replaced in that case). I inferred that it is kept when resdata is null.
- (not_done) I did not consult the runtime-table.md section.

### go and c

- (differences) Accessor argument: C names it `entopts` and documents it so; Go's generated accessor names it `data` and its docs say 'initial data', yet it is passed straight through as entopts in both. Neither caches.
- (differences) direct's err: Go puts an `error` value under "err"; C puts a string (v_str(msg)). Both always leave their own failure channel unset (Go second return nil, C *err NULL).
- (differences) direct unreadable body: Go data is nil; C data is undefined (voxgig_new_undef).
- (differences) Stream: Go runs the operation in a goroutine started at the call and hands items over a channel, honouring callopts["signal"] (a chan struct{}) only between items; C runs everything synchronously before returning a List and has no signal at all.
- (differences) Calling style: Go uses methods on client and entity instances (client.Direct, client.Planet(nil).Load); C uses module-level functions taking the client (sdk_direct(client,...), demo_planet(client,...)) and vtable function pointers taking the entity (p->vt->load(p,...)).
- (differences) Member access: Go entity name via GetName(), C via vt->get_name(e); both have no client/entopts accessor; Go's client exports Mode and Features fields, C's client struct is accessed only through functions.
- (differences) Utility getter copies: Go copies the whole Utility struct value plus Custom; C allocates a new Utility holding only the shared fetcher and a shallow custom copy (C's Utility has only those two members, so equivalent).
- (surprises) Go: `client.Planet(map[string]any{...})` silently treats the map as entity options, not data; the old REFERENCE says 'Pass nil for no initial data'. NewEntyClass also writes entopts["active"]=true into the caller's map (Entity.fragment.go:27-33).
- (surprises) Both runtimes: remove REPLACES the entity's data with the response data when the response has any; the C code comments and sdk.h say the instance 'KEEPS the data it held', which holds only when the response body is empty.
- (surprises) Both runtimes: Direct never reports failure through its own error channel, yet the old Go page shows `if err != nil` as the way to handle Direct failures.
- (surprises) Without the test feature, both TestSDK/test_sdk construct fine (base-feature fallback) but every request fails with fetch_mode_block, while the no-test pages still promise a mock client with no server required.
- (surprises) C quick starts (root README and C README tutorial) omit the server variables for a templated base; C make_options calls abort() in that case (Go panics similarly, but its quick starts pass tenant/region).
- (surprises) The old C README's 'Error handling' section is TypeScript code.
- (surprises) runtime-table.md's `## go` section appeared empty when extracted (the next heading followed immediately); not investigated further since it is not evidence.
- (not_done) Did not compile or run anything (no toolchain use was in scope); answers 10 and 12 are traced by reading, hence 'read and inferred'.
- (not_done) Did not read out/old/no-test/c pages specifically; the C no-test claim is from the B C README text, which the no-test page presumably shares.
- (not_done) Did not verify that the optspec validator leaves an unknown `feature.test` entry in options untouched in Go/C (assumed from make_options flow and the Mode check, which fires regardless).
- (not_done) Did not trace the streaming feature's producer (res->stream / ctx.Result.Stream) internals for laziness; only the entity Stream code paths.
- (not_done) Notes file: /tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/survey/go/notes.md

### py and rb

- (differences) Stream laziness: py's stream is a generator function, so nothing runs at the call, not even the context build. rb builds the context and attaches the body at the call, and defers only the pipeline into Enumerator.new.
- (differences) direct's prepare-failure catch: py catches every Exception and cleans it. rb rescues only ProjectNameError and does not clean it, so other StandardErrors propagate.
- (differences) direct with no response: py's err is str(e). rb's err is "<ExceptionClass>: <message>". Both are strings, not exceptions.
- (differences) A denied op (allow.op): py returns err as a bare Exception. rb returns a ProjectNameError with code "<op>_allow".
- (differences) Options getter: py `options` is a @property backed by a __slots__ attribute. rb `options` is an attr_accessor. Both are live and writable.
- (differences) get_utility: py copies named function slots into a new Utility. rb copies every instance variable by reference and dups only @custom.
- (differences) Entity printing: rb defines to_h, to_s and inspect, which show only the data. The py entity defines no __repr__.
- (differences) Remove: py replaces the data when resdata `is not None`. rb replaces it when resdata is truthy. These are equivalent for Hash and nil.
- (surprises) In both languages the entity accessor's parameter is named `data` but is passed as the constructor's `entopts`. client.Planet({"id": 1}) therefore sets entity options, not data, and it mutates the caller's dict by adding active=true.
- (surprises) In a no-test SDK, test() quietly builds a test-mode client backed by a no-op BaseFeature. Every request then fails with fetch_mode_block, while the docs promise a mock.
- (surprises) The code comment 'The instance KEEPS the data it held' after remove is only half true: a response record replaces the data.
- (surprises) ctrl.explain = true is silently ignored in both languages, and the rb REFERENCE gives exactly that value as its example.
- (not_done) No SDK was generated or run: the py/rb behaviour of test() without the test feature (Q10) is traced in the code, not executed.
- (not_done) I did not read the streaming feature's own generator (tm/*/feature/streaming*) to check whether it does any work of its own before the first item.
- (not_done) I did not check py's patch/update/create op fragments individually beyond load/remove/list. The runtime table and _run_op show they share the same run path.

### php and perl

- (differences) Q1 accessor: php caches a no-argument entity per client (MainEntity_php.ts:43-47); perl makes a new entity on every call (MainEntity_perl.ts:24).
- (differences) Q5 stream timing: php's stream is a lazy generator, so the pipeline and its errors arrive on the first iteration; perl's runs the pipeline eagerly inside stream() (Entity.fragment.pm:177) and returns an iterator coderef, so errors die at the call.
- (differences) Q3 signal: php accepts a callable or an object with an `aborted` property; perl accepts only a coderef. In both, firing ends the iteration silently, with no error.
- (differences) Q11 explain: perl fills the caller's own hashref in place, and an empty {} works; php copies the array by value, so the caller can never read the record back, and an empty [] is falsy and records nothing. Both ignore `true`.
- (differences) Q9 ok literal: php writes true/false; perl writes 1/0. A denied direct's err is a ProjectNameError object in php and a plain string in perl. A transport failure's err is a plain string in both.
- (differences) Q7: php's test is a static method (DemoSDK::test); perl's is a class method (DemoSDK->test) that also works on an instance. Perl's accessor and its no-argument calls can be written without parentheses.
- (differences) Q8: php entity state is in private properties with no outside read; perl's is in plain hash keys that a caller can read ($e->{_data}), uncloned.
- (differences) Q12: perl's root quick start (use lib 'perl/lib') runs from the repository root; php's (require_once 'demo_sdk.php') does not, and php's test quick start has no require line at all.
- (surprises) In both languages the accessor's argument, documented as `$data`, is passed to the entity constructor as entopts, not as entity data.
- (surprises) PHP's explain record cannot be read by a caller at all: Done.php says "the caller's copy is its own", and the generated TestClean reads it through a feature hook instead.
- (surprises) In both languages the default transport's err from direct is a plain string, so the old PHP example's `$err->getMessage()` would be a fatal error on a network failure.
- (surprises) In both languages remove keeps the old data only when the response body is empty: a body replaces it.
- (surprises) In both languages direct catches only prepare's failure. A custom system.fetch that throws or dies escapes direct, despite the "never throws" comment.
- (surprises) In both languages the fetcher marks a body 'unreadable' when it is not valid JSON, so a 2xx with a non-JSON body gives ok false with err.
- (surprises) The old Perl README contains TypeScript code blocks in its error-handling and entity-state sections.
- (not_done) I ran no code, so nothing here is confirmed by executing it. Q10, the no-test path, is traced by reading only: I did not see a generated no-test features.php or features.pm, only the generator component and the no-test README.
- (not_done) I did not read the streaming feature's own stream implementation in either language, beyond the entity stream method.
- (not_done) I did not trace what direct does when ctrl throw=false makes prepare return instead of throw (php prepare returns make_error's result, and then fetches an empty URL).
- (not_done) I did not read REFERENCE.md for either language.
- (not_done) Notes file: /tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/survey/php/notes.md

### lua and elixir

- (differences) Accessor: lua caches the no-argument entity on the client (client:Planet() returns the same instance each time). elixir makes a new entity on every accessor call.
- (differences) get_utility: lua returns a copy (Utility.copy: new table, shared functions, copied custom map). elixir returns the live utility node.
- (differences) stream timing: lua runs the pipeline lazily, at the first iterator call inside a coroutine. elixir runs it eagerly inside stream/4 before returning, and the streaming feature's items are also built eagerly.
- (differences) stream signal: lua accepts a function (truthy result fires) or a table with .aborted. elixir accepts only a 0-arity function that must return exactly true.
- (differences) Failure channel: lua operations return (value, err) pairs and prepare returns (nil, err). elixir operations and prepare raise by default. direct never uses a failure channel in either: lua's second value is always nil, and elixir returns a single map read via Voxgig.Struct.getprop.
- (differences) Call form: lua uses instance methods (client:direct, client:Planet():load). elixir uses module functions taking the client or entity (Demo.direct(sdk, ...), Demo.Entity.Planet.load(ent, ...)).
- (differences) Deleted mark: lua ent:deleted() is a method on the entity. elixir has no per-entity deleted/1, only Demo.EntityBase.deleted(ent).
- (differences) Standalone program: lua needs require("<name>_sdk") plus a package.path entry when run outside lua/. elixir needs no import but must run inside the mix project (mix run from elixir/) or via Mix.install from elsewhere.
- (surprises) elixir: Entity.fragment.ex does not delegate deleted/1 or mark_deleted/1, so Demo.Entity.<Name>.deleted(ent) does not exist. runtime-table.md lists `deleted (ent)` as an entity member, which is wrong for the per-entity module.
- (surprises) Both runtimes: a 2xx response whose body is not valid JSON gives direct ok=false with err set (unreadable_body), not ok=true.
- (surprises) Both runtimes: ctrl.explain = true is silently ignored (only a table/map is copied into the control), yet the old lua REFERENCE gives `{ explain = true }` as the example.
- (surprises) The old Elixir README contains TypeScript code blocks in two sections.
- (surprises) Both runtimes: direct's prepare-failure path puts the error in err without cleaning it, while the transport and unreadable paths clean theirs. Same in lua (Main.fragment.lua:300) and elixir (Main.fragment.ex:216).
- (surprises) The old root README's Lua quick start uses `sdk` without a require line.
- (not_done) Ran nothing: no lua or elixir toolchain was invoked, so Q12's run-from-root behaviour and Q10's end-to-end failure are read and inferred, not observed.
- (not_done) Did not read the no-test model's generated README pages (P/base32/out/old/no-test/lua, elixir) for what they say about the test constructor.
- (not_done) Did not trace whether lua's default http transport or the elixir :httpc transport honour the timeout feature's fetchdef annotation.
- (not_done) Did not verify whether elixir operations accept plain Elixir maps for reqmatch in place of H.deep struct nodes.

### java and kotlin

- (differences) Entity name: java getName() method; kotlin `name` property (override var, publicly writable).
- (differences) Stream signal type: java java.util.function.BooleanSupplier (a Java lambda must be cast to it to go into Map<String,Object>); kotlin Function0 (() -> Boolean). Anything else is silently ignored in both.
- (differences) Stream return type: java java.util.stream.Stream<Object>; kotlin lazy Sequence<Any?>. Both run the operation at the call.
- (differences) Missing server variable at construction: java throws IllegalArgumentException (MakeOptions.java:218); kotlin throws SdkError server_var_required (MakeOptions.kt:177).
- (differences) testSDK: java public static method; kotlin companion-object fun without @JvmStatic (DemoSDK.testSDK() in Kotlin, DemoSDK.Companion.testSDK() from Java).
- (differences) Old root README quick start: java block passes the server map (tenant/region); kotlin block omits it, so the kotlin one throws in live mode for model B.
- (differences) Packaging: java Maven pom (mvn install works to ~/.m2); kotlin Gradle with no publish plugin (gradle build only yields a jar).
- (surprises) deleted() exists only on EntityBase, not on the SdkEntity interface the accessor returns, so reading the deleted mark needs a cast in both languages.
- (surprises) direct returns ok:false for a 2xx response whose body is unreadable, contradicting the documented 'ok true if 2xx'.
- (surprises) In an SDK without the test feature, testSDK constructs fine (BaseFeature fallback) but every request fails with fetch_mode_block; the no-test pages still promise a mock record.
- (surprises) ctrl.explain = true is silently ignored in both (only a map is accepted).
- (surprises) getUtility is a shallow copy: same function references, only the custom map copied.
- (not_done) Did not compile or run anything (no toolchain used); answers 10 and 12 are traced, not executed.
- (not_done) Did not verify whether model B's config carries default server-variable values (assumed none, as the ts and java quick starts pass placeholders).
- (not_done) Did not read the Kotlin load/list/create/update/patch fragments line by line (read remove; structure matches java).
- (not_done) Did not consult P/base32/runtime-table.md.

### scala and csharp

- (differences) Stream timing: Scala runs the request at the stream call, in EntityBase.fragment.scala:192 before the Iterator is returned. C# Stream is an async iterator, so the request runs on the first MoveNextAsync.
- (differences) Stream signal type: Scala's is a Function0 (() => Boolean) in callopts("signal"). C#'s is a CancellationToken in callopts["signal"], plus a second [EnumeratorCancellation] token. Both end the stream quietly with no exception, and neither cancels the request.
- (differences) Scala's stream postDone absorbs nothing (`() => {}`). C#'s stream postDone absorbs Resmatch into the entity's match.
- (differences) deleted marker: C# Deleted() is on IEntity, the interface the docs cast to, and on the base type the accessor returns. Scala deleted() is only on EntityBase, not on the SdkEntity trait the accessor returns, so a Scala program must cast to read it.
- (differences) Accessor argument: Scala requires the entopts argument (`client.ambient(null)`). C# defaults it (`client.Ambient()`). Scala ops require both arguments (`load(null, null)`); C# defaults ctrl (`Load(null)`).
- (differences) direct deny error: Scala puts SdkError("direct_allow") in err. C# puts a plain System.Exception with no code.
- (differences) Network failure in direct: Scala's default fetcher wraps it as RuntimeException("fetch: ..."). C# returns the raw HttpRequestException (cleaned).
- (differences) Option validation: Scala collects errors and never throws on a mistyped option (Make.scala:401). C# throws options_invalid (MakeOptions.cs:228-241).
- (differences) Packaging: Scala is a scala-cli source project (project.scala) where any .scala file in the directory is compiled in. C# is a net8.0 class library csproj, so a program needs its own project with a ProjectReference.
- (surprises) The direct result docs are wrong in both languages: a 2xx with an unreadable body gives ok false, and a readable non-2xx has no err, although both pages say 'On error, ok is false and err contains the error value'.
- (surprises) Both pages carry TypeScript code blocks (await client.direct, client.Ambient()) in their Error handling and Entity state sections.
- (surprises) For model B, the Scala and C# live quick starts omit the server variables that the TypeScript quick start marks as required, so construction would throw server_var_required.
- (surprises) Both runtimes mutate the caller's entopts map by writing an `active` key into it.
- (surprises) In a no-test SDK the test constructor builds a client with a BaseFeature standing in for `test` and mode 'test', so every request fails with fetch_mode_block. The no-test pages still advertise a mock client.
- (surprises) Scala's `deleted()` cannot be called on the SdkEntity type the docs cast to.
- (surprises) C# REFERENCE shows default arguments for TestSDK that the code does not have.
- (not_done) Nothing was compiled or run: no Scala or .NET build was attempted (no toolchain check was run either). All runtime behaviour is from reading the code.
- (not_done) Q12: the exact scala-cli command from the repository root is inferred from scala-cli's directory inputs, not from anything in the repository.
- (not_done) Q6: whether a typical remove response yields Resdata (replacing data) or none (keeping data) depends on the API's response body; I did not trace TransformResponse for an empty body.
- (not_done) I did not check the C# ReadmeInstall `../DemoSDK/DemoSDK.csproj` path against a generated tree.
- (not_done) Notes file: /tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/survey/scala/notes.md

### swift and cpp

- (differences) remove and data: swift replaces the entity's data with the remove response body when that body is non-nil (EntityRemoveOp.fragment.swift:18). cpp keeps data_ unchanged (EntityRemoveOp.fragment.cpp:12-18).
- (differences) remove and the deleted mark: swift marks deleted only when result.ok (EntityBase.fragment.swift:167-169). cpp calls markDeleted() unconditionally after runOp, so with ctrl throw:false a failed remove is still marked deleted (EntityRemoveOp.fragment.cpp:25).
- (differences) A failed op with throw:false: swift returns the error fallback Value (result.resdata) instead of the entity (EntityBase.fragment.swift:174). cpp load and remove always return self() (EntityLoadOp.fragment.cpp:28).
- (differences) stream signal: swift reads callopts.signal as a native () -> Bool and stops yielding when it returns true, though the check happens while stream() is still building the AsyncStream. cpp has no signal at all.
- (differences) stream return type: swift returns AsyncStream<Value>; cpp returns a std::vector<Value>. Both run the operation at the call.
- (differences) direct err: swift's err is .nat(ProjectNameError), an error object with a code. cpp's err is a plain map {"message": string} with no code.
- (differences) direct's failure channel: swift's direct is non-throwing by signature. cpp's direct catches only SdkErrorPtr, so other exceptions can escape.
- (differences) Live transport: swift ships a URLSession transport (Fetcher.swift:89). cpp ships none and throws fetch_no_transport without options.system.fetch (pipeline.hpp:608-613).
- (differences) Entity member access: in swift, name, client, data, match and entopts are internal, so a program reaches them only through getName(), data(), matchv() and deleted(). In cpp they are public fields (name_, client, data_, match_, deleted_, entopts) that hold the live values, and the client's options and utility are public fields too.
- (differences) Match getter name: swift matchv(); cpp match().
- (differences) Accessor naming: swift uses the PascalCase entity name (client.Planet()); cpp uses a lower snake-case name (client->planet(), graph_ql()).
- (differences) Construction failure on a missing server variable: swift traps with fatalError (MakeOptions.swift:148); cpp throws an SdkErrorPtr server_var_required from the constructor (pipeline.hpp:1936).
- (surprises) cpp has no built-in HTTP transport. Every live call fails with fetch_no_transport unless options.system.fetch holds a callable (tm/cpp/utility/pipeline.hpp:610-613), and no old page says so.
- (surprises) Model B's base URL is templated with server variables, but the swift and cpp quick starts (root and per-language) pass none, so they fail at construction: swift with fatalError, cpp with server_var_required.
- (surprises) The swift doc-example test file adds `import Foundation` itself (src/cmp/swift/ReadmeExamplesTest_swift.ts:31), which hides the quick start's missing Foundation import for ProcessInfo.
- (surprises) Swift's stream comment says the signal is 'honoured between yields', but the loop runs inside the AsyncStream build closure, which Swift runs during construction, so the check happens before the caller iterates.
- (surprises) The no-test SDK's testSDK builds a client with a no-op BaseFeature standing in for test. It does not fail at construction; it fails on the first request with fetch_mode_block.
- (surprises) Both old READMEs carry TypeScript code blocks in their Error handling and Entity state sections.
- (not_done) Nothing was compiled or run. The claims that Swift does not re-export Foundation, that SwiftPM needs the manifest at the repository root, that AsyncStream calls its build closure during construction, and that a namespace-scope `std::cout <<` is ill-formed are language and tool knowledge, not tested here.
- (not_done) I did not check whether <iostream> reaches a cpp program transitively through core/sdk.hpp.
- (not_done) I did not read the Swift or C++ streaming and timeout feature implementations in full; I only confirmed that they expose no caller cancellation.
- (not_done) I did not check how swift stream('list') and cpp stream('list') differ in item type (likely entities in swift and records in cpp). This is unverified.
- (not_done) I read the old REFERENCE.md files only by searching for keywords, not in full.

### zig and rust

- (differences) Test constructor in an SDK without the test feature: rust trims feature source (rust.aontu trim: true), so make_feature("test") silently falls back to BaseFeature, there is no mock, and every request fails with fetch_mode_block. zig does not trim (zig.aontu trim: false), and 'test' is in BUILTIN_FEATURES, so test_sdk installs the real mock TestFeature.
- (differences) Entity members: in rust every entity field is private, so name, data, match and deleted are read through methods (get_name(), data(None), matchv(None), deleted()), and the client and entity options cannot be read at all. In zig every field is accessible (name, client, entopts, data, mtch, deleted) and gives the live value, while the getters that clone are on the Entity interface via asEntity(), plus is_deleted().
- (differences) direct's signature: rust returns Result<Value, Error> but never sets Err. zig returns a bare Value with no failure channel.
- (differences) A no-body (204/304/content-length 0) direct result holds data = Value::Noval (absent) in rust and JSON null (h.vnull()) in zig.
- (differences) prepare failure: in rust, Err(ProjectNameError) carries the message. In zig, the error union E carries the error name, and the message is left on the root context's pending_err.
- (differences) The convenience constructors differ in spelling: rust has crate-level demo_sdk::new() and demo_sdk::test(); zig has sdk.new() and sdk.testSdk(), plus DemoSDK.new_with(options, extend).
- (differences) The 'make' member: rust has make() on the Entity trait. zig spells it makeEnt() on the Entity interface and has no make on the entity struct.
- (differences) Operations: rust operations are methods of the DemoEntityBase trait, so a program must import that trait and Entity. zig operations are plain pub methods of the entity struct.
- (surprises) Both runtimes: direct returns ok false for a 2xx response whose body is not valid JSON, and that result carries status, headers, data and err together, which contradicts both old pages' "Only one is present".
- (surprises) Both runtimes: under ctrl throw:false, a failed remove still marks the entity deleted, because the error becomes a successful return before mark_deleted (inferred from make_error and opError).
- (surprises) The runtime table (navigation only) is wrong for zig in three places: operations are tagged 'error union' but EntResult is a tagged union, not an error union; graphql is listed as 'on: type' but it takes self; and data/matchv/get_name are listed as instance members of the entity when they live on the Entity interface reached through asEntity().
- (surprises) The old zig page uses std.posix.getenv, which the generator's own zig syntax provider says does not exist in Zig 0.16 (the toolchain build.zig targets).
- (surprises) zig's get_utility and rust's get_utility both return a copy that shares the fetcher, so a caller replacing utility.fetcher on the copy does not affect the client.
- (not_done) I did not verify that the rust Cargo package name in a generated Cargo.toml for model B (voxgig-demo-sdk vs voxgig-sdk-demo-sdk): no generated Cargo.toml is in base32, and sdkName/model.origin were not traced.
- (not_done) I did not run or compile anything. Question 12's exact build wiring (Cargo example discovery; zig b.dependency(...).module("sdk")) is inferred from toolchain semantics, not from code in this repository.
- (not_done) I did not read the zig TestFeature mock transport in full; question 10 for zig rests on make_feature returning TestFeature and test.zig setting mode "test".
- (not_done) The REFERENCE.md pages of either language were not compared line by line; only the README pages and the root README were checked.

### clojure and ocaml

- (differences) Utility on the entity: clojure's `:_utility` is a COPY (get-utility makes a new atom, Entity.fragment.clj:34). OCaml's `e_utility` IS the client's utility record (Entity_ocaml.ts:63,69).
- (differences) Options and utility getters: clojure has `options-map` (clone) in sdk.api, and `get-utility` (shallow copy) only in sdk.client. OCaml has no getter in Sdk_client, only the live fields `cl_options`/`cl_utility`, plus the clone helper Sdk_helpers.client_options_map.
- (differences) The deleted mark: clojure sets `:_deleted` only on success (`(if (= out ent) (mark-deleted ent) out)`, frag:248). OCaml sets `e_deleted` unconditionally after run_op returns (EntityOperation_ocaml.ts:265-267), so with throw:false a failed remove still reads as deleted.
- (differences) Op result with throw:false: a clojure op returns the bare failure value when the pipeline failed (op-return, frag:65-67). OCaml returns the entity regardless (EntityOperation_ocaml.ts:269-270).
- (differences) Test constructor without the test feature: clojure still gets the full mock, because features.clj is untrimmed (trim: false). OCaml's factory falls back to base_feature, and every request fails with fetch_mode_block.
- (differences) Live transport: clojure ships java.net.http (core.clj:1873). OCaml ships NONE: without system.fetch, every live request fails with fetch_no_transport (sdk_runtime.ml:1573-1579).
- (differences) Form: clojure entities are maps with the ops as namespace functions `(e-x/load ent m ctrl)`, and the deleted mark is a namespace fn over an atom. OCaml entities are records with the ops as closure fields `ent.e_load m ctrl`, and `e_deleted` is a plain bool field.
- (differences) Signal type: clojure takes a plain Clojure 0-arg fn, true-ish to stop. OCaml takes a struct `Func` value that must return `Bool true`.
- (differences) direct `err` value: clojure gives an SDK error Clojure map with keyword keys (:code :msg ...). OCaml gives a struct Map `{code, message}`. Both give a string for allow.op denial.
- (differences) Packaging: clojure has deps.edn with :paths ["src"], so a program only needs the classpath. OCaml has no library artifact, so a program must compile all SDK sources in a fixed order.
- (surprises) OCaml bundles no HTTP transport at all. A live OCaml client cannot make a request unless the caller passes options.system.fetch. No old page says so, and the README's live quick start and 'Run live tests' imply otherwise.
- (surprises) In both languages the accessor's argument is entity OPTIONS, not data, although the clojure REFERENCE calls it 'initial data'.
- (surprises) Both streams are lazy in name only: the request and every item are fetched before the sequence is returned, and only the signal check is deferred.
- (surprises) In both languages a remove REPLACES the entity's data with the response's data, despite the code comments (and the ocaml page) saying it keeps the data it held.
- (surprises) The old clojure and ocaml READMEs both have TypeScript code blocks in their 'Error handling' sections (and clojure in 'Entity state').
- (surprises) clojure's documented `(api/get-utility client)` does not exist in sdk.api.
- (not_done) Nothing was compiled or run. The answers on compile failures (the OCaml root test snippet, a clojure run from the root) are inferred from reading.
- (not_done) I did not check whether a root deps.edn or any OCaml root build file is generated by a top-phase component outside src/cmp/<lang>. A grep of ts/src for deps.edn/opam/dune found only the per-target Package components.
- (not_done) I did not check whether the root README's OCaml/Clojure test examples, which load against an unseeded mock, return a record or raise not-found.
- (not_done) I did not verify the clojure README's options table (headers vs extend) against the generated optspec.
- (not_done) I did not trace what a clojure system.fetch that throws, or an OCaml Func that raises, does beyond noting that direct does not catch it.

