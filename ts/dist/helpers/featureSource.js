"use strict";
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
const FEATURE_DIR = 'feature';
// The always-present foundation every other feature builds on. It has no
// model file, so it is in no catalogue, and it must never be trimmed or
// reported as an unrecognised stray — every target ships one.
const BASE_FEATURE = 'base';
exports.BASE_FEATURE = BASE_FEATURE;
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
function availableFeatures(fs, sdkfolder) {
    return (0, definition_1.definitionNames)(fs, sdkfolder, 'feature')
        .map((n) => n.toLowerCase())
        .sort();
}
function featureShaped(entry, folder) {
    if (folder) {
        return true;
    }
    const stem = entry.replace(/\.[^.]+$/, '');
    return /_feature$/i.test(stem) || /Feature$/.test(stem);
}
function findFeatureEntries(fs, tmfolder, known) {
    const found = [];
    if (!fs.existsSync(tmfolder)) {
        return found;
    }
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
function findFeatureSources(fs, tmfolder, available) {
    const known = new Set(available);
    return findFeatureEntries(fs, tmfolder, known)
        .filter((e) => known.has(e.name))
        .map(({ name, path, folder }) => ({ name, path, folder }));
}
function featureExcludes(sources) {
    return sources.map((s) => new RegExp('(^|/)' + s.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (s.folder ? '/' : '$')));
}
function fullsetExcludes(paths) {
    return (paths || []).map((p) => new RegExp('(^|/)' + String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
}
function srcFeatureExcludes(model) {
    const all = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.feature`, { required: false, only_active: false }) || {};
    const active = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.feature`, { required: false }) || {};
    return Object.keys(all)
        .filter((name) => null == active[name])
        .map((name) => new RegExp('(^|/)src/feature/' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/'));
}
function pluginExcludesFor(model, fname) {
    if (null == model || null == fname) {
        return [];
    }
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