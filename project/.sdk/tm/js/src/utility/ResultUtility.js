
async function result(ctx) {
  let { op, response, spec, utility } = ctx
  
  const { resheaders, resbasic, resbody, resform } = utility

  spec.step = 'result'

  resform(ctx)

  if('list' == op.name) {
    let resdata = ctx.result.resdata
    ctx.resdata = []
    
    if(null != resdata && 0 < resdata.length) {
      for(let entry of resdata) {
        const entity = entity.make()
        entity.data(entry)
        ctx.resdata.push(entity)
      }
    }
  }
}


module.exports = {
  result
}
