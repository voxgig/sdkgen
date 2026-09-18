"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectDeps = collectDeps;
const applicability_1 = require("./applicability");
const jostraca_1 = require("jostraca");
function collectDeps(model, targetName, targetDeps, log) {
    const out = [];
    // Gated: a feature that does not apply to this target must not flow a
    // dependency into its generated manifest.
    const feature = (0, applicability_1.targetFeatures)(model, targetName);
    const seen = {};
    const add = (dep, source, owner) => {
        const name = dep.key$;
        if (null == name)
            return;
        const prev = seen[name];
        if (null != prev) {
            if (log?.warn && prev.version !== dep.version) {
                log.warn({
                    point: 'dep-version-conflict', target: targetName, dep: name,
                    kept: prev.version, dropped: dep.version, from: owner,
                    note: `${targetName}: dependency ${name} declared twice with ` +
                        `different versions — keeping ${prev.version} (${prev.source}), ` +
                        `ignoring ${dep.version} (${source} ${owner})`,
                });
            }
            return;
        }
        const entry = {
            name,
            version: dep.version,
            source,
            raw: dep,
        };
        seen[name] = entry;
        out.push(entry);
    };
    (0, jostraca_1.each)(feature, (f) => {
        const langDeps = f?.deps?.[targetName];
        if (langDeps) {
            (0, jostraca_1.each)(langDeps, (dep) => {
                if (dep?.active) {
                    add(dep, 'feature', f.name);
                }
            });
        }
        // An inactive plugin's deps are not this SDK's deps. `true ===` rather
        // than truthiness, matching the trim: the trim drops a plugin unless it
        // is explicitly on, and the manifest must agree with the tree it
        // describes or the build asks for a crate whose files were removed.
        (0, jostraca_1.each)(f?.plugin, (plugin) => {
            if (true !== plugin?.active)
                return;
            const pluginDeps = plugin?.deps?.[targetName];
            if (!pluginDeps)
                return;
            (0, jostraca_1.each)(pluginDeps, (dep) => {
                if (dep?.active) {
                    add(dep, 'feature', f.name + '.' + plugin.name);
                }
            });
        });
    });
    if (targetDeps) {
        (0, jostraca_1.each)(targetDeps, (dep) => {
            if (dep?.active !== false) {
                add(dep, 'target', targetName);
            }
        });
    }
    return out;
}
//# sourceMappingURL=collectDeps.js.map