
import * as Path from 'node:path'

import {
  cmp, each, camelify,
  File, Content, Folder, Fragment
} from '@voxgig/sdkgen'


const Entity = cmp(function Entity(props: any) {
  const { target, entity } = props
  const { model } = props.ctx$

  const ff = Path.normalize(__dirname + '/../../../src/target/js/fragment')

  Folder({ name: 'src/entity' }, () => {

    File({ name: entity.Name + 'Entity.' + target.name }, () => {

      const opnames = Object.keys(entity.op) 

      const replace = {
          Name: entity.Name,

          ...(['load','list','create','update','remove'].reduce((a:any, opname:string) =>
            (a['#' + camelify(opname) + 'Op'] =
              !opnames.includes(opname) ? '' : ({ indent }: any) => {
                Fragment({
                  from: ff + '/Entity' + camelify(opname) + 'Op.fragment.js',
                  indent,
                  replace: {
                    Name: entity.Name,
                    ['async function ' + opname]: 'async ' + opname
                  }
                })
              }, a), {}))
      }

      // console.log('REPLACE', entity.Name, replace)

      Fragment({
        from: ff + '/Entity.fragment.js',
        replace
      })


      /*
      
            
            const modifyRequest = each(model.main.sdk.feature).map((feature: any) => {
              if (feature.name == 'ratelimiter') {
                return `
          await this.sdk().features.${feature.name}.tryAcquire()`
      
              }
              return `
          spec = this.sdk().features.${feature.name}.modifyRequest(ctx)
      `
            }).join('')
      
            const modifyResult = each(model.main.sdk.feature).map((feature: any) => {
              if (feature.name == 'ratelimiter') {
                return ''
              }
              return `
            ctx.result = this.sdk().features.${feature.name}.modifyResult(ctx)
      `
            }).join('')
      
            Content(`
      // ${model.const.Name} ${target.Name} ${entity.Name} 1
      
      class ${entity.Name} {
        def
        sdk
        data
        query
      
        constructor(sdk,data) {
          this.sdk = ()=>sdk
          this.def = {
            name: '${entity.name}'
          }
          // data is optional
          this.data = data
        }
      
      
        async handleResult(ctx, res, spec, handler) {
          const status = res.status
      
          if(200 === status) {
            ctx.result = await res.json()
            // TODO: error
      
            ${modifyResult}
            return handler(ctx.result)
          }
          else {
            throw new Error('HTTP-ERROR: '+ctx.op+': ${entity.name}: '+status)
          }
        }
      `)
      
            Content(`
        async save(data) {
          const ctx = {op:'save',entity:this}
          this.data = data
          this.query = {}
          // TODO: validate data
      
          let spec = ctx.spec = this.sdk().fetchSpec(ctx,this)
          ${modifyRequest}
          const res = await this.sdk().options().fetch(spec.url,spec)
      
          return this.handleResult(ctx, res, spec, (json)=>{
            this.data = json
            return this
          })
        }
      
      `)
      
            Content(`
        async create(data) {
          const ctx = {op:'create',entity:this}
          this.data = data
          this.query = {}
          // TODO: validate data
      
          let spec = ctx.spec = this.sdk().fetchSpec(ctx,this)
          ${modifyRequest}
      
          if(this.sdk().options.debug) {
            console.log('FETCH-create', spec)
          }
      
          const res = await this.sdk().options().fetch(spec.url,spec) 
      
          return this.handleResult(ctx, res, spec, (json)=>{
            this.data = json
            return this
          })
        }
      
      
      `)
      
            Content(`
        async load(query) {
          const ctx = {op:'load',entity:this,opdef:${JSON.stringify(entity.op.load)}}
          this.data = {}
          this.query = query || {}
      
          // console.log(${JSON.stringify(entity.op.load)})
      
          let spec = ctx.spec = this.sdk().fetchSpec(ctx,this)
          ${modifyRequest}
      
          if(this.sdk().options.debug) {
            console.log('FETCH-load', spec)
          }
      
          const res = await this.sdk().options().fetch(spec.url,spec)
      
          return this.handleResult(ctx, res, spec, (json)=>{
            this.data = json
            return this
          })
        }
      
      
      `)
      
            Content(`
        async remove(query) {
          const ctx = {op:'remove',entity:this}
          this.data = {}
          this.query = query || {}
      
          let spec = ctx.spec = this.sdk().fetchSpec(ctx,this)
          ${modifyRequest}
          const res = await this.sdk().options().fetch(spec.url,spec)
      
          return this.handleResult(ctx, res, spec, (json)=>{
            this.data = json
            return null
          })
        }
      
      `)
      
            Content(`
        async list(query) {
          const ctx = {op:'list',entity:this}
          this.data = {}
          this.query = query || {}
      
          let spec = ctx.spec = this.sdk().fetchSpec(ctx,this)
          ${modifyRequest}
      
          if(this.sdk().options.debug) {
            console.log('FETCH-load', spec)
          }
      
          const res = await this.sdk().options().fetch(spec.url,spec)
      
          return this.handleResult(ctx, res, spec, (json)=>{
            return json.list.map(data=>this.sdk().${entity.Name}(data))
          })
        }
      
      `)
      
            Content(`
      
      }
      
      
      module.exports = {
        ${entity.Name}
      }
      
      `)
      
      
      */

    })
  })
})


export {
  Entity
}