
/* Find value of a match parameter, possibly using an alias.
 *
 * The match parameter may have an alias key. For example, the parameter `foo_id` may be
 * aliased to `id` in the entity data.
 *
 * This function returns `undefined` rather than failing.
 */
function findparam(ctx, key) {
  let { op, spec } = ctx
  let { match, data, alias } = op

  let source = ('res' === op.kind ? match : data) || {}
  let val = source[key]

  if(null == val) {
    alias = alias || {}
    let akey = alias[key]
    val = source[akey]

    spec = spec || {}
    spec.alias = spec.alias || {}
    spec.alias[akey] = key
  }

  return val
}

module.exports = {
  findparam
}
