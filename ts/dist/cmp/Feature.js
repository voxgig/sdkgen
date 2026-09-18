"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Feature = void 0;
const jostraca_1 = require("jostraca");
const stdrep_1 = require("../helpers/stdrep");
const applicability_1 = require("../helpers/applicability");
const featureSource_1 = require("../helpers/featureSource");
const Feature = (0, jostraca_1.cmp)(function Feature(props) {
    const { target, feature, ctx$ } = props;
    const { log } = ctx$;
    // A feature the target cannot take generates NOTHING for it — not the
    // source, and (via targetFeatures in the Config/Main components) not the
    // import or registry entry either. Copy would otherwise stat-fail on the
    // missing template folder and abort the whole run, taking every other
    // target with it. See helpers/applicability and docs/design/feature-tags.
    if (!(0, applicability_1.featureApplies)(feature, target)) {
        const provided = (0, applicability_1.featureTags)(target.provides);
        const unmet = (0, applicability_1.featureTags)(feature.needs).filter((n) => !provided.includes(n));
        log.info({
            point: 'feature-not-applicable', target: target.name, feature: feature.name,
            needs: feature.needs, provides: target.provides, unmet,
            note: feature.name + ': target ' + target.name +
                ' does not provide ' + unmet.join(', ')
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
                    ...(0, stdrep_1.ensureStdrep)(ctx$),
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