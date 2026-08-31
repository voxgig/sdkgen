"use strict";
// Locate the per-feature source inside a target's template tree.
//
// WHY THIS EXISTS
//
// `target add` is supposed to copy source for the features the model
// declares, and nothing else. It used to do that with a single hardcoded
// path assumption:
//
//   Copy({ from: 'tm/<lang>', exclude: [/src\/feature/] })
//   Folder({ name: 'src/feature' }, () => /* copy each model feature */)
//
// That assumption holds for exactly two targets. `ts` and `js` keep feature
// source at `src/feature/<name>/`; everyone else does something else —
// `tm/go/feature/retry_feature.go`, `tm/rust/feature/retry.rs`,
// `tm/py/pkg/feature/retry_feature.py`, `tm/dart/lib/feature/retry/...`,
// `tm/swift/Sources/ProjectNameSDK/feature/RetryFeature.swift`, and so on.
// None of those match `src/feature`, so the exclude never saw them and every
// shipped feature was copied into every project regardless of the model: 272
// stray source files across 17 targets for a project declaring no features
// at all. (For those targets `src/feature/<name>/` holds only a `.gitkeep`
// placeholder — the old gate was gating empty directories.)
//
// So instead of encoding one layout, DISCOVER it: walk the template tree,
// treat any directory named `feature` as a feature container, and map each
// entry inside it back to a feature name. That covers every layout above,
// and a target added later gets gated without anyone editing this file.
//
// The mapping is deliberately conservative. An entry only counts as feature
// source when its derived name is one the generator can actually supply
// (`availableFeatures`, read from `model/feature/*.aon`). Everything else
// inside a feature directory — `feature_options.go`, `FeatureOptions.cs`,
// `mod.rs`, `support.rs`, `options.hpp`, `__init__.py`, `README.md`, and the
// `harness.ts` under `test/feature/` — derives a name no feature has, so it
// is left alone.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASE_FEATURE = void 0;
exports.featureOf = featureOf;
exports.featureShaped = featureShaped;
exports.availableFeatures = availableFeatures;
exports.findFeatureEntries = findFeatureEntries;
exports.findFeatureSources = findFeatureSources;
exports.featureExcludes = featureExcludes;
exports.fullsetExcludes = fullsetExcludes;
exports.srcFeatureExcludes = srcFeatureExcludes;
exports.pluginExcludes = pluginExcludes;
exports.pluginExcludesFor = pluginExcludesFor;
const node_path_1 = __importDefault(require("node:path"));
const apidef_1 = require("@voxgig/apidef");
const definition_1 = require("./definition");
const junk_1 = require("./junk");
// Directory name that marks a feature container. Kept exact (not a substring
// match) so `utility/feature_add.go` and `test/feature_test.go` — which are
// shared machinery, not per-feature source — are never treated as features.
const FEATURE_DIR = 'feature';
// The always-present foundation every other feature builds on. It has no
// model file, so it is in no catalogue, and it must never be trimmed or
// reported as an unrecognised stray — every target ships one.
const BASE_FEATURE = 'base';
exports.BASE_FEATURE = BASE_FEATURE;
// Derive the feature name an entry inside a feature directory belongs to.
// Returns the lowercased name, which the caller then checks against the
// available set.
//
//   retry_feature.go   -> retry     (go, py, rb, lua, perl)
//   RetryFeature.cs    -> retry     (csharp, java, kotlin, scala, swift, php)
//   retry.rs           -> retry     (rust, c, cpp, zig, elixir)
//   retry/             -> retry     (ts, js, dart)
//   feature_options.go -> feature_options   (not a feature; `_feature` is a
//                                            prefix here, not a suffix)
//   FeatureOptions.cs  -> featureoptions    (ditto)
function featureOf(entry, folder) {
    if (folder) {
        return entry.toLowerCase();
    }
    // Only the final extension goes; `feature.test.ts` style names keep the
    // rest so they cannot collide with a bare feature name.
    const stem = entry.replace(/\.[^.]+$/, '');
    return stem
        .replace(/_feature$/i, '')
        .replace(/Feature$/, '')
        .toLowerCase();
}
// Feature names this generator can supply, read from the scaffold's
// `model/feature/*.aon`. This is the authoritative catalogue: a name not in
// it is not a feature, so nothing outside it is ever excluded.
//
// LOWERCASED, unlike `definitionNames`, because these are matched against
// names DERIVED FROM FILENAMES (`RetryFeature.swift` -> `retry`), and the
// languages disagree about case. The manifest compares definition names as
// written, so the two callers cannot share the lowercasing.
function availableFeatures(fs, sdkfolder) {
    return (0, definition_1.definitionNames)(fs, sdkfolder, 'feature')
        .map((n) => n.toLowerCase())
        .sort();
}
// Does the entry LOOK like per-feature source, whatever it is called?
//
// The naming conventions carry the intent: `<name>_feature.<ext>`,
// `<Name>Feature.<ext>`, and a directory named for the feature. A bare
// `<name>.<ext>` does NOT — `retry.rs` and `support.rs` are written the same
// way, so shape cannot separate rust's feature source from rust's shared
// machinery, and only the catalogue can. That is the deliberate blind spot of
// `package check`'s unrecognised-source finding: it reports what it can prove
// looks like a feature, and stays quiet where it would have to guess.
function featureShaped(entry, folder) {
    if (folder) {
        return true;
    }
    const stem = entry.replace(/\.[^.]+$/, '');
    return /_feature$/i.test(stem) || /Feature$/.test(stem);
}
// Every entry inside a feature container of a target's template tree —
// whether or not its derived name is a feature this generator knows.
//
// `known` decides DESCENT, not membership: a directory that names a known
// feature is the whole feature, so the walk stops there, and one that does
// not is walked through (`src/feature/base/` holds `BaseFeature.ts`, and the
// container rule below then ignores it because its parent is not `feature`).
// The unknown entries are what `package check` reports and what
// `findFeatureSources` drops; both need the same walk, so there is one.
function findFeatureEntries(fs, tmfolder, known) {
    const found = [];
    if (!fs.existsSync(tmfolder)) {
        return found;
    }
    // `rel` is relative to tmfolder, '' at the root.
    const walk = (rel) => {
        const abs = '' === rel ? tmfolder : node_path_1.default.join(tmfolder, rel);
        const entries = fs.readdirSync(abs).sort();
        for (const entry of entries) {
            // A `__pycache__` inside `src/feature/` is not a feature — but every
            // rule here derives a feature NAME from an entry name, so without this
            // it becomes one: reported by `package check` as an unknown feature, and
            // trimmed (or not) as if it were source. See helpers/junk.
            if ((0, junk_1.isJunk)(entry)) {
                continue;
            }
            const entryrel = '' === rel ? entry : rel + '/' + entry;
            const folder = fs.statSync(node_path_1.default.join(tmfolder, entryrel)).isDirectory();
            // Inside a feature container every entry is a candidate, and a
            // candidate directory is the whole feature — do not descend into it
            // looking for more.
            if (FEATURE_DIR === node_path_1.default.basename(rel)) {
                const name = featureOf(entry, folder);
                found.push({
                    name, path: entryrel, folder, shaped: featureShaped(entry, folder),
                });
                if (known.has(name)) {
                    continue;
                }
            }
            if (folder) {
                walk(entryrel);
            }
        }
    };
    walk('');
    return found;
}
// Walk a target's template tree and return every per-feature source entry.
// `tmfolder` is the target template root (`<sdk>/tm/<lang>`).
function findFeatureSources(fs, tmfolder, available) {
    const known = new Set(available);
    return findFeatureEntries(fs, tmfolder, known)
        .filter((e) => known.has(e.name))
        .map(({ name, path, folder }) => ({ name, path, folder }));
}
// Turn discovered sources into path patterns for a jostraca `Copy` exclude.
//
// jostraca tests each candidate against the path built up during its walk,
// which carries the enclosing node path as a prefix — so anchor on a
// segment boundary at both ends rather than on the whole string. A folder
// source matches everything beneath it; a file source matches only itself.
function featureExcludes(sources) {
    return sources.map((s) => new RegExp('(^|/)' + s.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (s.folder ? '/' : '$')));
}
// Path patterns for templates that only compile with the COMPLETE feature
// set — see `feature.fullset` in each target's model. These are the
// cross-feature test suites: one file per target that constructs every
// shipped feature type by name (`feature.NewRetryFeature`,
// `RUSTCRATE::feature::retry::RetryFeature`, ...). Trimming the feature set
// without dropping them leaves a project that will not compile.
function fullsetExcludes(paths) {
    return (paths || []).map((p) => new RegExp('(^|/)' + String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
}
// Generate-time guard for the `src/feature/<name>/` layout (ts, js).
//
// Root renders one Feature component per ACTIVE feature, but Main then
// copies the whole `tm/<lang>` tree — which puts a deactivated feature's
// source straight back, silently undoing the filter. `target add` keeps
// deactivated features out of `tm` in the first place; this covers the case
// where a feature is switched off AFTER it was added.
//
// Only declared-but-inactive features are excluded. `base` and anything else
// the model never mentions is left alone.
function srcFeatureExcludes(model) {
    const all = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.feature`, { required: false, only_active: false }) || {};
    const active = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.feature`, { required: false }) || {};
    return Object.keys(all)
        .filter((name) => null == active[name])
        .map((name) => new RegExp('(^|/)src/feature/' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/'));
}
// The same rule as srcFeatureExcludes, ONE LEVEL DEEPER: a feature's
// declared-but-inactive PLUGINS.
//
// A plugin is a feature's optional part — the `secrets` feature over
// sekreto has one per provider kind, and each carries its own platform
// cost (node:crypto for AWS request signing, fetch for seven HTTP vault
// clients). A project whose chain is `[dotenv, env]` should carry neither,
// and before the plugin trim it carried both, because every kind was
// reachable from a single import.
//
// Layout is `src/feature/<feature>/plugin/<plugin>/`, so a plugin's tree
// is excluded exactly as a feature's is. Only declared-but-inactive
// plugins are excluded: a directory the model never mentions is left
// alone, matching srcFeatureExcludes' treatment of `base`.
//
// Note this trims a plugin belonging to an ACTIVE feature. An inactive
// feature's whole tree — plugins included — is already gone via
// srcFeatureExcludes, so walking its plugins here would be redundant, and
// asking the model for them would fail on the `only_active` filter anyway.
// One feature's inactive-plugin patterns.
//
// Separate from pluginExcludes(model) because the two COPIES that need it
// see different things: Main copies the whole target tree and has the
// model, while the Feature component copies one feature's tree and has
// only that feature. Feature's copy is the one that actually matters —
// it runs for every ACTIVE feature, so without this an active feature's
// plugins were all copied regardless, and Main's exclude never saw them.
function pluginExcludesFor(model, fname) {
    if (null == model || null == fname) {
        return [];
    }
    // `only_active: false`, and this is the whole subtlety. The feature
    // object a component is handed has ALREADY been filtered, so its
    // `plugin` map contains only the ACTIVE plugins — and a function looking
    // there for something inactive finds nothing and excludes nothing. That
    // is exactly the trap srcFeatureExcludes documents, hit again one level
    // down: the first cut of this read the filtered feature and silently
    // trimmed nothing while every test passed.
    const plugins = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.feature.${fname}.plugin`, { required: false, only_active: false }) || {};
    const out = [];
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const pname of Object.keys(plugins).sort()) {
        const plugin = plugins[pname];
        if (false !== plugin?.active)
            continue;
        const declared = plugin.path || [];
        if (0 < declared.length) {
            for (const one of declared) {
                // FEATURE-RELATIVE, because jostraca tests a Copy's candidates
                // against the path RELATIVE TO THAT COPY'S ROOT — `sekreto/
                // provider/aws.ts`, not `src/feature/secrets/sekreto/provider/
                // aws.ts`. The Feature component's Copy is rooted at
                // `tm/<target>/src/feature/<feature>`, so a full declared path
                // never matches and the trim silently does nothing.
                //
                // Worth stating because it is invisible: an exclude that matches
                // nothing is indistinguishable from no exclude at all, and both
                // the patterns and the model were correct while nothing was
                // trimmed. Main's copy IS rooted at the target root, which is why
                // pluginExcludes below keeps the full path.
                const rel = String(one).replace(new RegExp('^src/feature/' + esc(fname) + '/'), '');
                const pat = esc(rel);
                out.push(new RegExp('(^|/)' + pat.replace(/\\\/$/, '') +
                    (/\/$/.test(rel) ? '/' : '$')));
            }
            continue;
        }
        out.push(new RegExp('(^|/)plugin/' + esc(pname) + '/'));
    }
    return out;
}
function pluginExcludes(model) {
    const active = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.feature`, { required: false }) || {};
    const out = [];
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const fname of Object.keys(active)) {
        const all = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.feature.${fname}.plugin`, { required: false, only_active: false }) || {};
        const on = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.feature.${fname}.plugin`, { required: false }) || {};
        for (const pname of Object.keys(all)) {
            if (null != on[pname])
                continue;
            // DECLARED paths first. A plugin's files are often not free to
            // move — sekreto's provider modules are vendored, and both the
            // vendoring guard and their own relative imports pin them at
            // upstream's directory depth — so a plugin says which paths it
            // owns rather than being assumed to own a directory.
            const declared = all[pname].path || [];
            if (0 < declared.length) {
                for (const one of declared) {
                    const pat = esc(String(one));
                    // A trailing slash means a folder and everything under it;
                    // anything else matches that path exactly, as featureExcludes
                    // does for a file source.
                    out.push(new RegExp('(^|/)' + pat.replace(/\\\/$/, '') +
                        (/\/$/.test(String(one)) ? '/' : '$')));
                }
                continue;
            }
            out.push(new RegExp('(^|/)src/feature/' + esc(fname) + '/plugin/' + esc(pname) + '/'));
        }
    }
    return out;
}
//# sourceMappingURL=featureSource.js.map