

import { cmp, each, names, File, Content, Copy, Folder } from '@voxgig/sdkgen'


import { MainEntity } from './MainEntity_js'
import { Test } from './Test_js'


const Main = cmp(async function Main(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const { entity, feature } = model.main.sdk

  Copy({ from: 'tm/target/' + target.name + '/package.json', name: 'package.json' })

  Test({ target })

  Folder({ name: 'src' }, () => {

    File({ name: model.const.Name + 'SDK.' + target.name }, () => {

      Content(`
// ${model.const.Name} ${target.Name} SDK
`)

      each(feature, (feature: any) => {
        names(feature, feature.name)
        Content(`
const { ${feature.Name + 'Feature'} } = require('./${feature.name}/${feature.Name}Feature')
`)
      })


      each(entity, (entity: any) => {
        names(entity, entity.name)
        Content(`
const { ${entity.Name} } = require('./${entity.Name}')
`)
      })


      const validate_options = each(target.options)
        .reduce((a: string, opt: any) =>
          a + ('String' === opt.kind ?
            `    required('string','${opt.name}',options)\n` : ''), '')

      const features = each(feature).map((feature: any) => `
${feature.name}: new ${feature.Name}Feature(this, ${JSON.stringify(feature.config || {})})
`).join(',\n')


      Content(`
    
class ${model.const.Name}SDK {
  #options
  features

  static make(options) {
    return new ${model.const.Name}SDK(options)
  }


  constructor(options) {
    this.#options = options

${validate_options}

    this.#options.fetch = this.#options.fetch || fetch

    this.features = {
${features}
    }
  }


  options() {
    return { ...this.#options }
  }



  endpoint(ctx) {
    const { opdef, entity } = ctx
    let fullpath = this.#options.endpoint + opdef.path

console.log('ENDPOINT-START', opdef, entity)

    for(let queryKey in entity.query) {
      const param = opdef.param[queryKey]
      if(param) { 
        const paramVal = entity.query[param.name]
console.log('ENDPOINT PARAM', paramKey, paramVal)
        fullpath = fullpath.replace(RegExp('{'+paramKey+'}'), paramVal)
      }
    }

    console.log('ENDPOINT', fullpath)

    return fullpath

    // let data = ent.data || {}
    // let def = ent.def
    // // Make this code depend on openapi spec
    // return this.#options.endpoint + '/' + def.name + ((op === 'load' || op === 'remove') && data.id ? '/' + data.id : '')
  }

  method(op,ent) {
    let key = (null == ent || null === ent.id) && 'save' === op ? 'create' : op
    return ({
      create: 'POST',
      save: 'PUT',
      load: 'GET',
      list: 'GET',
      remove: 'DELETE',
    })[op]
  }

  body(op,ent) {
    const msg = { ...ent.data }  
    return JSON.stringify(msg)
  }

  fetchSpec(ctx) {
    const { op } = ctx
    const method = this.method(op, ctx.entity)

/*
    let qpairs = Object.entries(ctx.entity.query)
      .filter(entry=>!entry[0].includes('$'))
      .reduce((qp,entry)=>
         (qp.push(encodeURIComponent(entry[0])+'='+encodeURIComponent(entry[1])),qp),[])

    let query = 0===qpairs.length?'':'?'+(qpairs.join('&'))
*/

    const spec = {
// url: this.endpoint(ctx)+query,
      url: this.endpoint(ctx),
      method,
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer '+this.#options.apikey
      },
      body: 'GET' === method || 'DELETE' === method ? undefined : this.body(op, ctx.entity),
    }
    return spec
  }

`)

      each(entity, (entity: any) => {
        MainEntity({ model, target, entity })
      })

      Content(`
}


function required(type,name,options) {
  const val = options[name]
  if(type !== typeof val) {
    throw new Error('${model.const.Name}SDK: Invalid option: '+name+'='+val+': must be of type '+type)
  }
}

module.exports = {
  ${model.const.Name}SDK
}

`)

    })
  })
})


export {
  Main
}
