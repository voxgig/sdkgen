
import { Copy, Folder } from 'jostraca'
import { cmp } from '../helpers/component'

import { ensureStdrep } from '../helpers/stdrep'
import { featureApplies, featureTags, shippedProvides } from '../helpers/applicability'
import { pluginExcludesFor } from '../helpers/featureSource'
import { originName } from '../helpers/packageMeta'
import { resolvesBundled } from '../action/resolve'

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
    const origin = originName(ctx$.model, target.name)
    const stale = resolvesBundled(target, target.name) &&
      unmet.every((n) => shippedProvides(origin).includes(n))

    log.warn({
      point: 'feature-not-applicable', target: target.name, feature: feature.name,
      needs: feature.needs, provides: target.provides, unmet,
      note: feature.name + ' is active but not generated for ' + target.name +
        ', which does not provide ' + unmet.join(', ') + (stale ? '; the installed ' +
          origin + ' target does: `voxgig-sdkgen package update @voxgig/sdkgen --no-fetch`' +
          ' or `voxgig-sdkgen target add ' + target.name + '` refreshes the copy' : ''),
    })
    return
  }

  if (false !== target.srcfeature) {
    Folder({ name: 'src/feature/' + feature.name }, () => {
      Copy({
        from: 'tm/' + target.name + '/src/feature/' + feature.name,
        // An ACTIVE feature's INACTIVE plugins do not come with it. This
        // is the copy that decides it: Main's exclude never sees these
        // files, because this Copy has already written them.
        exclude: pluginExcludesFor(ctx$.model, feature.name),
        replace: {
          ...ensureStdrep(ctx$),
          FEATURE_VERSION: feature.version,
          FEATURE_Name: feature.Name,
        }
      })
    })
  }

  log.info({
    point: 'generate-feature', target: target.name, feature: feature.name,
    note: 'target:' + target.name + ', ' + 'feature: ' + feature.name
  })

})


export {
  Feature
}
