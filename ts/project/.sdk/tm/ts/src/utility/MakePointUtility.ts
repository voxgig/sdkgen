
import { Context, Point } from '../types'


function makePoint(ctx: Context): Point | Error {
  if (ctx.out.point) {
    return ctx.point = ctx.out.point
  }

  const getprop = ctx.utility.struct.getprop
  const op = ctx.op
  const options = ctx.options

  if (!options.allow.op.includes(op.name)) {
    return ctx.error('point_op_allow', 'Operation "' + op.name +
      '" not allowed by SDK option allow.op value: "' + options.allow.op + '"')
  }

  if (0 === op.points.length) {
    return ctx.error('point_no_points',
      'Operation "' + op.name + '" has no endpoint definitions.')
  }

  // Choose the appropriate point based on the match or data.
  if (1 === op.points.length) {
    ctx.point = op.points[0]
  }
  else {
    // Operation argument has priority, but also look in current data or match.
    const reqselector = getprop(ctx, 'req' + op.input)
    const selector = getprop(ctx, op.input)

    let point
    let matched = false
    for (let i = 0; i < op.points.length; i++) {
      const cand = op.points[i]
      const select = cand.select
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
        point = cand
        matched = true
        break
      }
    }

    // select.exist can list more than the params needed to pick a point (for
    // /boards/{id} it is Trello's 17 optional query-includes), so a plain
    // {id} call matches NOTHING. Fall back to the fewest path segments — the
    // entity's own route, not a cross-reference from another resource that
    // also returns it — instead of whichever point came last.
    //
    // A call carrying $action lands here only when its own point failed the
    // exist test; the shortest point then almost certainly has no $action, so
    // the guard below refuses it. That is the intended outcome: an unbuildable
    // action request is an error, not a silent request to the wrong endpoint.
    if (!matched) {
      point = op.points[0]
      for (const cand of op.points) {
        if (cand.parts.length < point.parts.length) {
          point = cand
        }
      }
    }

    if (
      null != reqselector.$action &&
      null != point &&
      reqselector.$action !== point.select.$action
    ) {
      return ctx.error('point_action_invalid', 'Operation "' + op.name +
        '" action "' + reqselector.$action + '" is not valid.')
    }

    ctx.point = point
  }

  return ctx.point
}


export {
  makePoint,
}
