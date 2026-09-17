
import * as Path from 'node:path'

import {
  cmp, each,
  File, Copy, Folder, Fragment,
  TEST_CONTROL_EXCLUDE,
  pluginExcludes
} from '@voxgig/sdkgen'


import type {
  ModelEntity
} from '@voxgig/apidef'


import {
  KIT,
  getModelPath
} from '@voxgig/apidef'


import { Package } from './Package_kotlin'
import { Config } from './Config_kotlin'
import { Schema } from './Schema_kotlin'
import { Gitignore } from './Gitignore_kotlin'
import { MainEntity } from './MainEntity_kotlin'
import { EntityBase } from './EntityBase_kotlin'
import { EntityTypes } from './EntityTypes_kotlin'
import { SdkError } from './SdkError_kotlin'
import { PrepareAuth } from './PrepareAuth_kotlin'
import { kotlinPackage } from './utility_kotlin'


const Main = cmp(async function Main(props: any) {

  const { target } = props
  const { model } = props.ctx$

  const entity: ModelEntity = getModelPath(model, `main.${KIT}.entity`)

  // The Kotlin package root for every runtime piece (like GOMODULE for go):
  // e.g. voxgig-sdk + solardemo -> voxgig.solardemosdk -> .core etc.
  const kotlinpackage = kotlinPackage(model)

  Package({ target })

  Gitignore({})

  // Copy tm/kotlin files with replacements. KOTLINPACKAGE is the package root
  // token used throughout the templates (package/import statements).
  Copy({
    from: 'tm/' + target.name,
    // pluginExcludes: the generate-time plugin trim (an INACTIVE plugin
    // group's declared files stay out of the tree - the model's `path`
    // entries are target-root-relative, which is this Copy's root). Without
    // it every plugin group ships regardless of the model and the def maps
    // decide nothing; an exclude that matches nothing is indistinguishable
    // from no exclude at all, which is how this went wrong before.
    exclude: [/src\//, TEST_CONTROL_EXCLUDE, ...pluginExcludes(model)],
    replace: {
      ...props.ctx$.stdrep,
      KOTLINPACKAGE: kotlinpackage,

      // The vendored sekreto port carries upstream's own package root, and
      // a generated SDK must not publish classes in it: a Maven artifact
      // declaring `com.voxgig.sekreto` collides with the real library on
      // any consumer classpath. It would not COMPILE either - the vendor
      // route's `adapt` for this library matches only Sekreto.kt and
      // Support.kt, so the other fifteen sekreto files still declare
      // `package com.voxgig.sekreto` while those two moved, and every
      // cross-file reference is unresolved.
      //
      // Done HERE, the way Main_go rewrites the placeholder
      // `github.com/voxgig/struct` import, because this Copy is the one
      // seam every vendored file crosses on its way into an SDK. It is a
      // NO-OP for a file the vendor route already rewrote, so widening
      // that route's `adapt.match` to the whole `feature/secrets/`
      // directory simply retires this line.
      //
      // (The sibling `voxgig.plugin` rewrite is NOT needed: that route's
      // adapt already matches the whole `feature/secrets/plugin/` tree,
      // and the token appears nowhere in tm/kotlin. A replace that matches
      // nothing is indistinguishable from no replace at all, so it is not
      // carried "just in case".)
      'com.voxgig.sekreto': kotlinpackage + '.feature.secrets.sekreto',
    }
  })

  // Shared entity runtime (entity/EntityBase.kt).
  EntityBase({ target })

  // utility/PrepareAuth.kt. GENERATED, NOT COPIED: where the credential
  // goes - header, query parameter or cookie, under the name the spec gives
  // - is a fact about the API, and tm/ can only hold one answer. It was
  // embedded in tm/kotlin/utility/Prepare.kt among the other prepare*
  // helpers, hardcoding an `authorization` header; that one function has
  // moved out into its own compilation unit in the same package, so
  // Register.kt's `u.prepareAuth = ::prepareAuth` binds it unchanged.
  //
  // Called HERE, at Main's TOP LEVEL, and deliberately NOT inside the
  // `core` Folder below. The kotlin tree is FLAT: build.gradle.kts declares
  // core/, utility/, feature/ and entity/ as four sibling source roots, and
  // the Copy above lands tm/kotlin/utility/* at <out>/utility/. The
  // component opens `utility` itself, exactly as EntityBase opens `entity`.
  // Nested in `core` it would write core/utility/PrepareAuth.kt - which
  // still COMPILES, because core/ is scanned recursively and the package
  // declaration is what resolves the symbol, so the misfiling would be
  // invisible to every check. See PrepareAuth_kotlin.
  PrepareAuth({ target })

  // Generate the client class and config in core/.
  Folder({ name: 'core' }, () => {

    SdkError({ target })

    File({ name: model.const.Name + 'SDK.' + target.ext }, () => {

      Fragment(
        {
          from: Path.normalize(__dirname + '/../../../src/cmp/kotlin/fragment/Main.fragment.kt'),
          replace: {
            ...props.ctx$.stdrep,
            KOTLINPACKAGE: kotlinpackage,
            ProjectName: model.const.Name,
          }
        },

        // Entities - injected at SLOT
        () => {
          each(entity, (entity: ModelEntity) => {
            const entitySDK = getModelPath(model, `main.${KIT}.entity.${entity.name}`)
            const entprops = { target, entity, entitySDK, kotlinpackage }
            MainEntity(entprops)
          })
        })
    })

    Config({ target })
    Schema({ target })

    // Generate the typed reference-model file (<Name>Types.kt) beside the
    // other generated core files. Documentation/DX shapes only — not wired
    // into the loose-object-model op signatures.
    EntityTypes({ target, kotlinpackage })
  })

})


export {
  Main
}
