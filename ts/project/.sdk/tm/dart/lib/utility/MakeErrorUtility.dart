import '../ProjectNameError.dart';
import '../Result.dart';

import 'CleanUtility.dart';
import 'ErrUtility.dart';

dynamic makeError(dynamic ctx, [dynamic err]) {
  final op = ctx.op;
  final opname =
      (null == op || null == op.name) ? 'unknown operation' : op.name;

  final result = ctx.result ?? Result({});
  result.ok = false;

  final reserr = result.err;

  err ??= reserr;
  err ??= ctx.error('unknown', 'unknown error');

  // TODO: project name should come from config
  // avoids spurious changes between template and generated utility
  // applies for all utility files
  final msg = 'ProjectNameSDK: ' + opname.toString() + ': ' + errmsg(err);

  ProjectNameError sdkerr;
  if (err is ProjectNameError) {
    sdkerr = err;
    sdkerr.message = clean(ctx, msg);
  } else {
    final code = errcode(err);
    sdkerr = ProjectNameError('' == code ? 'unknown' : code, clean(ctx, msg), ctx);
  }

  if (null != result.err) {
    result.err = null;
  }

  final spec = ctx.spec;

  if (null != ctx.ctrl['explain']) {
    ctx.ctrl['explain']['err'] = {
      'code': sdkerr.code,
      'message': sdkerr.message,
    };
  }

  sdkerr.result = clean(ctx, result);
  sdkerr.spec = clean(ctx, spec);

  ctx.ctrl['err'] = sdkerr;

  // TODO: model option to return instead
  if (false == ctx.ctrl['throw']) {
    return result.resdata;
  } else {
    throw sdkerr;
  }
}
