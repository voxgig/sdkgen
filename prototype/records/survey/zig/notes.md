# k-survey notes: zig, rust
## rust (read so far)
- Main.fragment.rs: new()->Rc; options_map L95 vs::clone; get_utility L99 Utility::copy (shallow fetcher+custom copy); direct L212->raw_request L242; test_sdk L409 module fn
- MainEntity_rust.ts L27: accessor always ::new -> new entity each call
- Config_rust.ts L179: make_feature fallback `_ => BaseFeature`
- Entity.fragment.rs: data/matchv clone (L285,L301); deleted RefCell<bool>, deleted() method; stream L135 materialised at call; no signal
- remove fragment: absorbs resdata, then mark_deleted L34
- control.rs: explain is Value map; context.rs L92 only Map accepted -> true ignored
## zig (read)
- Main.fragment.zig: new L42/new_with L58; options_map L130 clone; get_utility L134 Utility.copy; direct L237 returns Value (no error channel); test_sdk L411
- MainEntity_zig.ts L28-29: accessor always .new
- Config_zig.ts L161/L165: test in BUILTIN_FEATURES L176-180 -> TestFeature even in no-test; zig.aontu trim:false L45
- Entity.fragment.zig: fields public (data, mtch, entopts, client, name, deleted); data via asEntity().data(null) (types.zig L67); is_deleted L112; remove marks only on .ok
- stream L178 materialised slice, no signal
- explain: context.zig L97 only object
- Root.fragment.zig/Build.fragment.zig: module "sdk" via b.addModule L46; build.zig.zon from Package_zig.ts
## old-page contradictions found
- zig README: std.posix.getenv (Syntax_zig says 0.16 has none); entity table says data/matchv/get_name are entity methods (they are on asEntity()); 'make()' (zig spells makeEnt); "Only one is present" in direct (unreadable carries both)
- rust README direct comment "Only one is present" - unreadable carries both status/data and err
