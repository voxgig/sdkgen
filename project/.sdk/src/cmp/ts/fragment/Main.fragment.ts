
import type { Context, Feature } from './types'

import { Config } from './Config'
import { Utility } from './utility/Utility'


import { BaseFeature } from './feature/base/BaseFeature'

const utility = new Utility()


class ProjectNameSDK {
  _mode: string = 'live'
  _options: any
  _utility = utility
  _features: Feature[]
  _shared: any = {}
  _rootctx: Context

  constructor(options?: any) {

    this._rootctx = this._utility.contextify({
      client: this,
      utility: this._utility,
      config: Config,
      options,
      shared: new WeakMap()
    })

    this._options = this._utility.options(this._rootctx)

    const getpath = this._utility.struct.getpath

    if (true === getpath(this._options.feature, 'test.active')) {
      this._mode = 'test'
    }

    this._rootctx.options = this._options

    this._features = []

    const addfeature = this._utility.addfeature
    const initfeature = this._utility.initfeature

    // #BuildFeatures

    if (null != this._options.extend) {
      for (let f of this._options.extend) {
        addfeature(this._rootctx, f)
      }
    }

    for (let f of this._features) {
      initfeature(this._rootctx, f)
    }

    const featurehook = this._utility.featurehook
    featurehook(this._rootctx, 'PostConstruct')
  }


  options() {
    return { ...this._options }
  }


  utility() {
    return { ...this._utility }
  }


  // <[SLOT]>


  static test(testopts?: any, sdkopts?: any) {
    const active = null == testopts ? false : null == testopts.active ? true : !!testopts.active
    testopts = testopts || {}
    testopts.active = active

    sdkopts = sdkopts || {}
    sdkopts.feature = sdkopts.feature || {}
    sdkopts.feature.test = testopts || {}
    sdkopts.feature.test.active = true

    return new ProjectNameSDK(sdkopts)
  }


  tester(testopts?: any, sdkopts?: any) {
    return ProjectNameSDK.test(testopts, sdkopts)
  }

}


class ProjectNameEntity {

}



const SDK = ProjectNameSDK

export {
  utility,

  BaseFeature,
  ProjectNameEntity,

  ProjectNameSDK,
  SDK,
}


