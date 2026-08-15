
import Path from 'node:path'

import {
  Project,
  File,
  Folder,
  Copy,
  cmp,
  each,
} from 'jostraca'

import { showChanges } from '@voxgig/util'

import { showDryrun } from '../helpers/dryrun'

import {
  KIT
} from '../types'

import type {
  ActionContext,
  ActionResult,
} from '../types'

import { SdkGenError } from '../utility'

import { findFeatureSources } from '../helpers/featureSource'

import { templateReplacements, provenanceReplace } from '../helpers/stdrep'


import {
  UpdateIndex,
  parseAddNames,
  loadContent,
} from './action'


const CMD_MAP: any = {
  add: cmd_feature_add
}

const BASE = 'node_modules/@voxgig/sdkgen'

// The `.sdk` folder a bundled feature comes from — the value recorded as its
// provenance. Still hardcoded, like the path above: giving `feature add` the
// ref grammar `target add` already has is the next step, and this becomes
// whatever the ref resolved to.
const SDKFOLDER = BASE + '/project/.sdk'


async function action_feature(args: string[], actx: ActionContext): Promise<ActionResult> {

  const cmdname = args[1]

  const cmd = CMD_MAP[cmdname]

  if (null == cmd) {
    throw new SdkGenError('Unknown feature cmd: ' + cmdname)
  }

  return await cmd(args, actx)
}


async function cmd_feature_add(args: string[], actx: ActionContext): Promise<ActionResult> {
  return feature_add(parseAddNames(args), actx)
}


async function feature_add(features: string[], actx: ActionContext): Promise<ActionResult> {

  // Reuse the caller's Jostraca instance so feature generation honours the
  // shared controls (notably `dryrun`). A fresh Jostraca() defaults dryrun
  // to false and would write files during a dry run.
  const jostraca = actx.jostraca

  const opts = {
    fs: actx.fs,
    folder: actx.folder,
    log: actx.log.child({ cmp: 'jostraca' }),
    meta: {
      // model: actx.model,
      // tree: actx.tree,
      url: actx.url,
      content: loadContent(actx, 'feature')
    },
    model: actx.model,
    // Dry run must be passed per-call, not left to the Jostraca instance.
    // jostraca's `generate` runs its own options through OptionsShape FIRST,
    // which fills in `control.dryrun: false`, and only then merges
    // `deep({}, gOpts.control, opts.control)` — so the shape default silently
    // OVERRIDES the instance-level flag. `-y target add ts` printed
    // ** DRY RUN ** and wrote every file. (Same trap as the `existing` FIX
    // note in jostraca.js.)
    control: {
      dryrun: !!actx.opts.dryrun
    },
  }

  opts.log.info({
    point: 'feature-start',
    note: (actx.opts.dryrun ? '** DRY RUN **' : '')
  })

  const jres = await jostraca.generate(opts, () => FeatureRoot({ features }))

  showChanges(opts.log, 'feature-result', jres)

  if (actx.opts.dryrun) {
    showDryrun(opts.log, 'feature-result', jres, actx.folder)
  }

  opts.log.info({
    point: 'feature-end',
    note: (actx.opts.dryrun ? '** DRY RUN **' : '')
  })

  return {
    jres
  }
}


const FeatureRoot = cmp(function FeatureRoot(props: any) {
  const { ctx$, features } = props
  const { model, log } = ctx$

  const fs = ctx$.fs()
  const target = model.main[KIT].target

  Project({}, () => {
    each(features, (n) => {
      const fname = n.val$
      // TODO: validate feature is a-z0-9-_. only

      log.info({
        point: 'feature-build',
        feature: fname,
        note: fname
      })


      Folder({ name: 'model/feature' }, () => {
        Copy({
          // TODO: these paths needs to be parameterised
          from: BASE + '/project/.sdk/model/feature/' + fname + '.aontu',
          // Where this feature came from, stamped over the `base: 'BASE'`
          // anchor the shipped model carries — the same mechanism, and the
          // same shared map, `target add` uses. A feature model recorded
          // nothing at all before, so `feature add` could only ever mean the
          // bundled scaffold; recording it is what lets a bare name keep
          // resolving to an external source on the next `target add` (which
          // re-runs this action for every active feature).
          replace: provenanceReplace({ base: SDKFOLDER }),
        })
        File({ name: 'feature-index.aontu' }, () => UpdateIndex({
          content: ctx$.meta.content.feature_index,
          names: features,
        }))
      })

      // Bring in the feature's source for every target already in the model.
      // Where that source lives is language-specific — `src/feature/<name>/`
      // for ts and js, `feature/<name>_feature.go` for go,
      // `lib/feature/<name>/` for dart, and so on — so discover it in the
      // target's template tree instead of assuming one layout. Assuming
      // `src/feature/<name>` meant `feature add` silently added nothing for
      // every target that keeps feature source elsewhere.
      each(target, (t) => {
        const sdkfolder = t.base || Path.join(BASE, 'project/.sdk')
        const tmfolder = Path.join(sdkfolder, 'tm', t.name)

        const sources = findFeatureSources(fs, tmfolder, [fname])

        if (0 === sources.length) {
          log.warn({
            point: 'feature-source-missing', feature: fname, target: t.name,
            folder: tmfolder,
            note: 'no ' + fname + ' source found for target ' + t.name
          })
          return
        }

        for (const source of sources) {
          // A folder source IS the destination folder; a file source goes
          // into the folder that holds it.
          const dest = source.folder ? source.path : Path.dirname(source.path)

          Folder({ name: 'tm/' + t.name + '/' + dest }, () => {
            Copy({
              from: Path.join(tmfolder, source.path),
              // The SAME map `target add` writes `tm/<t>` with. Without it
              // this copy laid RAW template text over files the target add
              // had already substituted, so `ProjectName` / `PROJECTVERSION`
              // survived into the project depending only on which action
              // wrote the file last — the writer/writer disagreement
              // helpers/stdrep.ts exists to prevent, in the one place that
              // did not share the map.
              replace: templateReplacements(model, t.name),
            })
          })
        }
      })

      log.info({
        point: 'feature-done', feature: fname,
        note: fname
      })
    })
  })

})


export {
  feature_add,
  action_feature,
}
