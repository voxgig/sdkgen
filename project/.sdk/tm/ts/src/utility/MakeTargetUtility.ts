
import { Context, Target } from '../types'


function makeTarget(ctx: Context): Target | Error {
  if (ctx.out.target) {
    return ctx.target = ctx.out.target
  }

  const getprop = ctx.utility.struct.getprop
  const op = ctx.op
  const options = ctx.options

  if (!options.allow.op.includes(op.name)) {
    ctx.error('target_op_allow', 'Operation "' + op.name +
      '" not allowed by SDK option allow.op value: "' + options.allow.op + '"')
  }

  // Choose the appropriate operation alternate based on the match or data.
  if (1 === op.targets.length) {
    ctx.target = op.targets[0]
  }
  else {
    // Operation argument has priority, but also look in current data or match.
    const reqselector = getprop(ctx, 'req' + op.select)
    const selector = getprop(ctx, op.select)

    let target
    for (let i = 0; i < op.targets.length; i++) {
      target = op.targets[i]
      const select = target.select
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
      null != target &&
      reqselector.$action !== target.select.$action
    ) {
      return ctx.error('target_action_invalid', 'Operation "' + op.name +
        '" action "' + reqselector.$action + '" is not valid.')
    }

    ctx.target = target
  }

  return ctx.target
}


export {
  makeTarget,
}
