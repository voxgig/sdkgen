import 'voxgig_struct.dart' as vs;

dynamic makePoint(dynamic ctx) {
  if (null != ctx.out['point']) {
    return ctx.point = ctx.out['point'];
  }

  final op = ctx.op;
  final options = ctx.options;

  final allowop = (vs.getpath(options, 'allow.op') ?? '').toString();
  if (!allowop.contains(op.name.toString())) {
    return ctx.error(
        'point_op_allow',
        'Operation "' +
            op.name.toString() +
            '" not allowed by SDK option allow.op value: "' +
            allowop +
            '"');
  }

  if (0 == op.points.length) {
    return ctx.error(
        'point_no_points',
        'Operation "' + op.name.toString() + '" has no endpoint definitions.');
  }

  // Choose the appropriate point based on the match or data.
  if (1 == op.points.length) {
    ctx.point = op.points[0];
  } else {
    // Operation argument has priority, but also look in current data or match.
    final reqselector = 'data' == op.input ? ctx.reqdata : ctx.reqmatch;
    final selector = 'data' == op.input ? ctx.data : ctx.match;

    dynamic point;
    for (var i = 0; i < op.points.length; i++) {
      point = op.points[i];
      final select = point.select;
      var found = true;

      final exist = vs.getprop(select, 'exist');
      if (null != selector && exist is List) {
        for (var j = 0; j < exist.length; j++) {
          final existkey = exist[j];

          if (null == vs.getprop(reqselector, existkey) &&
              null == vs.getprop(selector, existkey)) {
            found = false;
            break;
          }
        }
      }

      // Action is only in operation argument.
      if (found &&
          vs.getprop(reqselector, r'$action') !=
              vs.getprop(select, r'$action')) {
        found = false;
      }

      if (found) {
        break;
      }
    }

    if (null != vs.getprop(reqselector, r'$action') &&
        null != point &&
        vs.getprop(reqselector, r'$action') !=
            vs.getprop(point.select, r'$action')) {
      return ctx.error(
          'point_action_invalid',
          'Operation "' +
              op.name.toString() +
              '" action "' +
              vs.getprop(reqselector, r'$action').toString() +
              '" is not valid.');
    }

    ctx.point = point;
  }

  return ctx.point;
}
