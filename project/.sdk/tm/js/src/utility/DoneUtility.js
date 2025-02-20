
function done(ctx) {
  const { error } = ctx.utility
  
  if(ctx.result.ok) {
    return ctx.result.resdata
  }

  return error(ctx)
}


module.exports = {
  done
}
