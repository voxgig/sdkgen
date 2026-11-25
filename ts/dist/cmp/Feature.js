"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Feature = void 0;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const stdrep_1 = require("../helpers/stdrep");
const applicability_1 = require("../helpers/applicability");
const featureSource_1 = require("../helpers/featureSource");
const packageMeta_1 = require("../helpers/packageMeta");
const resolve_1 = require("../action/resolve");
const Feature = (0, component_1.cmp)(function Feature(props) {
    const { target, feature, ctx$ } = props;
    const { log } = ctx$;
    // A feature the target cannot take generates NOTHING for it — not the
    // source, and (via targetFeatures in the Config/Main components) not the
    // import or registry entry either. Copy would otherwise stat-fail on the
    // missing template folder and abort the whole run, taking every other
    // target with it. See helpers/applicability and docs/design/feature-tags.
    if (!(0, applicability_1.featureApplies)(feature, target)) {
        const provided = (0, applicability_1.providedBy)(target);
        const unmet = (0, applicability_1.featureTags)(feature.needs).filter((n) => !provided.includes(n));
        const origin = (0, packageMeta_1.originName)(ctx$.model, target.name);
        const stale = (0, resolve_1.resolvesBundled)(target, target.name) &&
            unmet.every((n) => (0, applicability_1.shippedProvides)(origin).includes(n));
        log.warn({
            point: 'feature-not-applicable', target: target.name, feature: feature.name,
            needs: feature.needs, provides: target.provides, unmet,
            note: feature.name + ' is active but not generated for ' + target.name +
                ', which does not provide ' + unmet.join(', ') + (stale ? '; the installed ' +
                origin + ' target does: `voxgig-sdkgen package update @voxgig/sdkgen --no-fetch`' +
                ' or `voxgig-sdkgen target add ' + target.name + '` refreshes the copy' : ''),
        });
        return;
    }
    if (false !== target.srcfeature) {
        (0, jostraca_1.Folder)({ name: 'src/feature/' + feature.name }, () => {
            (0, jostraca_1.Copy)({
                from: 'tm/' + target.name + '/src/feature/' + feature.name,
                // An ACTIVE feature's INACTIVE plugins do not come with it. This
                // is the copy that decides it: Main's exclude never sees these
                // files, because this Copy has already written them.
                exclude: (0, featureSource_1.pluginExcludesFor)(ctx$.model, feature.name),
                replace: {
                    ...(0, stdrep_1.ensureStdrep)(ctx$, target),
                    FEATURE_VERSION: feature.version,
                    FEATURE_Name: feature.Name,
                }
            });
        });
    }
    log.info({
        point: 'generate-feature', target: target.name, feature: feature.name,
        note: 'target:' + target.name + ', ' + 'feature: ' + feature.name
    });
});
exports.Feature = Feature;
//# sourceMappingURL=Feature.js.map