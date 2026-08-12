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
// (`availableFeatures`, read from `model/feature/*.aontu`). Everything else
// inside a feature directory — `feature_options.go`, `FeatureOptions.cs`,
// `mod.rs`, `support.rs`, `options.hpp`, `__init__.py`, `README.md`, and the
// `harness.ts` under `test/feature/` — derives a name no feature has, so it
// is left alone.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureOf = featureOf;
exports.availableFeatures = availableFeatures;
exports.findFeatureSources = findFeatureSources;
exports.featureExcludes = featureExcludes;
exports.fullsetExcludes = fullsetExcludes;
exports.srcFeatureExcludes = srcFeatureExcludes;
const node_path_1 = __importDefault(require("node:path"));
const apidef_1 = require("@voxgig/apidef");
// Directory name that marks a feature container. Kept exact (not a substring
// match) so `utility/feature_add.go` and `test/feature_test.go` — which are
// shared machinery, not per-feature source — are never treated as features.
const FEATURE_DIR = 'feature';
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
// `model/feature/*.aontu`. This is the authoritative catalogue: a name not in
// it is not a feature, so nothing outside it is ever excluded.
function availableFeatures(fs, sdkfolder) {
    const dir = node_path_1.default.join(sdkfolder, 'model', 'feature');
    if (!fs.existsSync(dir)) {
        return [];
    }
    return fs.readdirSync(dir)
        .filter((n) => n.endsWith('.aontu') && 'feature-index.aontu' !== n)
        .map((n) => n.replace(/\.aontu$/, '').toLowerCase())
        .sort();
}
// Walk a target's template tree and return every per-feature source entry.
// `tmfolder` is the target template root (`<sdk>/tm/<lang>`).
function findFeatureSources(fs, tmfolder, available) {
    const known = new Set(available);
    const found = [];
    if (!fs.existsSync(tmfolder)) {
        return found;
    }
    // `rel` is relative to tmfolder, '' at the root.
    const walk = (rel) => {
        const abs = '' === rel ? tmfolder : node_path_1.default.join(tmfolder, rel);
        const entries = fs.readdirSync(abs).sort();
        for (const entry of entries) {
            const entryrel = '' === rel ? entry : rel + '/' + entry;
            const folder = fs.statSync(node_path_1.default.join(tmfolder, entryrel)).isDirectory();
            // Inside a feature container every entry is a candidate, and a
            // candidate directory is the whole feature — do not descend into it
            // looking for more.
            if (FEATURE_DIR === node_path_1.default.basename(rel)) {
                const name = featureOf(entry, folder);
                if (known.has(name)) {
                    found.push({ name, path: entryrel, folder });
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
//# sourceMappingURL=featureSource.js.map