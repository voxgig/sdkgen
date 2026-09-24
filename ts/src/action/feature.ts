
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

import { templateReplacements } from '../helpers/stdrep'

import { copyOpts } from '../helpers/junk'

import { resolveKind, kindModel, kindIndex } from './kind'


import {
  UpdateIndex,
  parseAddNames,
  loadContent,
} from './action'


const CMD_MAP: any = {
  add: cmd_feature_add,
  remove: cmd_feature_remove,
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


async function cmd_feature_remove(args: string[], actx: ActionContext): Promise<ActionResult> {
  return require('./remove').kind_remove('feature', parseAddNames(args), actx)
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
    control: {
      dryrun: !!actx.opts.dryrun
    },
    // Per-call for the same reason, and covering the same accident: see
    // helpers/junk.
    cmp: copyOpts(),
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
    // The names as INSTALLED, which is what the index must list. A ref is
    // not a name: `feature add @acme/sdkgen-iot/circuitbreaker` installs
    // `circuitbreaker`, and writing the raw ref into feature-index.aontu
    // would produce an include of a file that does not exist.
    const fnames: string[] = []

    each(features, (n) => {
      const fref = n.val$

      let source: any
      try {
        source = resolveKind(fref, 'feature', ctx$)
      }
      catch (err: any) {
        if (err instanceof SdkGenError) {
          throw err
        }

        log.warn({
          point: 'feature-source-unresolved', feature: fref,
          err: err.message,
          note: fref + ': cannot find its source (' + err.message +
            '); skipping, the already-copied files are left alone'
        })
        return
      }

      const fname = source.name
      fnames.push(fname)

      log.info({
        point: 'feature-build',
        feature: fname,
        note: fname + (fname === fref ? '' : ' ref:' + fref)
      })


      Folder({ name: 'model/feature' }, () => kindModel({
        ctx$, kind: 'feature', source, names: fnames,
        content: ctx$.meta.content.feature_index,
      }))

      each(target, (t) => {
        // The target's OWN tree, under the name it has in ITS source — an
        // aliased target's templates live at `tm/<origname>`, so searching
        // `tm/<t.name>` missed them entirely.
        const sdkfolder = t.base || SDKFOLDER
        const torigname = t.origname || t.name
        const owntm = Path.join(sdkfolder, 'tm', torigname)

        const featuretm = Path.join(source.folder, 'tm', torigname)
        const overlay = featuretm === owntm ? [] :
          findFeatureSources(fs, featuretm, [fname])

        const own = 0 < overlay.length ?
          findFeatureSources(fs, owntm, [fname]) : []

        if (0 < own.length) {
          log.warn({
            point: 'feature-source-shadowed', feature: fname, target: t.name,
            overlay: featuretm, own: owntm,
            note: fname + ': both ' + featuretm + ' and ' + owntm +
              ' provide source for target ' + t.name +
              '; the overlay is used, but the files already copied from the ' +
              "target's own tree are NOT removed — check tm/" + t.name +
              ' for a mix of the two'
          })
        }

        const sources = 0 < overlay.length ? overlay :
          findFeatureSources(fs, owntm, [fname])

        const tmfolder = 0 < overlay.length ? featuretm : owntm

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

    if (0 < fnames.length) {
      Folder({ name: 'model/feature' }, () => kindIndex({
        kind: 'feature', names: fnames,
        content: ctx$.meta.content.feature_index,
      }))
    }
  })

})


export {
  feature_add,
  action_feature,
}
