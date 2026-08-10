
import { cmp, Copy, Folder } from 'jostraca'

const Feature = cmp(function Feature(props: any) {
  const { target, feature, ctx$ } = props
  const { log } = ctx$

  if (false !== target.srcfeature) {
    Folder({ name: 'src/feature/' + feature.name }, () => {
      // TODO: Copy should just warn if from not found
      Copy({
        from: 'tm/' + target.name + '/src/feature/' + feature.name,
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
          ...ctx$.stdrep,
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
