
import { Context, Alt } from '../types'

import { getprop } from './StructUtility'


// Ensure standard operation definition.
// TODO: rename to alt
function selection(ctx: Context): Alt | Error {
  if (ctx.out.selected) {
    return ctx.alt = ctx.out.selected
  }

  const { op, options } = ctx

  if (!options.allow.op.includes(op.name)) {
    return Error('Operation "' + op.name +
      '" not allowed by SDK option allow.op value: "' + options.allow.op + '"')
  }

  // Choose the appropriate operation alternate based on the match or data.
  if (1 === op.alts.length) {
    ctx.alt = op.alts[0]
  }
  else {
    // Operation argument has priority, but also look in current data or match.
    const reqselector = getprop(ctx, 'req' + op.select)
    const selector = getprop(ctx, op.select)

    let alt
    for (let i = 0; i < op.alts.length; i++) {
      alt = op.alts[i]
      const select = alt.select
      let found = true

      if (selector && select.exist) {
        for (let j = 0; j < select.exist.length; j++) {
          const existkey = select.exist[j]

          if (
            undefined === getprop(reqselector, existkey)
            && undefined === getprop(selector, existkey)
          ) {
            found = false
            break
          }
        }
      }

      // Action is only in operation argument.
      if (found && reqselector.$action !== select.$action) {
        found = false
      }

      if (found) {
        break
      }
    }

    if (
      null != reqselector.$action &&
      null != alt &&
      reqselector.$action !== alt.select.$action
    ) {
      return Error('Operation "' + op.name +
        '" action "' + reqselector.$action + '" is not valid.')
    }

    ctx.alt = alt
  }

  return ctx.alt
}


export {
  selection,
}
