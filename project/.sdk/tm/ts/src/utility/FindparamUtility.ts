
import { Context } from '../types'

/* Find value of a match parameter, possibly using an alias.
 *
 * The match parameter may have an alias key. For example, the parameter `foo_id` may be
 * aliased to `id` in the entity data.
 *
 * This function returns `undefined` rather than failing.
 */
function findparam(ctx: Context, param: any) {
  const { alt, spec, match, reqmatch, data, reqdata } = ctx

  const utility = ctx.utility
  const struct = utility.struct

  const getprop = struct.getprop
  const setprop = struct.setprop

  const typify = struct.typify
  const T_string = struct.T_string

  const pt = typify(param)

  // TODO: review this search algorithm

  const key = 0 < (T_string & pt) ? param : getprop(param, 'name')

  let akey = getprop(alt.alias, key)

  let val = getprop(reqmatch, key)

  if (null == val) {
    val = getprop(match, key)
  }

  if (null == val && null != akey) {

    if (null != spec) {
      setprop(spec.alias, akey, key)
    }

    val = getprop(reqmatch, akey)
  }

  if (null == val) {
    val = getprop(reqdata, key)
  }

  if (null == val) {
    val = getprop(data, key)
  }

  if (null == val && null != akey) {
    val = getprop(reqdata, akey)

    if (null == val) {
      val = getprop(data, akey)
    }
  }

  return val
}


export {
  findparam
}

