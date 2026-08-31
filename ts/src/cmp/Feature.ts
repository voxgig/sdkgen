
import { cmp, Copy, Folder } from 'jostraca'

import { ensureStdrep } from '../helpers/stdrep'
import { featureApplies, featureTags } from '../helpers/applicability'
import { pluginExcludesFor } from '../helpers/featureSource'

const Feature = cmp(function Feature(props: any) {
  const { target, feature, ctx$ } = props
  const { log } = ctx$

  // A feature the target cannot take generates NOTHING for it — not the
  // source, and (via targetFeatures in the Config/Main components) not the
  // import or registry entry either. Copy would otherwise stat-fail on the
  // missing template folder and abort the whole run, taking every other
  // target with it. See helpers/applicability and docs/design/feature-tags.
  if (!featureApplies(feature, target)) {
    const provided = featureTags(target.provides)
    const unmet = featureTags(feature.needs).filter((n) => !provided.includes(n))

    log.info({
      point: 'feature-not-applicable', target: target.name, feature: feature.name,
      needs: feature.needs, provides: target.provides, unmet,
      note: feature.name + ': target ' + target.name +
        ' does not provide ' + unmet.join(', ')
    })
    return
  }

  if (false !== target.srcfeature) {
    Folder({ name: 'src/feature/' + feature.name }, () => {
      // TODO: Copy should just warn if from not found
      Copy({
        from: 'tm/' + target.name + '/src/feature/' + feature.name,
        // An ACTIVE feature's INACTIVE plugins do not come with it. This
        // is the copy that decides it: Main's exclude never sees these
        // files, because this Copy has already written them.
        exclude: pluginExcludesFor(ctx$.model, feature.name),
        replace: {
          // Feature templates reference the SDK class by placeholder — e.g.
          // tm/ts/.../TestFeature.ts imports `ProjectNameSDK`. Without the
          // standard replacements those placeholders reach the generated
          // source verbatim and the target fails to COMPILE.
          //
          // This worked by accident everywhere it worked: Main_<lang> copies
          // the whole tm/<lang> tree (feature dirs included) with stdrep
          // afterwards, so the substituted version overwrote this one. Any
          // target whose Main excludes src/ — or any consumer .sdk whose
          // local Main_<lang> lost that Copy — got the raw placeholder.
          // voxgig-solardemo-sdk hit exactly that and could not build its
          // TypeScript at all.
          ...ensureStdrep(ctx$),
          FEATURE_VERSION: feature.version,
          FEATURE_Name: feature.Name,
        }
      })
    })
  }

  log.info({
    // Identifiers only — see the note in Entity.ts.
    point: 'generate-feature', target: target.name, feature: feature.name,
    note: 'target:' + target.name + ', ' + 'feature: ' + feature.name
  })

})


export {
  Feature
}
