
const { BaseFeature } = require('./feature/base/BaseFeature')
// #ImportFeatures


const FEATURE_CLASS = {
  // #FeatureClasses
}


class Config {

  makeFeature(fn) {
    const fc = FEATURE_CLASS[fn]
    const fi = new fc()
    // TODO: errors etc
    return fi
  }


  main = {
    name: 'ProjectName',
  }


  feature = {
    // #FeatureConfigs
  }


  options = {
    base: '$$main.kit.info.servers.0.url$$',

    auth: {
      prefix: '$$main.kit.config.auth.prefix$$',
    },

    headers: 'HEADERS',

    entity: {
      // #EntityConfigs
    }
  }


  entity = 'ENTITYMAP'
}


const config = new Config()

module.exports = {
  config
}

